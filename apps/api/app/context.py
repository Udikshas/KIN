"""What Kin should know at the start of a call: time of day and recent history.

build_context(phone) turns the last few calls into two agent variables:
- memory_summary: short dated notes ("Yesterday: ...", "3 days ago: ...")
- open_threads:   things to follow up (pain, missed medicines, requests, concerns)
and adds the family and per-person context from app.families (family_context,
about_parent, topics_avoid). All stay small, because they go into the agent's
prompt on every call.
"""

import json
import re
from datetime import datetime, timedelta, timezone

from app.db import pool
from app.families import family_variables
from app.parents import ProfileError

IST = timezone(timedelta(hours=5, minutes=30))
HISTORY_CALLS = 5


def time_of_day(now: datetime | None = None) -> str:
    hour = (now or datetime.now(IST)).astimezone(IST).hour
    if 5 <= hour < 12:
        return "morning"
    if 12 <= hour < 17:
        return "afternoon"
    if 17 <= hour < 21:
        return "evening"
    return "night"


def _when(created: datetime, today) -> str:
    days = (today - created.astimezone(IST).date()).days
    if days <= 0:
        return "Earlier today"
    if days == 1:
        return "Yesterday"
    if days < 7:
        return f"{days} days ago"
    return created.astimezone(IST).strftime("On %d %b")


def build_context(phone: str) -> dict[str, str]:
    """History plus family context. Returns {} when there is nothing or the database is unavailable."""
    try:
        context = family_variables(phone)
    except ProfileError as e:  # never block a call on context
        print(f"context: family context unavailable ({e})")
        context = {}
    return {**context, **_history(phone)}


def _history(phone: str) -> dict[str, str]:
    try:
        with pool().connection() as conn:
            rows = conn.execute(
                "SELECT created_at, direction, summary, outputs FROM calls "
                "WHERE phone = %(p)s AND status = 'connected' AND caller_known ORDER BY created_at DESC LIMIT %(n)s",
                {"p": phone, "n": HISTORY_CALLS},
            ).fetchall()
    except Exception as e:  # includes DatabaseNotConfigured; never block a call on history
        print(f"context: history unavailable ({type(e).__name__})")
        return {}
    if not rows:
        return {}

    today = datetime.now(IST).date()
    notes, threads = [], []
    for i, (created, direction, summary, outputs) in enumerate(rows):
        out = outputs if isinstance(outputs, dict) else json.loads(outputs or "{}")
        when = _when(created, today)
        if summary:
            prefix = f"{when} ({'they called Kin' if direction == 'inbound' else 'Kin called'})"
            notes.append(f"{prefix}: {summary}")
        # Only the most recent call's loose ends become follow-ups.
        if i == 0:
            if out.get("pain_mentioned") is True:
                threads.append(f"pain{(' in ' + out['pain_location']) if out.get('pain_location') else ''} ({when.lower()})")
            if out.get("meds_taken") in ("some", "none"):
                threads.append(f"medicines {'partly ' if out['meds_taken'] == 'some' else ''}missed ({when.lower()})")
            if out.get("mood") in ("low", "distressed"):
                threads.append(f"was feeling {out['mood']} ({when.lower()})")
            if out.get("wants_family_callback") is True:
                threads.append("asked for the family to call back")
            if out.get("concerns"):
                threads.append(str(out["concerns"])[:200])

    context = {"memory_summary": " ".join(notes)[:1200] or "No earlier calls yet."}
    if threads:
        context["open_threads"] = "; ".join(threads)[:600]
    return context


def hotwords(variables: dict) -> list[str]:
    """Names and medicine words the speech recogniser should expect on this call."""
    words = [variables.get("parent_name"), variables.get("family_name")]
    # Member names from family_context ("Family members: Om (son, ...); Neha (...)").
    words += re.findall(r"(?:members: |; )([A-Z][\w]+)", variables.get("family_context") or "")
    for med in (variables.get("medicines") or "").replace(";", ",").split(","):
        words.extend(w for w in med.split() if len(w) > 3 and w[0].isupper())
    seen, out = set(), []
    for w in words:
        if w and w not in ("family", "ji", "none", "listed") and w.lower() not in seen:
            seen.add(w.lower())
            out.append(w)
    return out[:10]
