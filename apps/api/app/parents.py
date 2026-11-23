"""Parent profiles and call bookkeeping in Postgres.

Every write here is best effort: a call must never fail because the database
is down, so callers catch ProfileError and carry on.
"""

import json
import re

from app.db import DatabaseNotConfigured, pool

PROFILE_FIELDS = ("parent_name", "family_name", "language", "medicines", "health_notes", "emergency_number")


class ProfileError(Exception):
    pass


def normalize_phone(raw: str | None) -> str | None:
    """Return E.164, or None if the country can't be known.

    Indian numbers arrive as +91..., 91..., 0... or 10 digits. Anything else
    needs an explicit "+": "81234567" could be Singapore or a partial number,
    so it is not guessed.
    """
    if not raw:
        return None
    digits = re.sub(r"[^\d+]", "", raw)
    if re.fullmatch(r"\+[1-9]\d{7,14}", digits):
        return digits
    digits = digits.lstrip("+")
    if re.fullmatch(r"0?[6-9]\d{9}", digits):
        return "+91" + digits[-10:]
    if re.fullmatch(r"91[6-9]\d{9}", digits):
        return "+" + digits
    return None


def _run(sql: str, params: dict, fetch: bool = False):
    try:
        with pool().connection() as conn:
            cur = conn.execute(sql, params)
            return cur.fetchone() if fetch else None
    except DatabaseNotConfigured as e:
        raise ProfileError(str(e)) from e
    except Exception as e:  # connection or query failure
        raise ProfileError(f"{type(e).__name__}: {e}") from e


def remember_call(phone: str, variables: dict, attempt_id: str, source: str, sent: dict | None = None) -> None:
    """After an outbound call is placed: keep the profile and the attempt (with the variables sent)."""
    profile = {k: variables.get(k) or None for k in PROFILE_FIELDS}
    profile["phone"] = phone
    _run(
        """
        INSERT INTO parents (phone, parent_name, family_name, language, medicines, health_notes, emergency_number)
        VALUES (%(phone)s, %(parent_name)s, %(family_name)s, %(language)s, %(medicines)s, %(health_notes)s, %(emergency_number)s)
        ON CONFLICT (phone) DO UPDATE SET
            parent_name = EXCLUDED.parent_name,
            family_name = COALESCE(EXCLUDED.family_name, parents.family_name),
            language = COALESCE(EXCLUDED.language, parents.language),
            medicines = COALESCE(EXCLUDED.medicines, parents.medicines),
            health_notes = COALESCE(EXCLUDED.health_notes, parents.health_notes),
            emergency_number = COALESCE(EXCLUDED.emergency_number, parents.emergency_number),
            updated_at = now()
        """,
        profile,
    )
    _run(
        "INSERT INTO call_attempts (attempt_id, phone, source, agent_variables) "
        "VALUES (%(a)s, %(p)s, %(s)s, %(v)s) ON CONFLICT DO NOTHING",
        {"a": attempt_id, "p": phone, "s": source, "v": json.dumps(sent if sent is not None else variables)},
    )


def placed_recently(phone: str, seconds: int = 180) -> bool:
    """True if Kin dialled this number in the last few minutes (an outbound call starting)."""
    row = _run(
        "SELECT 1 FROM call_attempts WHERE phone = %(p)s AND created_at > now() - make_interval(secs => %(s)s) LIMIT 1",
        {"p": phone, "s": seconds},
        fetch=True,
    )
    return row is not None


def has_consented(phone: str) -> bool:
    """True once the parent has said yes to Kin's calls (consent_at, from a call's consent_given)."""
    row = _run("SELECT consent_at IS NOT NULL FROM parents WHERE phone = %(p)s", {"p": phone}, fetch=True)
    return bool(row and row[0])


def phone_for_attempt(attempt_id: str) -> str | None:
    row = _run("SELECT phone FROM call_attempts WHERE attempt_id = %(a)s", {"a": attempt_id}, fetch=True)
    return row[0] if row else None


def get_profile(phone: str) -> dict | None:
    row = _run(
        "SELECT parent_name, family_name, language, medicines, health_notes, emergency_number, last_call_summary "
        "FROM parents WHERE phone = %(p)s",
        {"p": phone},
        fetch=True,
    )
    if not row:
        return None
    return dict(zip((*PROFILE_FIELDS, "last_call_summary"), row))


