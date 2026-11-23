"""The Kin app's view of the data: the signed-in user's family and its calls.

A SuperTokens user is linked to one `members` row (members.user_id):
- creating a family from the app makes them its owner;
- a member added with an email (from the app or /families) is an invite: the
  first time that email signs in, the row is claimed for that user.

A user only ever sees their own family. Parents are keyed by phone and carry
call history, so a family may only take a parent number that is new to Kin
(or already theirs); numbers in another family, or with past calls, need an
invite from that family. Without this anyone could type a number in and read
that parent's call summaries.

Like app.families, database failures raise ProfileError; routes turn it into a 503.
"""

import json
from datetime import datetime, timedelta, timezone

from app.context import build_context
from app.db import DatabaseNotConfigured, pool
from app.families import _one, _query
from app.parents import ProfileError
from app.urgent import open_event

MEMBER_COLS = "id, family_id, name, relation, phone, city, notes, is_emergency, email, role, user_id, avatar"
PARENT_COLS = (
    "phone, parent_name, family_name, language, medicines, health_notes, emergency_number, about, "
    "topics_avoid, consent_at, last_call_summary, last_call_at, city, call_time, call_length_minutes, daily_calls, avatar, chemist_phone, kirana_phone"
)
APP_PARENT_FIELDS = (
    "parent_name", "family_name", "language", "medicines", "health_notes", "emergency_number",
    "about", "topics_avoid", "city", "call_time", "call_length_minutes", "daily_calls", "avatar", "chemist_phone", "kirana_phone",
)
APP_MEMBER_FIELDS = ("name", "relation", "phone", "city", "notes", "is_emergency", "email", "avatar")
IST = timezone(timedelta(hours=5, minutes=30))  # India has no daylight saving


class NotAllowed(Exception):
    """The request is understood but would touch data outside the user's family."""


def member_out(m: dict) -> dict:
    m = dict(m)
    m["linked"] = m.pop("user_id", None) is not None
    return m


# ---- who is signed in ---------------------------------------------------------

def membership(user_id: str, email: str | None) -> dict | None:
    """The user's member row, claiming an invite by email on first sign-in."""
    row = _one(f"SELECT {MEMBER_COLS} FROM members WHERE user_id = %(u)s ORDER BY id LIMIT 1", {"u": user_id})
    if row or not email:
        return row
    return _one(
        f"""
        UPDATE members SET user_id = %(u)s, updated_at = now()
        WHERE id = (SELECT id FROM members WHERE user_id IS NULL AND lower(email) = lower(%(e)s) ORDER BY id LIMIT 1)
        RETURNING {MEMBER_COLS}
        """,
        {"u": user_id, "e": email},
    )


# ---- reading --------------------------------------------------------------------

def family_view(family_id: int) -> dict:
    from app import groceries, reminders, stock  # reminders imports this module
    family = _one("SELECT id, name, context FROM families WHERE id = %(f)s", {"f": family_id})
    members = _query(f"SELECT {MEMBER_COLS} FROM members WHERE family_id = %(f)s ORDER BY id", {"f": family_id})
    parents = _query(f"SELECT {PARENT_COLS} FROM parents WHERE family_id = %(f)s ORDER BY created_at", {"f": family_id})
    for p in parents:
        # What Kin will follow up on next call, from the same code the call uses.
        p["open_threads"] = build_context(p["phone"]).get("open_threads")
        p["daily"] = daily_status(p["phone"], p["daily_calls"], p["call_time"])
        p["urgent"] = open_event(p["phone"])  # an emergency Kin heard and nobody has handled yet
        p["reminders"] = reminders.for_parent(p["phone"])  # medicine reminder calls, with today's result
        p["medicine"] = reminders.history(p["phone"])  # 30-day medicine calendar and streak
        p["stock"] = stock.for_parent(p["phone"])  # tablets left per medicine, days until they run out
        p["products"] = stock.products_for(p["phone"])  # each medicine's Amazon product, for one-tap cart
        p["groceries"] = groceries.for_parent(p["phone"])  # monthly groceries, due ones first
        p["alert"] = parent_alert(recent_calls(family_id, p["phone"], days=10, limit=30))
    return {"family": family, "members": [member_out(m) for m in members], "parents": parents}


