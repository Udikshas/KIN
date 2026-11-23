"""Medicine reminder calls: a short call at tablet time, and the family told if they weren't taken.

A family sets reminders per parent in the app (Medicines → Reminder calls):
an IST time and which medicines, at most MAX_PER_PARENT. The scheduler thread
(app/scheduler.py tick) calls plan() and place_due() every minute:

- plan: today's call for each enabled reminder once its time has come (not if
  more than LATE_LIMIT late), skipped when the parent's evening call is within
  NEAR_DAILY of it (that call asks about medicines anyway); one retry
  RETRY_AFTER after a call nobody answered.
- place_due: rings with call_mode "medicine_reminder", the medicines for this
  time and a 1-minute length, opening straight with the reminder. When Vobiz
  is configured (app/ivr.py) it is a recorded message and "press 1" instead
  of the AI agent: same jobs, same results, a fraction of the cost.
- on_result (from the Sarvam webhook): the agent's meds_taken becomes the
  job's outcome. Not taken, or still no answer after the retry, pushes the
  family once ("Maa hasn't taken her 8:00 pm medicines"). Taken stays quiet;
  the app shows a tick.

Reminder calls are not evening calls: no evening card, no "what changed" card,
and the app leaves them out of Today and Trends. When the parent tells Kin to
stop calling (families.stop_daily_calls) their reminders are switched off too.
"""

from datetime import date, datetime, timedelta, timezone

from app import ivr, me
from app.db import pool
from app.families import _one, _query
from app.greetings_util import reminder_line
from app.ivr import IvrError
from app.parents import ProfileError
from app.sarvam_outbound import OutboundError, place_outbound

IST = timezone(timedelta(hours=5, minutes=30))
SOURCE = "med_reminder"
MAX_PER_PARENT = 4
LATE_LIMIT = timedelta(hours=1)
RETRY_AFTER = timedelta(minutes=15)
MAX_RETRIES = 1
NEAR_DAILY = timedelta(minutes=30)
RETRY_STATUSES = ("no_answer", "busy", "failed")
BUSY_WAIT = timedelta(minutes=5)
CALL_TIMEOUT = timedelta(minutes=8)
PER_TICK = 10

COLS = "r.id, r.phone, r.time, r.medicines, r.enabled"


class NotFound(Exception):
    pass


def to_label(hhmm: str) -> str:
    """"20:30" -> "8:30 pm" (IST, as the family set it)."""
    try:
        h, m = (int(x) for x in hhmm.split(":"))
    except (ValueError, AttributeError):
        return hhmm
    return f"{h % 12 or 12}:{m:02d} {'am' if h < 12 else 'pm'}"


def _due(day: date, hhmm: str) -> datetime | None:
    try:
        h, m = (int(x) for x in hhmm.split(":"))
        return datetime(day.year, day.month, day.day, h, m, tzinfo=IST)
    except (ValueError, AttributeError):
        return None


# ---- the family's reminders (app routes) --------------------------------------

def for_parent(phone: str, now: datetime | None = None) -> list[dict]:
    """A parent's reminders, by time, each with how today's call went (family_view)."""
    today = (now or datetime.now(IST)).astimezone(IST).date()
    rows = _query(f"SELECT {COLS} FROM med_reminders r WHERE r.phone = %(p)s ORDER BY r.time, r.id", {"p": phone})
    for r in rows:
        r["today"] = today_status(r["id"], today)
    return rows


def today_status(reminder_id: int, today: date) -> dict | None:
    """scheduled / calling / retrying / taken / not_taken / unclear / no_answer / skipped, from today's jobs."""
    job = _one(
        "SELECT try, status, outcome, due_at, note FROM med_jobs WHERE reminder_id = %(r)s AND day = %(d)s "
        "ORDER BY try DESC LIMIT 1",
        {"r": reminder_id, "d": today},
    )
    if not job:
        return None
    if job["outcome"]:
        return {"state": job["outcome"], "at": job["due_at"]}
    if job["status"] == "skipped":
        return {"state": "skipped", "at": job["due_at"], "note": job["note"]}
    if job["status"] in ("placing", "placed"):
        return {"state": "calling", "at": job["due_at"]}
    if job["status"] == "pending":
        return {"state": "retrying" if job["try"] else "scheduled", "at": job["due_at"]}
    return {"state": "failed", "at": job["due_at"]}


def _owned(family_id: int, reminder_id: int) -> dict:
    row = _one(
        f"SELECT {COLS} FROM med_reminders r JOIN parents p ON p.phone = r.phone "
        "WHERE r.id = %(r)s AND p.family_id = %(f)s",
        {"r": reminder_id, "f": family_id},
    )
    if not row:
        raise NotFound("Reminder not found")
    return row