def record_call(phone: str, payload: dict, caller_known: bool = True, received_at: str | None = None) -> None:
    """Keep every finished call. Only caller_known calls become context (see app.context)."""
    outputs = payload.get("output_agent_variables") or {}
    status = payload.get("status") or ("connected" if payload.get("deployment_id") else None)
    _run(
        """
        INSERT INTO calls (phone, direction, attempt_id, interaction_id, status, duration_s, summary, outputs,
                           failure_reason, source, caller_known, created_at)
        VALUES (%(phone)s, %(direction)s, %(attempt)s, %(interaction)s, %(status)s, %(duration)s, %(summary)s, %(outputs)s,
                %(failure)s, %(source)s, %(known)s, coalesce(%(created)s::timestamptz, now()))
        ON CONFLICT ((coalesce(interaction_id, attempt_id))) DO NOTHING
        """,
        {
            "phone": phone,
            "direction": "inbound" if payload.get("deployment_id") else "outbound",
            "attempt": payload.get("attempt_id"),
            "interaction": payload.get("interaction_id"),
            "status": status,
            "duration": round(payload.get("duration") or 0),
            "summary": outputs.get("call_summary"),
            "outputs": json.dumps(outputs),
            "failure": payload.get("failure_reason"),
            "source": payload_source(payload),
            "known": caller_known,
            "created": received_at,
        },
    )


def payload_source(payload: dict) -> str | None:
    """Who placed the call (demo, place_call.py, ...) or "inbound" for the deployment."""
    metadata = (payload.get("webhook_config") or {}).get("metadata") or payload.get("metadata") or {}
    return metadata.get("source") or ("inbound" if payload.get("deployment_id") else None)


def store_event(payload: dict, phone: str | None) -> None:
    """Every webhook delivery, as received (token already removed)."""
    _run(
        """
        INSERT INTO webhook_events (kind, source, attempt_id, interaction_id, phone, status, payload)
        VALUES (%(kind)s, %(source)s, %(attempt)s, %(interaction)s, %(phone)s, %(status)s, %(payload)s)
        """,
        {
            "kind": "inbound" if payload.get("deployment_id") else "outbound",
            "source": payload_source(payload),
            "attempt": payload.get("attempt_id"),
            "interaction": payload.get("interaction_id"),
            "phone": phone,
            "status": payload.get("status"),
            "payload": json.dumps(payload, ensure_ascii=False),
        },
    )


def event_for_attempt(attempt_id: str) -> dict | None:
    """The latest webhook payload stored for this attempt."""
    row = _run(
        "SELECT payload FROM webhook_events WHERE attempt_id = %(a)s ORDER BY id DESC LIMIT 1",
        {"a": attempt_id},
        fetch=True,
    )
    return row[0] if row else None


def attempt_info(attempt_id: str, source: str) -> dict | None:
    """When and to whom this attempt was placed, with the variables sent, or None."""
    row = _run(
        "SELECT created_at, phone, agent_variables FROM call_attempts WHERE attempt_id = %(a)s AND source = %(s)s",
        {"a": attempt_id, "s": source},
        fetch=True,
    )
    return {"created_at": row[0], "phone": row[1], "variables": row[2] or {}} if row else None


def demo_usage(source: str, since: str | None) -> dict:
    """Minutes used by finished calls from `source`, and minutes held by calls with no result yet.

    A finished call counts each started minute (Sarvam bills per started
    minute; unanswered calls count 0). A call with no webhook yet holds its
    chosen length plus one minute, since the agent may run a little over.
    """
    row = _run(
        """
        WITH a AS (
            SELECT ca.attempt_id,
                   coalesce(nullif(ca.agent_variables->>'call_length_minutes', '')::int, 5) AS minutes,
                   (SELECT we.payload FROM webhook_events we
                     WHERE we.attempt_id = ca.attempt_id ORDER BY we.id DESC LIMIT 1) AS p
            FROM call_attempts ca
            WHERE ca.source = %(s)s AND ca.created_at >= coalesce(%(since)s::timestamptz, '-infinity')
        )
        SELECT coalesce(sum(CASE WHEN p IS NOT NULL THEN ceil(coalesce((p->>'duration')::numeric, 0) / 60) END), 0)::int,
               coalesce(sum(CASE WHEN p IS NULL THEN minutes + 1 END), 0)::int,
               coalesce(array_agg(attempt_id), '{}')
        FROM a
        """,
        {"s": source, "since": since},
        fetch=True,
    )
    return {"used_min": row[0], "held_min": row[1], "attempts": set(row[2])}


def save_summary(phone: str, summary: str, at: str | None = None) -> None:
    """Memory for the next call: the latest connected call's summary.

    `at` is when the call happened (old payloads loaded by app.import_calls);
    an older call never replaces a newer summary.
    """
    _run(
        """
        UPDATE parents SET last_call_summary = %(s)s, last_call_at = coalesce(%(at)s::timestamptz, now()), updated_at = now()
        WHERE phone = %(p)s AND (last_call_at IS NULL OR last_call_at <= coalesce(%(at)s::timestamptz, now()))
        """,
        {"s": summary[:1000], "p": phone, "at": at},
    )