def daily_status(phone: str, daily_calls: bool, call_time: str | None, now: datetime | None = None) -> dict | None:
    """Tonight's daily call, for the app. None when daily calls are off.

    state: scheduled (at = next call), calling, retrying (at = next try, if planned),
    answered, missed (no answer after every try), failed (couldn't be placed);
    `next` is the next evening's call once tonight is over. Mirrors app/scheduler.py.
    """
    if not daily_calls or not call_time:
        return None
    now = now or datetime.now(timezone.utc)
    today = now.astimezone(IST).date()
    try:
        h, m = (int(x) for x in call_time.split(":"))
    except ValueError:
        return None
    due = datetime(today.year, today.month, today.day, h, m, tzinfo=IST)
    nxt = due + timedelta(days=1)
    jobs = _query(
        """
        SELECT j.try, j.status, j.note, j.due_at,
               (SELECT status FROM webhook_events WHERE attempt_id = j.attempt_id ORDER BY id DESC LIMIT 1) AS result
        FROM call_jobs j WHERE j.phone = %(p)s AND j.day = %(d)s ORDER BY j.try
        """,
        {"p": phone, "d": today},
    )
    iso = lambda t: t.isoformat() if t else None  # noqa: E731
    if not jobs:
        # Not planned yet: tonight if still in time (the scheduler allows 2 h), else tomorrow.
        return {"state": "scheduled", "at": iso(due if now < due + timedelta(hours=2) else nxt)}
    if any(j["result"] == "connected" for j in jobs) or any("talked" in (j["note"] or "") for j in jobs):
        return {"state": "answered", "next": iso(nxt)}
    last = jobs[-1]
    tries = last["try"] + 1
    if last["status"] == "pending":
        state = "scheduled" if last["try"] == 0 else "retrying"
        return {"state": state, "at": iso(last["due_at"]), "tries": last["try"]}
    if last["status"] in ("placing", "placed") and not last["result"]:
        return {"state": "calling", "tries": tries}
    if last["status"] == "placed":  # answered was handled above, so nobody picked up
        from app.scheduler import MAX_RETRIES  # noqa: PLC0415 (scheduler imports this module)

        if last["try"] < MAX_RETRIES:
            return {"state": "retrying", "at": None, "tries": tries}
        return {"state": "missed", "tries": tries, "next": iso(nxt)}
    if last["status"] == "failed":
        return {"state": "failed", "next": iso(nxt)}
    return {"state": "scheduled", "at": iso(nxt)}  # skipped (switched off and on again)


def recent_calls(family_id: int, phone: str | None = None, days: int = 90, limit: int = 200) -> list[dict]:
    rows = _query(
        """
        SELECT c.id, c.phone, c.direction, c.status, c.duration_s, c.summary, c.outputs, c.failure_reason, c.created_at,
               c.insight, c.source
        FROM calls c JOIN parents p ON p.phone = c.phone
        WHERE p.family_id = %(f)s AND c.caller_known AND (%(p)s::text IS NULL OR c.phone = %(p)s)
          AND c.created_at > now() - make_interval(days => %(d)s)
        ORDER BY c.created_at DESC LIMIT %(n)s
        """,
        {"f": family_id, "p": phone, "d": days, "n": limit},
    )
    for r in rows:
        r["outputs"] = _json(r["outputs"]) or {}
        r["signal"] = call_signal(r["status"], r["outputs"])
    return rows


def call_detail(family_id: int, call_id: int) -> dict | None:
    row = _one(
        """
        SELECT c.id, c.phone, c.direction, c.status, c.duration_s, c.summary, c.outputs, c.failure_reason,
               c.created_at, c.insight, c.source
        FROM calls c JOIN parents p ON p.phone = c.phone
        WHERE c.id = %(c)s AND p.family_id = %(f)s AND c.caller_known
        """,
        {"c": call_id, "f": family_id},
    )
    if not row:
        return None
    row["outputs"] = _json(row["outputs"]) or {}
    row["signal"] = call_signal(row["status"], row["outputs"])
    return row


