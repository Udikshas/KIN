"""Monthly groceries for the parent: what to buy, how often, and a nudge when it's due.

Each item has a quantity as the family writes it ("5 kg", "1 L") and how often
it's bought (every_days: 30 = monthly, 7 = weekly...). An item is due once
every_days have passed since it was last bought (last_bought_on), or straight
away if it never was; "due soon" = within DUE_AHEAD days, so the family can
order before it runs out. Marking items bought (bought) restarts their cycle;
nothing is restocked blindly.

run_alerts (from the stock thread, app/stock.py) pushes "Maa's groceries: 6
items due this week" at most once every ALERT_EVERY days per parent while
something is due (parents.groceries_alerted_on), during the day.

The app's order sheet puts every due item into one Amazon cart in one tap (each
item's Amazon product, amazon_asin, is saved once: set_amazon), sends the whole
list to the local kirana on WhatsApp (parents.kirana_phone), walks through a
quick-commerce app that can't be filled from outside, or shares the list.
"""

from datetime import date, datetime, timedelta, timezone

from app.families import _one, _query
from app.stock import ALERT_HOURS, IST, asin_from

DUE_AHEAD = 3
ALERT_EVERY = 7
MAX_ITEMS = 60
COLS = "id, name, qty, every_days, last_bought_on, amazon_asin"


class NotFound(Exception):
    pass


def _today(now: datetime | None = None) -> date:
    return (now or datetime.now(timezone.utc)).astimezone(IST).date()


def view(row: dict, today: date) -> dict:
    last = row["last_bought_on"]
    due_on = last + timedelta(days=row["every_days"]) if last else today
    return {
        "id": row["id"],
        "name": row["name"],
        "qty": row["qty"],
        "every_days": row["every_days"],
        "last_bought_on": last.isoformat() if last else None,
        "due_on": due_on.isoformat(),
        "due": due_on <= today + timedelta(days=DUE_AHEAD),
        "overdue": due_on < today,
        "amazon_asin": row.get("amazon_asin"),
    }


def for_parent(phone: str, now: datetime | None = None) -> list[dict]:
    today = _today(now)
    rows = _query(f"SELECT {COLS} FROM grocery_items WHERE phone = %(p)s ORDER BY lower(name)", {"p": phone})
    items = [view(r, today) for r in rows]
    return sorted(items, key=lambda x: (not x["due"], x["due_on"], x["name"].lower()))


def _check_parent(family_id: int, phone: str) -> None:
    if not _one("SELECT 1 AS ok FROM parents WHERE phone = %(p)s AND family_id = %(f)s", {"p": phone, "f": family_id}):
        raise NotFound("Parent not found")


def add(family_id: int, phone: str, items: list[dict]) -> list[dict]:
    """Adds items (name, qty, every_days); an existing name is updated, not duplicated. New items are due now."""
    _check_parent(family_id, phone)
    have = _one("SELECT count(*) AS n FROM grocery_items WHERE phone = %(p)s", {"p": phone})["n"]
    if have + len(items) > MAX_ITEMS:
        raise ValueError(f"At most {MAX_ITEMS} items.")
    for it in items:
        _query(
            "INSERT INTO grocery_items (phone, name, qty, every_days) VALUES (%(p)s, %(n)s, %(q)s, %(e)s) "
            "ON CONFLICT (phone, lower(name)) DO UPDATE SET qty = EXCLUDED.qty, every_days = EXCLUDED.every_days, updated_at = now() "
            "RETURNING id",
            {"p": phone, "n": it["name"], "q": it.get("qty"), "e": it.get("every_days") or 30},
        )
    return for_parent(phone)


def _owned(family_id: int, item_id: int) -> dict:
    row = _one(
        "SELECT g.id, g.phone FROM grocery_items g JOIN parents p ON p.phone = g.phone WHERE g.id = %(i)s AND p.family_id = %(f)s",
        {"i": item_id, "f": family_id},
    )
    if not row:
        raise NotFound("Item not found")
    return row


def update(family_id: int, item_id: int, fields: dict) -> list[dict]:
    row = _owned(family_id, item_id)
    fields = {k: v for k, v in fields.items() if k in ("name", "qty", "every_days")}
    if fields:
        sets = ", ".join([*(f"{k} = %({k})s" for k in fields), "updated_at = now()"])
        _query(f"UPDATE grocery_items SET {sets} WHERE id = %(i)s RETURNING id", {**fields, "i": item_id})
    return for_parent(row["phone"])


def set_amazon(family_id: int, item_id: int, link: str | None) -> list[dict]:
    """Saves (or with no link, forgets) the item's Amazon product. A bad link raises stock.BadLink."""
    row = _owned(family_id, item_id)
    asin = asin_from(link) if link else None
    _query("UPDATE grocery_items SET amazon_asin = %(a)s, updated_at = now() WHERE id = %(i)s RETURNING id", {"a": asin, "i": item_id})
    return for_parent(row["phone"])


def delete(family_id: int, item_id: int) -> list[dict]:
    row = _owned(family_id, item_id)
    _query("DELETE FROM grocery_items WHERE id = %(i)s RETURNING id", {"i": item_id})
    return for_parent(row["phone"])


def bought(family_id: int, item_ids: list[int], now: datetime | None = None) -> list[dict]:
    """These were bought today: each starts its next cycle. Checks every id before changing any."""
    rows = [_owned(family_id, i) for i in item_ids]
    if not rows:
        return []
    _query("UPDATE grocery_items SET last_bought_on = %(d)s, updated_at = now() WHERE id = ANY(%(ids)s) RETURNING id",
           {"d": _today(now), "ids": item_ids})
    return for_parent(rows[0]["phone"], now)


# ---- the weekly nudge ----------------------------------------------------------------

def due_parents(now: datetime | None = None) -> list[dict]:
    """Parents with groceries due who weren't nudged in the last ALERT_EVERY days; claims them (atomic)."""
    today = _today(now)
    out = []
    for p in _query(
        "SELECT p.phone, p.parent_name FROM parents p WHERE p.family_id IS NOT NULL "
        "AND EXISTS (SELECT 1 FROM grocery_items g WHERE g.phone = p.phone) "
        "AND (p.groceries_alerted_on IS NULL OR p.groceries_alerted_on <= %(d)s)",
        {"d": today - timedelta(days=ALERT_EVERY)},
    ):
        due = [x for x in for_parent(p["phone"], now) if x["due"]]
        if not due:
            continue
        claimed = _query(
            "UPDATE parents SET groceries_alerted_on = %(t)s WHERE phone = %(p)s "
            "AND (groceries_alerted_on IS NULL OR groceries_alerted_on <= %(d)s) RETURNING phone",
            {"t": today, "p": p["phone"], "d": today - timedelta(days=ALERT_EVERY)},
        )
        if claimed:
            out.append({**p, "due": due})
    return out


def alert_text(p: dict) -> tuple[str, str]:
    n = len(p["due"])
    names = ", ".join(x["name"] for x in p["due"][:4]) + ("…" if n > 4 else "")
    return f"{p['parent_name']}'s groceries: {n} {'item' if n == 1 else 'items'} due this week", f"{names}. Tap to order."


def run_alerts(now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    if now.astimezone(IST).hour not in ALERT_HOURS:
        return 0
    from app import push  # push imports the scheduler, which imports app.me

    sent = 0
    for p in due_parents(now):
        tokens = push.tokens_for(p["phone"])
        if tokens:
            title, body = alert_text(p)
            push.send(tokens, title, body, {"screen": "groceries", "phone": p["phone"]})
            sent += 1
    return sent
