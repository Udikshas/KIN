"""Daily calls: Kin rings each parent at their call time (IST) and retries when nobody answers.

Places real, paid calls, so it is off twice over: it only runs with
SCHEDULER_ENABLED=1 on the server, and it only calls parents whose family
switched "Daily calls" on in the app (parents.daily_calls, default off).

Runs as a background thread inside the API (start_in_background, from
app.main) or on its own with `python -m app.scheduler`. Every minute it:

1. plans today's evening call (try 0) for each parent whose call time has
   come, unless it is more than LATE_LIMIT past it (an API that was down at
   7:30 pm doesn't ring at 11 pm);
2. plans a retry RETRY_AFTER after an evening call that wasn't answered
   (no_answer / busy / failed), up to MAX_RETRIES, unless the parent has
   talked to Kin since (e.g. they called back);
3. places due calls. Jobs are claimed with FOR UPDATE SKIP LOCKED and are
   unique per number, IST day and try, so a call is placed once even with
   two workers or two containers running during a deploy.

Calls go out with source "scheduler"; their webhooks are stored like any
other call, so the app shows them and the next call remembers them.
"""

import os
import threading
import time
from datetime import date, datetime, timedelta, timezone

from app import me, reminders
from app.db import pool
from app.families import _query
from app.parents import ProfileError
from app.sarvam_outbound import OutboundError, place_outbound

IST = timezone(timedelta(hours=5, minutes=30))
SOURCE = "scheduler"
TICK_S = 60
LATE_LIMIT = timedelta(hours=2)
RETRY_AFTER = timedelta(minutes=20)
MAX_RETRIES = 2
RETRY_STATUSES = ("no_answer", "busy", "failed")
# Another call to the same number with no result yet (Try-it, "call now"): wait for it.
BUSY_WAIT = timedelta(minutes=5)
CALL_TIMEOUT = timedelta(minutes=8)
PER_TICK = 10  # at most this many calls placed per minute


def enabled() -> bool:
    return os.getenv("SCHEDULER_ENABLED", "").lower() in ("1", "true", "yes", "on")


def _due_time(day: date, call_time: str) -> datetime | None:
    try:
        h, m = (int(x) for x in call_time.split(":"))
        return datetime(day.year, day.month, day.day, h, m, tzinfo=IST)
    except (ValueError, AttributeError):
        return None


def plan(now: datetime) -> int:
    """Adds today's evening calls and retries that are due. Returns how many jobs it added."""
    today = now.astimezone(IST).date()
    added = 0
    parents = _query(
        "SELECT p.phone, p.call_time FROM parents p JOIN families f ON f.id = p.family_id "
        "WHERE p.daily_calls AND p.call_time IS NOT NULL"
    )
    for p in parents:
        due = _due_time(today, p["call_time"])
        if due and due <= now < due + LATE_LIMIT:
            added += len(_query(
                "INSERT INTO call_jobs (phone, day, try, due_at) VALUES (%(p)s, %(d)s, 0, %(due)s) "
                "ON CONFLICT DO NOTHING RETURNING id",
                {"p": p["phone"], "d": today, "due": due},
            ))

    # Evening calls (and retries) whose result says nobody answered, without a next try yet.
    unanswered = _query(
        """
        SELECT j.phone, j.day, j.try, we.received_at,
               (SELECT first.due_at FROM call_jobs first
                 WHERE first.phone = j.phone AND first.day = j.day AND first.try = 0) AS first_due
        FROM call_jobs j
        JOIN LATERAL (
            SELECT status, received_at FROM webhook_events
            WHERE attempt_id = j.attempt_id ORDER BY id DESC LIMIT 1
        ) we ON true
        WHERE j.status = 'placed' AND j.try < %(max)s AND j.day >= %(since)s
          AND we.status = ANY(%(retry)s)
          AND NOT EXISTS (SELECT 1 FROM call_jobs n WHERE n.phone = j.phone AND n.day = j.day AND n.try = j.try + 1)
        """,
        {"max": MAX_RETRIES, "since": today - timedelta(days=1), "retry": list(RETRY_STATUSES)},
    )
    for u in unanswered:
        talked = _query(
            "SELECT 1 FROM calls WHERE phone = %(p)s AND status = 'connected' AND created_at >= %(t)s LIMIT 1",
            {"p": u["phone"], "t": u["first_due"] or u["received_at"]},
        )
        # Talked to Kin since (called back, or a "call now"): no retry; the row records why.
        status, note = ("skipped", "talked to Kin since") if talked else ("pending", None)
        added += len(_query(
            "INSERT INTO call_jobs (phone, day, try, due_at, status, note) VALUES (%(p)s, %(d)s, %(t)s, %(due)s, %(s)s, %(n)s) "
            "ON CONFLICT DO NOTHING RETURNING id",
            {"p": u["phone"], "d": u["day"], "t": u["try"] + 1, "due": u["received_at"] + RETRY_AFTER, "s": status, "n": note},
        ))
    return added


