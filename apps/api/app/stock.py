"""Medicine stock: how many tablets are left at the parent's home, and a refill alert in time.

The family records, per medicine (by the name in parents.medicines), how many
tablets a day the parent takes, the pack size and how many are at home now.
Nothing is counted per dose: what is left is the count at stock_at minus
per_day for each day since, which is how a family thinks about it anyway
("a strip of 10 lasts 10 days"). Restocking adds tablets to what is left now.

refill_due() finds medicines with REFILL_DAYS or fewer days left whose family
hasn't been told yet; run_refill_alerts pushes "Maa's Amlodipine runs out in
about 4 days" during the day (ALERT_HOURS IST), once per stock level: a restock
or a new count clears it. A background thread does this every CHECK_EVERY
(start_in_background, from app.main); it never places a call, so it runs even
with the scheduler off. The same thread sends the weekly "groceries due" nudge
(app/groceries.py).

A medicine can be a course (course_ends_on, e.g. an antibiotic for 5 days):
it is only "low" if what is left won't last to the end of the course, the
suggested amount to buy is only what finishes the course, and once the course
is over it never alerts again. Ongoing medicines suggest about a month.

Ordering itself happens outside Kin for now: the app's Reorder sheet opens the
chemist's WhatsApp with the order written out, or a pharmacy app's search.
Amazon is the one shop whose links can fill a cart with several products, so
the family can save each medicine's Amazon product once (medicine_products,
set_product) and the app builds one "add all to cart" link.
"""

import math
import os
import re
import threading
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

import httpx

from app.families import _one, _query
from app.parents import ProfileError

IST = timezone(timedelta(hours=5, minutes=30))
REFILL_DAYS = 5
ALERT_HOURS = range(9, 20)  # 9 am to 8 pm IST: nobody wants this at midnight
CHECK_EVERY = 30 * 60
COLS = "id, phone, name, per_day, pack_size, stock, stock_at, refill_alert_at, course_ends_on"
MONTH_DAYS = 30  # an ongoing medicine: suggest about a month


class NotFound(Exception):
    pass


def _left(row: dict, now: datetime) -> float:
    days = max(0.0, (now - row["stock_at"]).total_seconds() / 86400)
    return max(0.0, row["stock"] - row["per_day"] * days)


def view(row: dict, now: datetime | None = None) -> dict:
    """What the app shows: tablets left, days left, the IST date they run out, and whether it's low."""
    now = now or datetime.now(timezone.utc)
    left = _left(row, now)
    # Whole tablets, rounded up: 20 counted stays 20 until a dose's worth of time has passed.
    tablets = math.ceil(left - 1e-6)
    days = left / row["per_day"] if row["per_day"] > 0 else None
    today = now.astimezone(IST).date()
    ends = row.get("course_ends_on")
    # Days still to cover, counting today: the rest of the course, or a month if ongoing.
    to_cover = MONTH_DAYS if ends is None else max(0, (ends - today).days + 1)
    need = max(0.0, row["per_day"] * to_cover - tablets)
    # Whole tablets cover today and the days after: 3 at one a day last today, +1, +2.
    covered = math.floor(tablets / row["per_day"]) if row["per_day"] > 0 else 0
    lasts = ends is not None and covered > 0 and today + timedelta(days=covered - 1) >= ends
    low = days is not None and days <= REFILL_DAYS and to_cover > 0 and not lasts
    return {
        "id": row["id"],
        "name": row["name"],
        "per_day": row["per_day"],
        "pack_size": row["pack_size"],
        "left": tablets,
        "days_left": math.floor(tablets / row["per_day"]) if days is not None else None,
        "runs_out_on": (now + timedelta(days=days)).astimezone(IST).date().isoformat() if days is not None else None,
        "low": low,
        "course_ends_on": ends.isoformat() if ends else None,
        "course_done": ends is not None and today > ends,
        "enough_for_course": bool(lasts),  # a course whose tablets at home already last to its end
        "suggested_strips": math.ceil(need / row["pack_size"] - 1e-9) if need > 0 else 0,
        "updated_at": row["stock_at"],
    }