def add(family_id: int, phone: str, time: str, medicines: str) -> dict:
    if not me.call_target(family_id, phone):
        raise NotFound("Parent not found")
    count = _one("SELECT count(*) AS n FROM med_reminders WHERE phone = %(p)s", {"p": phone})["n"]
    if count >= MAX_PER_PARENT:
        raise me.NotAllowed(f"At most {MAX_PER_PARENT} reminder calls a day.")
    return _query(
        "INSERT INTO med_reminders (phone, time, medicines) VALUES (%(p)s, %(t)s, %(m)s) "
        "RETURNING id, phone, time, medicines, enabled",
        {"p": phone, "t": time, "m": medicines},
    )[0]


def update(family_id: int, reminder_id: int, fields: dict) -> dict:
    _owned(family_id, reminder_id)
    fields = {k: v for k, v in fields.items() if k in ("time", "medicines", "enabled") and v is not None}
    if fields:
        sets = ", ".join([*(f"{k} = %({k})s" for k in fields), "updated_at = now()"])
        _query(f"UPDATE med_reminders SET {sets} WHERE id = %(r)s RETURNING id", {**fields, "r": reminder_id})
        if "time" in fields or fields.get("enabled") is False:
            # Today's planned call no longer matches: drop it (a new time is planned fresh).
            _query("DELETE FROM med_jobs WHERE reminder_id = %(r)s AND status = 'pending' RETURNING id", {"r": reminder_id})
    return _owned(family_id, reminder_id)


def delete(family_id: int, reminder_id: int) -> None:
    _owned(family_id, reminder_id)
    _query("DELETE FROM med_reminders WHERE id = %(r)s RETURNING id", {"r": reminder_id})


def switch_off(phone: str) -> None:
    """The parent asked Kin to stop calling: no reminder calls either."""
    _query("UPDATE med_reminders SET enabled = false, updated_at = now() WHERE phone = %(p)s RETURNING id", {"p": phone})
    _query("UPDATE med_jobs SET status = 'skipped', note = 'the parent asked Kin to stop calling', updated_at = now() "
           "WHERE phone = %(p)s AND status = 'pending' RETURNING id", {"p": phone})


# ---- history: the Medicines screen's streak and 30-day calendar ---------------------

HISTORY_DAYS = 30
CALL_MEDS = {"all": "taken", "some": "not_taken", "none": "not_taken", "unclear": "unclear"}


def day_state(results: list[str]) -> str | None:
    """One day from its results: a miss wins, then taken, then no answer, then unsure."""
    for state in ("not_taken", "taken", "no_answer", "unclear"):
        if state in results:
            if state == "taken" and "no_answer" in results:
                return "partly"  # took some doses, didn't answer for another
            return state
    return None


def history(phone: str, now: datetime | None = None) -> dict:
    """The last HISTORY_DAYS days (oldest first): reminder outcomes plus what evening calls said
    about medicines, the current run of days with everything taken, and the best run."""
    today = (now or datetime.now(IST)).astimezone(IST).date()
    start = today - timedelta(days=HISTORY_DAYS - 1)
    by_day: dict[date, list[dict]] = {}
    for r in _query(
        """
        SELECT DISTINCT ON (j.reminder_id, j.day) j.day, r.time, j.outcome
        FROM med_jobs j JOIN med_reminders r ON r.id = j.reminder_id
        WHERE j.phone = %(p)s AND j.day >= %(s)s AND j.outcome IS NOT NULL
        ORDER BY j.reminder_id, j.day, j.try DESC
        """,
        {"p": phone, "s": start},
    ):
        by_day.setdefault(r["day"], []).append({"what": f"{to_label(r['time'])} reminder", "result": r["outcome"]})
    for c in _query(
        """
        SELECT (created_at AT TIME ZONE 'UTC' + interval '330 minutes')::date AS day,
               created_at, outputs->>'meds_taken' AS meds
        FROM calls WHERE phone = %(p)s AND caller_known AND status = 'connected'
          AND coalesce(source, '') <> %(src)s AND outputs->>'meds_taken' IS NOT NULL
          AND created_at >= %(s)s::date - interval '1 day'
        ORDER BY created_at
        """,
        {"p": phone, "s": start, "src": SOURCE},
    ):
        if c["day"] >= start and c["meds"] in CALL_MEDS:
            at = c["created_at"].astimezone(IST)
            by_day.setdefault(c["day"], []).append({"what": f"{to_label(at.strftime('%H:%M'))} call", "result": CALL_MEDS[c["meds"]]})

    days = []
    for i in range(HISTORY_DAYS):
        d = start + timedelta(days=i)
        items = by_day.get(d, [])
        days.append({"day": d.isoformat(), "state": day_state([x["result"] for x in items]), "items": items})

    # The run ends today, or yesterday while today has no result yet. Days with no data break it.
    states = [x["state"] for x in days]
    if states and states[-1] is None:
        states = states[:-1]
    current = 0
    for st in reversed(states):
        if st != "taken":
            break
        current += 1
    best = run = 0
    for st in (x["state"] for x in days):
        run = run + 1 if st == "taken" else 0
        best = max(best, run)
    known = [x for x in days if x["state"]]
    return {
        "days": days,
        "streak": current,
        "best": best,
        "taken_days": sum(1 for x in known if x["state"] == "taken"),
        "known_days": len(known),
    }


