"""What changed: each call compared with the parent's own usual (no AI service, no cost).

The agent's outputs on every answered call (sleep_quality, pain, mood,
meds_taken, concerns, wants_family_callback) are enough to see change, so this
is plain arithmetic over the last HISTORY_DAYS of calls:

- call_insight: when a connected call's webhook lands, a short evening card:
  a headline, up to three things that differ from the parent's usual (pain
  streaks, new pain, sleep a point or more off their average, low mood when they
  are usually fine, missed medicine) and one suggestion for the family. Stored
  in calls.insight; the push uses the headline.
- trend_note: the Trends screen's note on the last 30 days, the latest week
  against the weeks before.
- backfill: once at startup, cards for answered calls from before this
  existed (each against the 30 days before that call).

Every sentence comes from a number in the data, so the family (or a judge) can
check it. The green / amber / red signal is still app/me.py call_signal.
"""

import json
import threading
from datetime import datetime, timedelta, timezone

from app.families import _one, _query
from app.parents import ProfileError

IST = timezone(timedelta(hours=5, minutes=30))
HISTORY_DAYS = 30
MIN_HISTORY = 3  # earlier answered calls needed before "usual" means anything
LOW_MOODS = ("low", "distressed")


def _outputs(v) -> dict:
    return v if isinstance(v, dict) else json.loads(v or "{}")


def _history(phone: str, skip_id: int | None = None) -> list[dict]:
    """Calls of the last HISTORY_DAYS, oldest first."""
    rows = _query(
        "SELECT id, status, outputs, created_at FROM calls "
        "WHERE phone = %(p)s AND caller_known AND created_at > now() - make_interval(days => %(d)s) "
        "AND (%(s)s::bigint IS NULL OR id <> %(s)s) ORDER BY created_at",
        {"p": phone, "d": HISTORY_DAYS, "s": skip_id},
    )
    return [{"answered": r["status"] == "connected", "o": _outputs(r["outputs"]), "at": r["created_at"]} for r in rows]


def _name(phone: str) -> str:
    row = _one("SELECT parent_name FROM parents WHERE phone = %(p)s", {"p": phone})
    return row["parent_name"] if row else "They"


def _avg(xs: list[float]) -> float | None:
    return sum(xs) / len(xs) if xs else None


def _sleep(o: dict) -> float | None:
    v = o.get("sleep_quality")
    return float(v) if isinstance(v, (int, float)) else None