def _json(v):
    return json.loads(v) if isinstance(v, str) else v


# ---- signals --------------------------------------------------------------------

def call_signal(status: str | None, o: dict) -> str | None:
    """green / amber / red for one call, the same rule as the Try-it evening card."""
    if status != "connected":
        return None
    if o.get("urgent_flag") is True or o.get("mood") == "distressed":
        return "red"
    if o.get("pain_mentioned") is True or o.get("meds_taken") in ("some", "none") or o.get("mood") == "low":
        return "amber"
    return "green"


def parent_alert(calls: list[dict]) -> dict | None:
    """The family-level alert from the last few calls (newest first), or None.

    red:   the last call was red, or the last 3 days with calls had no answered call
           (days, not calls: the scheduler retries up to twice an evening);
    amber: 3 of the last 5 answered calls were amber or worse.
    A first version of the signal engine; 30-day baselines come later.
    """
    if not calls:
        return None
    last = calls[0]
    if last["signal"] == "red":
        return {"level": "red", "reason": "urgent", "call_id": last["id"]}
    days: list[list] = []  # [IST date, answered], newest first
    for c in calls:
        day = c["created_at"].astimezone(IST).date()
        if not days or days[-1][0] != day:
            days.append([day, False])
        days[-1][1] = days[-1][1] or c["status"] == "connected"
    if len(days) >= 3 and not any(answered for _, answered in days[:3]):
        return {"level": "red", "reason": "no_answer", "call_id": last["id"]}
    answered = [c for c in calls if c["status"] == "connected"][:5]
    flagged = [c for c in answered if c["signal"] in ("amber", "red")]
    if len(flagged) >= 3:
        o = [c["outputs"] for c in answered]
        return {
            "level": "amber",
            "reason": "trend",
            "call_id": flagged[0]["id"],
            "calls": len(answered),
            "pain_days": sum(1 for x in o if x.get("pain_mentioned") is True),
            "missed_meds": sum(1 for x in o if x.get("meds_taken") in ("some", "none")),
            "low_mood": sum(1 for x in o if x.get("mood") in ("low", "distressed")),
        }
    return None


# ---- push tokens ----------------------------------------------------------------

def save_push_token(user_id: str, family_id: int, token: str, platform: str | None) -> None:
    """This phone gets the family's pushes (a token moves with whoever signed in last)."""
    _query(
        "INSERT INTO push_tokens (token, user_id, family_id, platform) VALUES (%(t)s, %(u)s, %(f)s, %(p)s) "
        "ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, family_id = EXCLUDED.family_id, "
        "platform = EXCLUDED.platform, updated_at = now() RETURNING token",
        {"t": token, "u": user_id, "f": family_id, "p": platform},
    )


def delete_push_token(user_id: str, token: str) -> None:
    _query("DELETE FROM push_tokens WHERE token = %(t)s AND user_id = %(u)s RETURNING token", {"t": token, "u": user_id})


# ---- "call now" ----------------------------------------------------------------

def call_target(family_id: int, phone: str) -> dict | None:
    """The parent's profile for placing a call, if the number is in this family."""
    return _one(
        "SELECT phone, parent_name, family_name, language, medicines, health_notes, emergency_number, "
        "call_length_minutes FROM parents WHERE phone = %(p)s AND family_id = %(f)s",
        {"p": phone, "f": family_id},
    )


def call_variables(parent: dict) -> dict[str, str]:
    """Agent variables for a daily check-in from a parents row (call_target's columns).

    place_outbound adds memory, open threads and family context on top.
    """
    variables = {
        "parent_name": parent["parent_name"],
        "call_mode": "daily",
        "call_length_minutes": str(parent["call_length_minutes"] or 3),
    }
    for key in ("family_name", "language", "medicines", "health_notes", "emergency_number"):
        if parent.get(key):
            variables[key] = parent[key]
    return variables