# ---- scheduling (from app/scheduler.py) ------------------------------------------

def plan(now: datetime) -> int:
    today = now.astimezone(IST).date()
    added = 0
    rows = _query(
        "SELECT r.id, r.phone, r.time, p.daily_calls, p.call_time FROM med_reminders r "
        "JOIN parents p ON p.phone = r.phone WHERE r.enabled AND p.family_id IS NOT NULL"
    )
    for r in rows:
        due = _due(today, r["time"])
        if not due or not (due <= now < due + LATE_LIMIT):
            continue
        daily = _due(today, r["call_time"]) if r["daily_calls"] and r["call_time"] else None
        near = daily is not None and abs(daily - due) <= NEAR_DAILY
        added += len(_query(
            "INSERT INTO med_jobs (reminder_id, phone, day, due_at, status, note) "
            "VALUES (%(r)s, %(p)s, %(d)s, %(due)s, %(s)s, %(n)s) ON CONFLICT DO NOTHING RETURNING id",
            {"r": r["id"], "p": r["phone"], "d": today, "due": due,
             "s": "skipped" if near else "pending", "n": "the evening call asks about medicines" if near else None},
        ))

    # One retry after a reminder nobody answered.
    unanswered = _query(
        """
        SELECT j.reminder_id, j.phone, j.day, j.try, we.received_at
        FROM med_jobs j
        JOIN LATERAL (SELECT status, received_at FROM webhook_events WHERE attempt_id = j.attempt_id
                      ORDER BY id DESC LIMIT 1) we ON true
        WHERE j.status = 'placed' AND j.try < %(max)s AND j.day >= %(since)s AND we.status = ANY(%(retry)s)
          AND NOT EXISTS (SELECT 1 FROM med_jobs n WHERE n.reminder_id = j.reminder_id AND n.day = j.day AND n.try = j.try + 1)
        """,
        {"max": MAX_RETRIES, "since": today - timedelta(days=1), "retry": list(RETRY_STATUSES)},
    )
    for u in unanswered:
        added += len(_query(
            "INSERT INTO med_jobs (reminder_id, phone, day, try, due_at) VALUES (%(r)s, %(p)s, %(d)s, %(t)s, %(due)s) "
            "ON CONFLICT DO NOTHING RETURNING id",
            {"r": u["reminder_id"], "p": u["phone"], "d": u["day"], "t": u["try"] + 1, "due": u["received_at"] + RETRY_AFTER},
        ))
    return added


def _claim(limit: int) -> list[dict]:
    with pool().connection() as conn, conn.transaction():
        rows = conn.execute(
            "SELECT id, reminder_id, phone FROM med_jobs WHERE status = 'pending' AND due_at <= now() "
            "ORDER BY due_at LIMIT %(n)s FOR UPDATE SKIP LOCKED",
            {"n": limit},
        ).fetchall()
        for job_id, _, _ in rows:
            conn.execute("UPDATE med_jobs SET status = 'placing', updated_at = now() WHERE id = %(i)s", {"i": job_id})
    return [{"id": r[0], "reminder_id": r[1], "phone": r[2]} for r in rows]


def _finish(job_id: int, status: str, note: str | None = None, attempt_id: str | None = None,
            due_at: datetime | None = None, outcome: str | None = None) -> None:
    _query(
        "UPDATE med_jobs SET status = %(s)s, note = %(n)s, attempt_id = coalesce(%(a)s, attempt_id), "
        "due_at = coalesce(%(due)s, due_at), outcome = coalesce(%(o)s, outcome), updated_at = now() "
        "WHERE id = %(i)s RETURNING id",
        {"s": status, "n": note, "a": attempt_id, "due": due_at, "o": outcome, "i": job_id},
    )