def _claim(limit: int) -> list[dict]:
    """Marks up to `limit` due jobs as placing and returns them (skips rows another worker holds)."""
    with pool().connection() as conn, conn.transaction():
        rows = conn.execute(
            "SELECT id, phone FROM call_jobs WHERE status = 'pending' AND due_at <= now() "
            "ORDER BY due_at LIMIT %(n)s FOR UPDATE SKIP LOCKED",
            {"n": limit},
        ).fetchall()
        for job_id, _ in rows:
            conn.execute("UPDATE call_jobs SET status = 'placing', updated_at = now() WHERE id = %(i)s", {"i": job_id})
    return [{"id": r[0], "phone": r[1]} for r in rows]


def _finish(job_id: int, status: str, note: str | None = None, attempt_id: str | None = None, due_at: datetime | None = None) -> None:
    _query(
        "UPDATE call_jobs SET status = %(s)s, note = %(n)s, attempt_id = coalesce(%(a)s, attempt_id), "
        "due_at = coalesce(%(due)s, due_at), updated_at = now() WHERE id = %(i)s RETURNING id",
        {"s": status, "n": note, "a": attempt_id, "due": due_at, "i": job_id},
    )


def place_job(job: dict, now: datetime) -> str:
    """Rings the parent for one claimed job. Returns the job's new status."""
    parent = _query(
        "SELECT phone, parent_name, family_name, language, medicines, health_notes, emergency_number, "
        "call_length_minutes, daily_calls FROM parents WHERE phone = %(p)s",
        {"p": job["phone"]},
    )
    if not parent or not parent[0]["daily_calls"]:
        _finish(job["id"], "skipped", "daily calls switched off")
        return "skipped"
    last = me.last_attempt(job["phone"])
    if last and not last["finished"] and now - last["created_at"] < CALL_TIMEOUT:
        _finish(job["id"], "pending", "another call to this number is under way", due_at=now + BUSY_WAIT)
        return "pending"
    try:
        attempt_id = place_outbound(job["phone"], me.call_variables(parent[0]), source=SOURCE)
    except OutboundError as e:
        _finish(job["id"], "failed", str(e)[:300])
        print(f"scheduler: job {job['id']} failed: {e}")
        return "failed"
    _finish(job["id"], "placed", attempt_id=attempt_id)
    print(f"scheduler: job {job['id']} placed, attempt={attempt_id}")
    return "placed"


def tick(now: datetime | None = None) -> dict:
    """One round: recover, plan, place. Errors are logged, never raised (the loop keeps going)."""
    now = now or datetime.now(timezone.utc)
    out = {"planned": 0, "placed": 0}
    try:
        # A worker that died mid-call leaves 'placing'; never retry it blindly (it may have rung).
        _query(
            "UPDATE call_jobs SET status = 'failed', note = 'interrupted while placing', updated_at = now() "
            "WHERE status = 'placing' AND updated_at < now() - interval '5 minutes' RETURNING id"
        )
        out["planned"] = plan(now)
        for job in _claim(PER_TICK):
            if place_job(job, now) == "placed":
                out["placed"] += 1
        # Medicine reminder calls (app/reminders.py) run on the same clock.
        r = reminders.tick(now)
        out["planned"] += r["planned"]
        out["placed"] += r["placed"]
    except ProfileError as e:
        print(f"scheduler: database unavailable ({e})")
    except Exception as e:  # never let one bad round stop the loop
        print(f"scheduler: tick failed: {type(e).__name__}: {e}")
    return out


def run_forever() -> None:
    print("scheduler: on")
    while True:
        tick()
        time.sleep(TICK_S - time.time() % TICK_S)  # on the minute


def start_in_background() -> None:
    """Called from app.main: a daemon thread inside the API, only with SCHEDULER_ENABLED=1."""
    if enabled():
        threading.Thread(target=run_forever, name="kin-scheduler", daemon=True).start()
    else:
        print("scheduler: off (set SCHEDULER_ENABLED=1 to place daily calls)")


if __name__ == "__main__":
    if not enabled():
        raise SystemExit("SCHEDULER_ENABLED is not set; refusing to place calls.")
    run_forever()
