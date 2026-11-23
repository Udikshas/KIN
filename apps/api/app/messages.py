"""Tell my family: messages between a parent and their family, carried by Kin's calls.

Parent -> family: when a call ends, a message is kept if the agent wrote one in
`message_for_family` (optionally `message_to`: a family member's name), or, with
agents that don't have those yet, if the parent asked for a call back
(`wants_family_callback`). The family gets it as a push (app/push.py) and on
Today until someone marks it done.

Family -> parent: written in the app; family_variables (app/families.py) adds the
waiting ones to `family_context`, so Kin passes them on during the next call (also
when the parent calls Kin). They count as delivered after the next answered call.

Database failures raise ProfileError, like the rest of the data layer.
"""

from app.families import _one, _query
from app.parents import payload_source

MAX_TEXT = 300
MED_REMINDER = "med_reminder"  # app.reminders.SOURCE
PASS_ON_DAYS = 7  # a message nobody could deliver in a week is dropped from calls
PASS_ON_MAX = 3   # at most this many per call, oldest first


def record_from_call(phone: str, payload: dict) -> dict | None:
    """After a call's webhook is stored: keep the parent's message (once per call) and
    mark waiting family messages as passed on. Returns the parent's message, if any."""
    if payload.get("status") != "connected":
        return None
    key = payload.get("interaction_id") or payload.get("attempt_id")
    call = _one(
        "SELECT c.id, c.duration_s, p.family_id, p.parent_name FROM calls c JOIN parents p ON p.phone = c.phone "
        "WHERE coalesce(c.interaction_id, c.attempt_id) = %(k)s AND p.phone = %(p)s AND p.family_id IS NOT NULL "
        "ORDER BY c.id DESC LIMIT 1",
        {"k": key, "p": phone},
    )
    if not call:
        return None

    # Family messages written before this call started were in its context: passed on.
    # Only the ones to_pass_on put there; a medicine reminder call skips the family part.
    if payload_source(payload) != MED_REMINDER:
        _query(
            f"""
            UPDATE family_messages SET delivered_at = now() WHERE id IN (
                SELECT id FROM family_messages
                WHERE phone = %(p)s AND direction = 'to_parent' AND delivered_at IS NULL
                  AND created_at > now() - interval '{PASS_ON_DAYS} days'
                  AND created_at < now() - make_interval(secs => %(d)s)
                ORDER BY id LIMIT {PASS_ON_MAX}
            ) RETURNING id
            """,
            {"p": phone, "d": (call["duration_s"] or 0) + 30},
        )

    outputs = payload.get("output_agent_variables") or {}
    text = str(outputs.get("message_for_family") or "").strip()
    if not text and outputs.get("wants_family_callback") is True:
        text = "Please call me back."
    if not text:
        return None
    to_name = str(outputs.get("message_to") or "").strip() or None
    row = _query(
        "INSERT INTO family_messages (family_id, phone, direction, text, to_name, call_id) "
        "VALUES (%(f)s, %(p)s, 'from_parent', %(t)s, %(to)s, %(c)s) "
        "ON CONFLICT (call_id) WHERE direction = 'from_parent' DO NOTHING RETURNING id, text, to_name",
        {"f": call["family_id"], "p": phone, "t": text[:MAX_TEXT], "to": to_name, "c": call["id"]},
    )
    return {**row[0], "parent_name": call["parent_name"]} if row else None


def for_family(family_id: int, limit: int = 50) -> list[dict]:
    return _query(
        """
        SELECT m.id, m.phone, p.parent_name, m.direction, m.text, m.to_name, m.call_id, m.reply_to,
               m.created_at, m.done_at, m.delivered_at,
               sender.name AS from_name, doer.name AS done_by_name
        FROM family_messages m
        LEFT JOIN parents p ON p.phone = m.phone
        LEFT JOIN members sender ON sender.id = m.from_member_id
        LEFT JOIN members doer ON doer.id = m.done_by
        WHERE m.family_id = %(f)s ORDER BY m.created_at DESC, m.id DESC LIMIT %(n)s
        """,
        {"f": family_id, "n": limit},
    )


def get(family_id: int, message_id: int) -> dict | None:
    return _one("SELECT * FROM family_messages WHERE id = %(i)s AND family_id = %(f)s", {"i": message_id, "f": family_id})


def send_to_parent(family_id: int, member_id: int, phone: str, text: str, reply_to: int | None) -> dict:
    row = _query(
        "INSERT INTO family_messages (family_id, phone, direction, text, from_member_id, reply_to) "
        "VALUES (%(f)s, %(p)s, 'to_parent', %(t)s, %(m)s, %(r)s) RETURNING id, created_at",
        {"f": family_id, "p": phone, "t": text[:MAX_TEXT], "m": member_id, "r": reply_to},
    )
    if reply_to:  # answering a message deals with it
        mark_done(family_id, reply_to, member_id)
    return row[0]


def first_parent(family_id: int) -> str | None:
    """The family's first parent (the one the app shows), by phone."""
    row = _one("SELECT phone FROM parents WHERE family_id = %(f)s ORDER BY created_at LIMIT 1", {"f": family_id})
    return row["phone"] if row else None


def waiting_for_parent(phone: str) -> int:
    row = _one(
        "SELECT count(*) AS n FROM family_messages WHERE phone = %(p)s AND direction = 'to_parent' AND delivered_at IS NULL",
        {"p": phone},
    )
    return row["n"]


def mark_done(family_id: int, message_id: int, member_id: int) -> bool:
    return bool(_query(
        "UPDATE family_messages SET done_at = coalesce(done_at, now()), done_by = coalesce(done_by, %(m)s) "
        "WHERE id = %(i)s AND family_id = %(f)s AND direction = 'from_parent' RETURNING id",
        {"i": message_id, "f": family_id, "m": member_id},
    ))


def to_pass_on(phone: str) -> str | None:
    """The family's waiting messages, as a line for the agent's family_context."""
    rows = _query(
        f"""
        SELECT m.text, sender.name FROM family_messages m
        LEFT JOIN members sender ON sender.id = m.from_member_id
        WHERE m.phone = %(p)s AND m.direction = 'to_parent' AND m.delivered_at IS NULL
          AND m.created_at > now() - interval '{PASS_ON_DAYS} days'
        ORDER BY m.id LIMIT {PASS_ON_MAX}
        """,
        {"p": phone},
    )
    if not rows:
        return None
    said = "; ".join(f'{r["name"] or "The family"} says: "{r["text"]}"' for r in rows)
    return f"Messages from the family to pass on during this call: {said}"