def place_job(job: dict, now: datetime) -> str:
    row = _one(
        "SELECT r.time, r.medicines, r.enabled, p.phone, p.parent_name, p.family_name, p.language, p.medicines AS all_medicines, "
        "p.health_notes, p.emergency_number, p.call_length_minutes FROM med_reminders r "
        "JOIN parents p ON p.phone = r.phone WHERE r.id = %(r)s",
        {"r": job["reminder_id"]},
    )
    if not row or not row["enabled"]:
        _finish(job["id"], "skipped", "reminder switched off")
        return "skipped"
    last = me.last_attempt(job["phone"])
    if last and not last["finished"] and now - last["created_at"] < CALL_TIMEOUT:
        _finish(job["id"], "pending", "another call to this number is under way", due_at=now + BUSY_WAIT)
        return "pending"
    if ivr.configured():
        # A recorded message and "press 1" (app/ivr.py): no AI minutes for a reminder.
        try:
            attempt_id = ivr.place_reminder(job["id"], job["phone"], row, to_label(row["time"]), SOURCE)
        except IvrError as e:
            _finish(job["id"], "failed", str(e)[:300])
            print(f"reminders: job {job['id']} failed (ivr): {e}")
            return "failed"
        _finish(job["id"], "placed", attempt_id=attempt_id)
        print(f"reminders: job {job['id']} placed (ivr), attempt={attempt_id}")
        return "placed"

    variables = {
        **me.call_variables({**row, "medicines": row["all_medicines"]}),
        "call_mode": "medicine_reminder",
        "medicines": row["medicines"],
        "reminder_time": to_label(row["time"]),
        "call_length_minutes": "1",
    }

    def opening(language: str, tod: str, disclose: bool) -> str:
        return reminder_line(language, row["parent_name"], row["medicines"], tod, row["family_name"] or "", disclose)

    try:
        attempt_id = place_outbound(job["phone"], variables, source=SOURCE, opening=opening)
    except OutboundError as e:
        _finish(job["id"], "failed", str(e)[:300])
        print(f"reminders: job {job['id']} failed: {e}")
        return "failed"
    _finish(job["id"], "placed", attempt_id=attempt_id)
    print(f"reminders: job {job['id']} placed, attempt={attempt_id}")
    return "placed"


def place_due(now: datetime) -> int:
    placed = 0
    for job in _claim(PER_TICK):
        if place_job(job, now) == "placed":
            placed += 1
    return placed


# ---- results (from the Sarvam webhook) ------------------------------------------------

def outcome_of(payload: dict) -> str | None:
    """taken / not_taken / unclear for an answered call, no_answer otherwise."""
    if payload.get("status") != "connected":
        return "no_answer"
    taken = (payload.get("output_agent_variables") or {}).get("meds_taken")
    return {"all": "taken", "some": "not_taken", "none": "not_taken"}.get(taken, "unclear")


def on_result(payload: dict) -> dict | None:
    """Records how a reminder call went. Returns the push to send the family, if any (once per job)."""
    job = _one(
        "SELECT j.id, j.try, j.day, j.due_at, r.time, r.medicines, p.parent_name, p.phone FROM med_jobs j "
        "JOIN med_reminders r ON r.id = j.reminder_id JOIN parents p ON p.phone = j.phone "
        "WHERE j.attempt_id = %(a)s",
        {"a": payload.get("attempt_id")},
    )
    if not job:
        return None
    outcome = outcome_of(payload)
    if outcome == "no_answer" and job["try"] < MAX_RETRIES:
        return None  # plan() adds the retry; nothing to tell yet
    _query("UPDATE med_jobs SET outcome = %(o)s, updated_at = now() WHERE id = %(i)s RETURNING id", {"o": outcome, "i": job["id"]})
    if outcome not in ("not_taken", "no_answer"):
        return None
    claimed = _query(
        "UPDATE med_jobs SET notified_at = now() WHERE id = %(i)s AND notified_at IS NULL RETURNING id", {"i": job["id"]}
    )
    if not claimed:
        return None  # a retried webhook: already told
    name, when = job["parent_name"], to_label(job["time"])
    if outcome == "not_taken":
        return {"phone": job["phone"], "title": f"{name} hasn't taken the {when} medicines",
                "body": f"{job['medicines']}. Kin reminded {name}; you may want to call.", "data": {"screen": "medicines"}}
    return {"phone": job["phone"], "title": f"{name} didn't answer the {when} medicine reminder",
            "body": f"Kin tried twice for {job['medicines']}. You may want to call {name}.", "data": {"screen": "medicines"}}


def tick(now: datetime) -> dict:
    """The scheduler's reminder round: plan and place. Database trouble only logs."""
    try:
        return {"planned": plan(now), "placed": place_due(now)}
    except ProfileError as e:
        print(f"reminders: database unavailable ({e})")
        return {"planned": 0, "placed": 0}