def _plural(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"


def read_call(name: str, today: dict, before: list[dict]) -> dict:
    """The card for one call (outputs `today`) against earlier answered calls' outputs (oldest first)."""
    known = len(before) >= MIN_HISTORY
    changes: list[str] = []  # most important first
    tags: list[str] = []  # short pieces for the headline
    suggestion = ""
    where = (today.get("pain_location") or "").strip()
    pain_word = f"{where} pain" if where else "pain"

    # Pain: a streak, something new, or gone.
    if today.get("pain_mentioned") is True:
        streak = 1
        for o in reversed(before):
            if o.get("pain_mentioned") is not True:
                break
            streak += 1
        if streak >= 2:
            changes.append(f"{pain_word.capitalize()} on {streak} calls in a row")
            tags.append(f"{pain_word}, day {streak}")
            if streak >= 3:
                suggestion = f"Ask whether the {where or 'pain'} needs a doctor."
        elif known and not any(o.get("pain_mentioned") is True for o in before[-7:]):
            changes.append(f"New: {pain_word}, none in the {_plural(len(before[-7:]), 'call')} before")
            tags.append(f"new {pain_word}")
        else:
            changes.append(f"Mentioned {pain_word}")
            tags.append(pain_word)
    elif today.get("pain_mentioned") is False and before and before[-1].get("pain_mentioned") is True:
        changes.append("No pain today, after pain on the last call")
        tags.append("pain eased")

    # Sleep: a point or more away from their own average.
    sleep = _sleep(today)
    usual_sleep = _avg([s for o in before if (s := _sleep(o)) is not None])
    if sleep is not None and usual_sleep is not None and known:
        if sleep <= usual_sleep - 1:
            changes.append(f"Slept worse: {sleep:g}/5, usually about {usual_sleep:.0f}/5")
            tags.append("slept badly")
            suggestion = suggestion or "Ask what kept them up at night."
        elif sleep >= usual_sleep + 1:
            changes.append(f"Slept better: {sleep:g}/5, usually about {usual_sleep:.0f}/5")

    # Mood: low when they are usually fine, or low again.
    mood = today.get("mood")
    if mood in LOW_MOODS:
        recent_low = sum(1 for o in before[-3:] if o.get("mood") in LOW_MOODS)
        usual_low = sum(1 for o in before if o.get("mood") in LOW_MOODS)
        if recent_low >= 1:
            changes.append(f"Sounded {'upset' if mood == 'distressed' else 'low'} again: {recent_low + 1} of the last {min(len(before), 3) + 1} calls")
            suggestion = suggestion or "A call from the family tonight could lift their spirits."
        elif known and usual_low <= len(before) // 4:
            changes.append(f"Sounded {'upset' if mood == 'distressed' else 'low'}, which is unusual for {name}")
        else:
            changes.append(f"Sounded {'upset' if mood == 'distressed' else 'low'}")
        tags.append("sounded low")

    # Medicines.
    if today.get("meds_taken") in ("some", "none"):
        missed_before = sum(1 for o in before[-7:] if o.get("meds_taken") in ("some", "none"))
        what = "Missed some medicine" if today["meds_taken"] == "some" else "Did not take medicine"
        changes.append(f"{what}, {'also on ' + _plural(missed_before, 'other call') + ' this week' if missed_before else 'first miss in a while' if known else 'today'}")
        tags.append("missed medicine")
        if missed_before:
            suggestion = suggestion or "Check the tablets are at hand, or ask a neighbour to remind them."

    if today.get("concerns") and len(changes) < 3:
        changes.append(f"Said: {str(today['concerns']).strip().rstrip('.')}")

    if today.get("wants_family_callback") is True:
        suggestion = f"Call {name}: they asked to hear from you."
        tags.insert(0, "wants a call")

    if tags:
        headline = f"{name}: " + ", ".join(tags[:3])
    else:
        good = [t for t, ok in (("medicines taken", today.get("meds_taken") == "all"),
                                ("slept well", sleep is not None and sleep >= 4),
                                ("in good spirits", mood in ("happy", "ok"))) if ok]
        headline = f"A usual day for {name}" + (f": {', '.join(good)}" if good else "")
    return {"headline": headline[:120], "changes": changes[:3], "suggestion": suggestion}


def call_insight(phone: str, payload: dict) -> dict | None:
    """The card for a connected call, saved on the calls row (once; retried webhooks reuse it)."""
    if payload.get("status") != "connected":
        return None
    key = payload.get("interaction_id") or payload.get("attempt_id")
    row = _one("SELECT id, insight FROM calls WHERE coalesce(interaction_id, attempt_id) = %(k)s ORDER BY id DESC LIMIT 1",
               {"k": key})
    if not row:
        return None
    if row["insight"]:
        return row["insight"]
    before = [h["o"] for h in _history(phone, row["id"]) if h["answered"]]
    insight = read_call(_name(phone), payload.get("output_agent_variables") or {}, before)
    _query("UPDATE calls SET insight = %(i)s WHERE id = %(c)s", {"i": json.dumps(insight), "c": row["id"]})
    return insight


def note_for(name: str, calls: list[dict], now: datetime | None = None) -> dict | None:
    """The 30-day note from calls (oldest first, each {answered, o, at}); None with under 3 answered calls."""
    answered = [c for c in calls if c["answered"]]
    if len(answered) < MIN_HISTORY:
        return None
    week_start = (now or datetime.now(IST)) - timedelta(days=7)
    week = [c["o"] for c in answered if c["at"] >= week_start]
    earlier = [c["o"] for c in answered if c["at"] < week_start]
    points: list[str] = []
    watch = ""

    points.append(f"Answered {len(answered)} of {_plural(len(calls), 'call')}")
    missed_calls = len(calls) - len(answered)

    s_week = _avg([s for o in week if (s := _sleep(o)) is not None])
    s_before = _avg([s for o in earlier if (s := _sleep(o)) is not None])
    if s_week is not None and s_before is not None and abs(s_week - s_before) >= 0.5:
        points.append(f"Sleep {'down' if s_week < s_before else 'up'} this week: {s_week:.1f}/5, before {s_before:.1f}/5")
        if s_week < s_before:
            watch = watch or "Sleep: it has dropped this week."
    elif s_week is not None or s_before is not None:
        points.append(f"Sleep steady at about {(s_week if s_week is not None else s_before):.1f}/5")

    pain_week = sum(1 for o in week if o.get("pain_mentioned") is True)
    pain_before = sum(1 for o in earlier if o.get("pain_mentioned") is True)
    if pain_week or pain_before:
        places = sorted({o.get("pain_location") for o in week + earlier if o.get("pain_mentioned") is True and o.get("pain_location")})
        where = f" ({', '.join(places[:2])})" if places else ""
        points.append(f"Pain{where} on {pain_week} of {len(week)} calls this week, {pain_before} of {len(earlier)} before")
        if week and pain_week / len(week) > (pain_before / len(earlier) if earlier else 0) + 0.25:
            watch = watch or f"Pain{where}: more often this week than before."

    low = sum(1 for o in answered if o.get("mood") in LOW_MOODS)
    low_week = sum(1 for o in week if o.get("mood") in LOW_MOODS)
    if low:
        points.append(f"Sounded low on {_plural(low, 'call')}, {low_week} of them this week")
        if low_week >= 2:
            watch = watch or "Mood: low more than once this week."

    missed = sum(1 for o in answered if o.get("meds_taken") in ("some", "none"))
    with_meds = sum(1 for o in answered if o.get("meds_taken") in ("all", "some", "none"))
    if with_meds:
        points.append(f"Medicines taken on {with_meds - missed} of {_plural(with_meds, 'call')}" if missed
                      else f"Took medicines on all {_plural(with_meds, 'call')}")
        if missed >= 2 and any(o.get("meds_taken") in ("some", "none") for o in week):
            watch = watch or "Medicines: missed more than once."

    if missed_calls >= 3:
        watch = watch or f"Answering: {_plural(missed_calls, 'call')} went unanswered."

    steady = not watch
    summary = (
        f"A steady month for {name}: nothing stands out against their own usual."
        if steady
        else f"Mostly a steady month for {name}, with one thing to keep an eye on this week."
    )
    return {"summary": summary, "points": points[:4], "watch": watch, "calls": len(calls)}


def trend_note(phone: str) -> dict | None:
    """The Trends screen's note on the last 30 days for this parent."""
    return note_for(_name(phone), _history(phone))


def backfill() -> int:
    """Cards for answered calls that have none (calls from before cards existed). Returns how many."""
    rows = _query(
        "SELECT c.id, c.phone, c.status, c.outputs, c.created_at, c.insight IS NULL AS missing, p.parent_name "
        "FROM calls c JOIN parents p ON p.phone = c.phone WHERE c.caller_known "
        "AND c.phone IN (SELECT phone FROM calls WHERE caller_known AND status = 'connected' AND insight IS NULL) "
        "ORDER BY c.phone, c.created_at"
    )
    done = 0
    history: dict[str, list[tuple[datetime, dict]]] = {}
    for r in rows:
        earlier = history.setdefault(r["phone"], [])
        if r["status"] != "connected":
            continue
        outputs = _outputs(r["outputs"])
        if r["missing"]:
            since = r["created_at"] - timedelta(days=HISTORY_DAYS)
            before = [o for at, o in earlier if at >= since]
            card = read_call(r["parent_name"], outputs, before)
            _query("UPDATE calls SET insight = %(i)s WHERE id = %(c)s AND insight IS NULL", {"i": json.dumps(card), "c": r["id"]})
            done += 1
        earlier.append((r["created_at"], outputs))
    return done


def backfill_in_background() -> None:
    """From app.main: fills in old calls' cards without delaying startup; a failure only logs."""
    def run():
        try:
            n = backfill()
            if n:
                print(f"insights: wrote cards for {n} earlier calls")
        except ProfileError as e:
            print(f"insights: backfill skipped ({e})")
        except Exception as e:
            print(f"insights: backfill failed: {type(e).__name__}: {e}")

    threading.Thread(target=run, name="kin-insights-backfill", daemon=True).start()
