"""Kin's impact so far, as totals only (the website's /impact page).

Counts across every family and every Try-it call: no names, numbers, messages
or transcripts ever leave here, only sums. Unknown callers are left out.
"""

from datetime import datetime, timedelta, timezone

from app.families import _one, _query
from app.greetings import GREETINGS

IST = timezone(timedelta(hours=5, minutes=30))
DAYS = 14  # the daily chart


def _n(sql: str, params: dict | None = None) -> int:
    return int((_one(sql, params) or {}).get("n") or 0)


def summary(now: datetime | None = None) -> dict:
    now = (now or datetime.now(IST)).astimezone(IST)
    calls = _one(
        """
        SELECT count(*) AS total,
               count(*) FILTER (WHERE status = 'connected') AS answered,
               count(*) FILTER (WHERE status = 'connected' AND direction = 'inbound') AS inbound,
               count(*) FILTER (WHERE source = 'demo') AS demo,
               coalesce(sum(duration_s) FILTER (WHERE status = 'connected'), 0) AS seconds,
               count(*) FILTER (WHERE status = 'connected' AND outputs->>'pain_mentioned' = 'true') AS pain,
               count(*) FILTER (WHERE status = 'connected' AND outputs->>'meds_taken' IN ('some', 'none')) AS missed_meds,
               count(*) FILTER (WHERE status = 'connected' AND outputs->>'mood' IN ('low', 'distressed')) AS low_mood,
               min(created_at) AS first_at
        FROM calls WHERE caller_known
        """
    ) or {}
    answered = int(calls.get("answered") or 0)
    # Every call Kin dialled is in call_attempts, including ones Sarvam never reported
    # back on; calls only has the ones it did. Placed = dialled + parents calling in.
    dialled = _one(
        """
        SELECT count(*) AS n,
               count(*) FILTER (WHERE a.created_at < now() - interval '15 minutes') AS settled,
               count(*) FILTER (WHERE a.created_at < now() - interval '15 minutes' AND EXISTS (
                   SELECT 1 FROM calls c WHERE c.attempt_id = a.attempt_id AND c.status = 'connected')) AS settled_answered
        FROM call_attempts a
        """
    ) or {}
    inbound = _n("SELECT count(*) AS n FROM calls WHERE caller_known AND direction = 'inbound'")
    total = int(dialled.get("n") or 0) + inbound
    settled = int(dialled.get("settled") or 0)

    # Languages Kin opened calls in (a real language name, not the Try-it "Auto" instruction).
    languages = sorted({
        r["language"] for r in _query(
            "SELECT DISTINCT agent_variables->>'language' AS language FROM call_attempts WHERE agent_variables IS NOT NULL"
        ) if r["language"] in GREETINGS
    } | {
        r["language"] for r in _query("SELECT DISTINCT language FROM parents WHERE language IS NOT NULL")
        if r["language"] in GREETINGS
    })

    alerts = {r["kind"]: int(r["n"]) for r in _query("SELECT kind, count(*) AS n FROM urgent_events GROUP BY kind")}
    start = (now - timedelta(days=DAYS - 1)).date()
    ist_day = "(created_at AT TIME ZONE 'UTC' + interval '330 minutes')::date"
    since = {"s": start}
    placed_by_day = {r["day"]: int(r["n"]) for r in _query(
        f"""
        SELECT day, count(*) AS n FROM (
            SELECT {ist_day} AS day FROM call_attempts
            UNION ALL
            SELECT {ist_day} AS day FROM calls WHERE caller_known AND direction = 'inbound'
        ) x WHERE day >= %(s)s GROUP BY day
        """,
        since,
    )}
    answered_by_day = {r["day"]: int(r["n"]) for r in _query(
        f"SELECT {ist_day} AS day, count(*) AS n FROM calls WHERE caller_known AND status = 'connected' "
        f"AND {ist_day} >= %(s)s GROUP BY 1",
        since,
    )}
    daily = []
    for i in range(DAYS):
        d = start + timedelta(days=i)
        daily.append({"day": d.isoformat(), "calls": placed_by_day.get(d, 0), "answered": answered_by_day.get(d, 0)})

    first = calls.get("first_at")
    return {
        "families": _n("SELECT count(*) AS n FROM families f WHERE source = 'app' AND EXISTS (SELECT 1 FROM parents p WHERE p.family_id = f.id)"),
        "parents": _n("SELECT count(*) AS n FROM parents p JOIN families f ON f.id = p.family_id WHERE f.source = 'app'"),
        "consented": _n("SELECT count(*) AS n FROM parents WHERE consent_at IS NOT NULL"),
        "calls": total,
        "answered": answered,
        # Of the calls Kin dialled at least 15 minutes ago (a result can take that long to arrive).
        "answer_rate": round(int(dialled.get("settled_answered") or 0) / settled, 3) if settled else None,
        "minutes": round(int(calls.get("seconds") or 0) / 60),
        "inbound": int(calls.get("inbound") or 0),
        "demo_calls": int(calls.get("demo") or 0),
        "languages": languages,
        "noticed": {
            "pain": int(calls.get("pain") or 0),
            "missed_meds": int(calls.get("missed_meds") or 0),
            "low_mood": int(calls.get("low_mood") or 0),
        },
        "alerts": {"urgent": alerts.get("urgent", 0), "scam": alerts.get("scam", 0)},
        "messages": {
            "from_parents": _n("SELECT count(*) AS n FROM family_messages WHERE direction = 'from_parent'"),
            "to_parents": _n("SELECT count(*) AS n FROM family_messages WHERE direction = 'to_parent' AND delivered_at IS NOT NULL"),
        },
        "daily": daily,
        "since": first.astimezone(IST).date().isoformat() if first else None,
        "updated_at": now.isoformat(timespec="seconds"),
    }