def member_callee(family_id: int, member_id: int) -> dict | None:
    """A family member Kin may be asked to call: their name and phone."""
    return _one(
        "SELECT id, name, phone FROM members WHERE id = %(m)s AND family_id = %(f)s",
        {"m": member_id, "f": family_id},
    )


def ensure_callee(family_id: int, phone: str, name: str) -> None:
    """Make a family member someone Kin checks in on, so the call, its memory and
    transcript are kept under their own number (not mixed into the parent's).

    Same rule as adding a parent: the number must be new to Kin or already this
    family's; otherwise past transcripts of that number would become readable here.
    """
    try:
        with _tx() as conn, conn.transaction():
            row = conn.execute("SELECT family_id FROM parents WHERE phone = %(p)s", {"p": phone}).fetchone()
            if row and row[0] == family_id:
                return  # already theirs (or the parent): keep the profile as it is
            _check_parent_free(conn, phone, family_id)
            _upsert_parent(conn, family_id, phone, {"parent_name": name})
    except NotAllowed:
        raise
    except Exception as e:
        raise ProfileError(f"{type(e).__name__}: {e}") from e


def last_attempt(phone: str) -> dict | None:
    """The newest call Kin placed to this number from anywhere, and whether its result arrived."""
    return _one(
        """
        SELECT ca.attempt_id, ca.created_at,
               EXISTS (SELECT 1 FROM webhook_events we WHERE we.attempt_id = ca.attempt_id) AS finished
        FROM call_attempts ca WHERE ca.phone = %(p)s ORDER BY ca.created_at DESC LIMIT 1
        """,
        {"p": phone},
    )


def app_calls_today(family_id: int, source: str) -> int:
    """Calls this family asked for from the app since midnight in India."""
    row = _one(
        """
        SELECT count(*) AS n FROM call_attempts ca JOIN parents p ON p.phone = ca.phone
        WHERE p.family_id = %(f)s AND ca.source = %(s)s
          -- midnight IST (UTC+5:30, no daylight saving), without needing the tz database
          AND ca.created_at >= (date_trunc('day', (now() AT TIME ZONE 'UTC') + interval '330 minutes')
                                - interval '330 minutes') AT TIME ZONE 'UTC'
        """,
        {"f": family_id, "s": source},
    )
    return row["n"]


def attempt_view(family_id: int, attempt_id: str, source: str) -> dict | None:
    """A call this family asked for: when, to whom, and the saved call once its result is in."""
    return _one(
        """
        SELECT ca.attempt_id, ca.phone, ca.created_at,
               EXISTS (SELECT 1 FROM webhook_events we WHERE we.attempt_id = ca.attempt_id) AS finished,
               c.id AS call_id, c.status
        FROM call_attempts ca
        JOIN parents p ON p.phone = ca.phone AND p.family_id = %(f)s
        LEFT JOIN LATERAL (
            SELECT id, status FROM calls WHERE attempt_id = ca.attempt_id ORDER BY id DESC LIMIT 1
        ) c ON true
        WHERE ca.attempt_id = %(a)s AND ca.source = %(s)s
        """,
        {"f": family_id, "a": attempt_id, "s": source},
    )


# ---- writing --------------------------------------------------------------------

def _tx():
    try:
        return pool().connection()
    except DatabaseNotConfigured as e:
        raise ProfileError(str(e)) from e


def _check_parent_free(conn, phone: str, family_id: int | None) -> None:
    row = conn.execute(
        "SELECT family_id, EXISTS (SELECT 1 FROM calls WHERE phone = %(p)s AND caller_known) "
        "FROM parents WHERE phone = %(p)s FOR UPDATE",
        {"p": phone},
    ).fetchone()
    if not row:
        return
    owner, has_calls = row
    if family_id is not None and owner == family_id:
        return
    if owner is None and not has_calls:
        return
    raise NotAllowed("This number is already set up with Kin. Ask that family to invite you.")