def for_parent(phone: str) -> list[dict]:
    return [view(r) for r in _query(f"SELECT {COLS} FROM medicine_stock WHERE phone = %(p)s ORDER BY lower(name)", {"p": phone})]


def _owned(family_id: int, stock_id: int) -> dict:
    row = _one(
        f"SELECT s.{COLS.replace(', ', ', s.')} FROM medicine_stock s JOIN parents p ON p.phone = s.phone "
        "WHERE s.id = %(i)s AND p.family_id = %(f)s",
        {"i": stock_id, "f": family_id},
    )
    if not row:
        raise NotFound("Medicine not found")
    return row


def set_stock(family_id: int, phone: str, name: str, per_day: float, pack_size: int, tablets: float,
              course_ends_on=None) -> dict:
    """The family counted (or set up) a medicine: tablets at home now. Clears any refill alert."""
    if not _one("SELECT 1 AS ok FROM parents WHERE phone = %(p)s AND family_id = %(f)s", {"p": phone, "f": family_id}):
        raise NotFound("Parent not found")
    row = _query(
        f"""
        INSERT INTO medicine_stock (phone, name, per_day, pack_size, stock, stock_at, course_ends_on)
        VALUES (%(p)s, %(n)s, %(d)s, %(k)s, %(t)s, now(), %(e)s)
        ON CONFLICT (phone, lower(name)) DO UPDATE SET name = EXCLUDED.name, per_day = EXCLUDED.per_day,
            pack_size = EXCLUDED.pack_size, stock = EXCLUDED.stock, stock_at = now(), course_ends_on = EXCLUDED.course_ends_on,
            refill_alert_at = NULL, updated_at = now()
        RETURNING {COLS}
        """,
        {"p": phone, "n": name, "d": per_day, "k": pack_size, "t": tablets, "e": course_ends_on},
    )[0]
    return view(row)


def restock(family_id: int, stock_id: int, packs: int = 0, tablets: int = 0) -> dict:
    """Bought more: adds to what is left now (not to the old count). Clears the refill alert."""
    row = _owned(family_id, stock_id)
    now = datetime.now(timezone.utc)
    added = packs * row["pack_size"] + tablets
    row = _query(
        f"UPDATE medicine_stock SET stock = %(s)s, stock_at = %(now)s, refill_alert_at = NULL, updated_at = now() "
        f"WHERE id = %(i)s RETURNING {COLS}",
        {"s": _left(row, now) + added, "now": now, "i": stock_id},
    )[0]
    return view(row, now)


def restock_many(family_id: int, items: list[dict]) -> list[dict]:
    """"Restock all": each {id, packs}; checks every id belongs to the family before changing any."""
    for it in items:
        _owned(family_id, it["id"])
    return [restock(family_id, it["id"], it["packs"]) for it in items if it["packs"] > 0]


def delete(family_id: int, stock_id: int) -> None:
    _owned(family_id, stock_id)
    _query("DELETE FROM medicine_stock WHERE id = %(i)s RETURNING id", {"i": stock_id})


# ---- refill alerts ----------------------------------------------------------------

def refill_due(now: datetime | None = None) -> list[dict]:
    """Claims medicines that are low and not yet alerted (atomic, so two containers never both push)."""
    now = now or datetime.now(timezone.utc)
    due = []
    for row in _query(
        f"SELECT s.{COLS.replace(', ', ', s.')}, p.parent_name FROM medicine_stock s JOIN parents p ON p.phone = s.phone "
        "WHERE s.refill_alert_at IS NULL AND s.per_day > 0 AND p.family_id IS NOT NULL"
    ):
        v = view(row, now)
        if not v["low"]:
            continue
        if _query("UPDATE medicine_stock SET refill_alert_at = now() WHERE id = %(i)s AND refill_alert_at IS NULL RETURNING id",
                  {"i": row["id"]}):
            due.append({**v, "phone": row["phone"], "parent_name": row["parent_name"]})
    return due


def alert_text(item: dict) -> tuple[str, str]:
    name, med, days = item["parent_name"], item["name"], item["days_left"]
    when = "has run out" if item["left"] <= 0 else "runs out today" if days == 0 else f"runs out in about {days} day{'' if days == 1 else 's'}"
    return f"{name}'s {med} {when}", f"{item['left']} tablets left. Tap to reorder."