def _upsert_parent(conn, family_id: int, phone: str, fields: dict) -> None:
    fields = {k: v for k, v in fields.items() if k in APP_PARENT_FIELDS}
    cols = ["phone", "family_id", *fields]
    updates = ", ".join(["family_id = EXCLUDED.family_id", *(f"{k} = EXCLUDED.{k}" for k in fields), "updated_at = now()"])
    conn.execute(
        f"INSERT INTO parents ({', '.join(cols)}) VALUES ({', '.join(f'%({c})s' for c in cols)}) "
        f"ON CONFLICT (phone) DO UPDATE SET {updates}",
        {**fields, "phone": phone, "family_id": family_id},
    )


def create_family(user_id: str, email: str | None, name: str, me: dict, parent_phone: str, parent: dict) -> int:
    """New family from the app: the user becomes its owner, with their first parent."""
    try:
        with _tx() as conn, conn.transaction():
            if conn.execute("SELECT 1 FROM members WHERE user_id = %(u)s", {"u": user_id}).fetchone():
                raise NotAllowed("You already belong to a family.")
            _check_parent_free(conn, parent_phone, None)
            family_id = conn.execute(
                "INSERT INTO families (name, source) VALUES (%(n)s, 'app') RETURNING id", {"n": name}
            ).fetchone()[0]
            conn.execute(
                "INSERT INTO members (family_id, name, relation, phone, city, email, role, user_id) "
                "VALUES (%(f)s, %(name)s, %(relation)s, %(phone)s, %(city)s, %(e)s, 'owner', %(u)s)",
                {"f": family_id, "e": email, "u": user_id, **{k: me.get(k) for k in ("name", "relation", "phone", "city")}},
            )
            _upsert_parent(conn, family_id, parent_phone, parent)
            return family_id
    except (NotAllowed, ProfileError):
        raise
    except Exception as e:
        raise ProfileError(f"{type(e).__name__}: {e}") from e


def put_parent(family_id: int, phone: str, fields: dict) -> None:
    try:
        with _tx() as conn, conn.transaction():
            _check_parent_free(conn, phone, family_id)
            _upsert_parent(conn, family_id, phone, fields)
    except (NotAllowed, ProfileError):
        raise
    except Exception as e:
        raise ProfileError(f"{type(e).__name__}: {e}") from e


# Every table that files rows under a parent's number (see app/db.py).
PARENT_PHONE_TABLES = (
    "calls", "call_attempts", "webhook_events", "call_jobs", "family_messages", "urgent_events",
    "med_reminders", "med_jobs", "medicine_stock", "grocery_items", "medicine_products", "ivr_calls",
)


def change_parent_phone(family_id: int, old: str, new: str) -> None:
    """A parent's number changed (new SIM, or a typo): move them and everything Kin keeps
    about them (calls, memory, reminders, stock, groceries, messages) to the new number."""
    if old == new:
        return
    try:
        with _tx() as conn, conn.transaction():
            row = conn.execute("SELECT family_id FROM parents WHERE phone = %(p)s FOR UPDATE", {"p": old}).fetchone()
            if not row or row[0] != family_id:
                raise NotAllowed("That parent isn't in your family.")
            taken = conn.execute("SELECT family_id FROM parents WHERE phone = %(p)s", {"p": new}).fetchone()
            if taken and taken[0] == family_id:
                raise NotAllowed("That number is already one of your parents.")
            _check_parent_free(conn, new, family_id)
            if taken:  # a leftover row with no family and no calls (e.g. a number tried once)
                conn.execute("DELETE FROM parents WHERE phone = %(p)s", {"p": new})
            conn.execute(
                "INSERT INTO parents SELECT (jsonb_populate_record(NULL::parents, to_jsonb(p) || jsonb_build_object('phone', %(new)s::text))).* "
                "FROM parents p WHERE phone = %(old)s",
                {"old": old, "new": new},
            )
            for table in PARENT_PHONE_TABLES:
                conn.execute(f"UPDATE {table} SET phone = %(new)s WHERE phone = %(old)s", {"old": old, "new": new})
            conn.execute("UPDATE parents SET updated_at = now() WHERE phone = %(p)s", {"p": new})
            conn.execute("DELETE FROM parents WHERE phone = %(p)s", {"p": old})
    except (NotAllowed, ProfileError):
        raise
    except Exception as e:
        raise ProfileError(f"{type(e).__name__}: {e}") from e


def update_family(family_id: int, fields: dict) -> None:
    fields = {k: v for k, v in fields.items() if k in ("name", "context")}
    if fields:
        _query(
            f"UPDATE families SET {', '.join(f'{k} = %({k})s' for k in fields)}, updated_at = now() WHERE id = %(f)s",
            {**fields, "f": family_id},
        )


def save_member(family_id: int, member_id: int | None, fields: dict) -> dict | None:
    """Add (member_id None) or update a member. One emergency contact per family."""
    fields = {k: v for k, v in fields.items() if k in APP_MEMBER_FIELDS}
    try:
        with _tx() as conn, conn.transaction():
            if fields.get("is_emergency"):
                conn.execute(
                    "UPDATE members SET is_emergency = false, updated_at = now() WHERE family_id = %(f)s AND is_emergency",
                    {"f": family_id},
                )
            if member_id is None:
                cols = ["family_id", *fields]
                cur = conn.execute(
                    f"INSERT INTO members ({', '.join(cols)}) VALUES ({', '.join(f'%({c})s' for c in cols)}) RETURNING {MEMBER_COLS}",
                    {**fields, "family_id": family_id},
                )
            else:
                sets = ", ".join([*(f"{k} = %({k})s" for k in fields), "updated_at = now()"])
                cur = conn.execute(
                    f"UPDATE members SET {sets} WHERE id = %(m)s AND family_id = %(f)s RETURNING {MEMBER_COLS}",
                    {**fields, "m": member_id, "f": family_id},
                )
            row = cur.fetchone()
            if not row:
                return None
            return member_out(dict(zip([c.name for c in cur.description], row)))
    except Exception as e:
        raise ProfileError(f"{type(e).__name__}: {e}") from e


def delete_member(family_id: int, member_id: int, own_id: int) -> bool:
    if member_id == own_id:
        raise NotAllowed("You can't remove yourself.")
    return bool(_query("DELETE FROM members WHERE id = %(m)s AND family_id = %(f)s RETURNING id",
                       {"m": member_id, "f": family_id}))


# ---- deleting -------------------------------------------------------------------

# Everything Kin keeps under a parent's number (family_messages, urgent_events,
# members and push_tokens go with the family row: ON DELETE CASCADE).
_PHONE_TABLES = ("calls", "call_attempts", "webhook_events", "call_jobs", "urgent_events", "family_messages")


def delete_account(user_id: str) -> dict:
    """Settings → Delete my account.

    The owner deletes the whole family: every parent's profile, calls,
    transcripts, raw webhooks, planned calls, messages and alerts, every
    member and every phone's push token. Anyone else just leaves: their member
    row and push tokens go, the family stays. The caller removes the sign-in
    itself (SuperTokens) afterwards.
    """
    try:
        with _tx() as conn, conn.transaction():
            conn.execute("DELETE FROM push_tokens WHERE user_id = %(u)s", {"u": user_id})
            row = conn.execute(
                "SELECT id, family_id, role FROM members WHERE user_id = %(u)s ORDER BY id LIMIT 1", {"u": user_id}
            ).fetchone()
            if not row:
                return {"deleted": "account"}
            member_id, family_id, role = row
            if role != "owner":
                conn.execute("DELETE FROM members WHERE id = %(m)s", {"m": member_id})
                return {"deleted": "membership"}
            phones = [r[0] for r in conn.execute("SELECT phone FROM parents WHERE family_id = %(f)s", {"f": family_id})]
            for table in _PHONE_TABLES:
                conn.execute(f"DELETE FROM {table} WHERE phone = ANY(%(p)s)", {"p": phones})
            conn.execute("DELETE FROM parents WHERE family_id = %(f)s", {"f": family_id})
            conn.execute("DELETE FROM families WHERE id = %(f)s", {"f": family_id})
            return {"deleted": "family", "parents": len(phones)}
    except Exception as e:
        raise ProfileError(f"{type(e).__name__}: {e}") from e