def run_refill_alerts(now: datetime | None = None) -> int:
    """Pushes each new low-stock medicine to its family. Returns how many it sent. Quiet at night."""
    now = now or datetime.now(timezone.utc)
    if now.astimezone(IST).hour not in ALERT_HOURS:
        return 0
    from app import push  # push imports the scheduler, which imports app.me

    sent = 0
    for item in refill_due(now):
        tokens = push.tokens_for(item["phone"])
        if tokens:
            title, body = alert_text(item)
            push.send(tokens, title, body, {"screen": "medicines", "phone": item["phone"]})
            sent += 1
    return sent


def start_in_background() -> None:
    """From app.main. STOCK_ALERTS=0 turns it off (the tests do)."""
    if os.getenv("STOCK_ALERTS", "1") == "0":
        return

    def loop():
        time.sleep(60)  # let the API finish starting
        while True:
            try:
                n = run_refill_alerts()
                if n:
                    print(f"stock: sent {n} refill alerts")
                from app import groceries  # groceries imports this module

                n = groceries.run_alerts()
                if n:
                    print(f"stock: sent {n} grocery reminders")
            except ProfileError as e:
                print(f"stock: database unavailable ({e})")
            except Exception as e:
                print(f"stock: refill check failed: {type(e).__name__}: {e}")
            time.sleep(CHECK_EVERY)

    threading.Thread(target=loop, name="kin-stock", daemon=True).start()


# ---- each medicine's Amazon product (for one "add all to cart" link) -----------------

ASIN = re.compile(r"/(?:dp|gp/product|gp/aw/d|product)/([A-Z0-9]{10})(?:[/?]|$)")
SHORT_HOSTS = ("amzn.in", "amzn.to", "a.co", "amzn.eu")


class BadLink(Exception):
    pass


def asin_from(link: str) -> str:
    """The product ID from an Amazon link: a product page, or a short share link (followed once)."""
    link = link.strip()
    if re.fullmatch(r"[A-Z0-9]{10}", link):
        return link
    if not link.startswith(("http://", "https://")):
        link = "https://" + link
    host = (urlparse(link).hostname or "").lower()
    if host.endswith(SHORT_HOSTS) and not host.startswith("www.amazon"):
        try:
            res = httpx.get(link, follow_redirects=False, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
        except httpx.HTTPError as e:
            raise BadLink("Couldn't open that link. Copy the link from the product page instead.") from e
        link = res.headers.get("location", "")
        host = (urlparse(link).hostname or "").lower()
    if "amazon." not in host:
        raise BadLink("That isn't an Amazon product link.")
    m = ASIN.search(urlparse(link).path + "/")
    if not m:
        raise BadLink("Couldn't find the product in that link. Open the medicine's page on Amazon and share its link.")
    return m.group(1)


def products_for(phone: str) -> list[dict]:
    return _query("SELECT name, amazon_asin FROM medicine_products WHERE phone = %(p)s ORDER BY lower(name)", {"p": phone})


def set_product(family_id: int, phone: str, name: str, link: str | None) -> dict | None:
    """Saves (or with no link, forgets) a medicine's Amazon product."""
    if not _one("SELECT 1 AS ok FROM parents WHERE phone = %(p)s AND family_id = %(f)s", {"p": phone, "f": family_id}):
        raise NotFound("Parent not found")
    if not link:
        _query("DELETE FROM medicine_products WHERE phone = %(p)s AND lower(name) = lower(%(n)s) RETURNING id", {"p": phone, "n": name})
        return None
    asin = asin_from(link)
    return _query(
        "INSERT INTO medicine_products (phone, name, amazon_asin) VALUES (%(p)s, %(n)s, %(a)s) "
        "ON CONFLICT (phone, lower(name)) DO UPDATE SET name = EXCLUDED.name, amazon_asin = EXCLUDED.amazon_asin, updated_at = now() "
        "RETURNING name, amazon_asin",
        {"p": phone, "n": name, "a": asin},
    )[0]
