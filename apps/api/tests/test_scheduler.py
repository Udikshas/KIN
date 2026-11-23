"""Daily calls (app/scheduler.py): when Kin rings, retries, gives up, and never rings twice."""

import threading
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app import me, scheduler
from app.families import _query
from app.parents import record_call, remember_call, store_event

IST = timezone(timedelta(hours=5, minutes=30))
A, B, C, D, E, F, G = (f"+9198765000{i:02d}" for i in range(10, 17))


@pytest.fixture(autouse=True)
def not_at_midnight():
    # Tests that place calls use "a minute ago" in India time; skip the one minute a day that crosses midnight.
    if datetime.now(IST).hour == 0 and datetime.now(IST).minute < 2:
        pytest.skip("too close to midnight IST")


def hhmm(delta_min: int) -> str:
    return (datetime.now(IST) + timedelta(minutes=delta_min)).strftime("%H:%M")


def make(phone, name, call_time, daily=True):
    me.create_family(f"u{phone}", f"{phone}@x.com", f"{name}'s family", {"name": "Kid"}, phone,
                     {"parent_name": name, "language": "Hindi", "call_time": call_time, "call_length_minutes": 1, "daily_calls": daily})


def result(attempt, status):
    payload = {"attempt_id": attempt, "status": status, "duration": 60 if status == "connected" else 0, "metadata": {"source": "scheduler"},
               "output_agent_variables": {"call_summary": "Fine."} if status == "connected" else {}}
    store_event(payload, None)
    phone = _query("SELECT phone FROM call_attempts WHERE attempt_id = %(a)s", {"a": attempt})[0]["phone"]
    record_call(phone, payload)


def jobs(phone):
    return _query("SELECT try, status, note, due_at FROM call_jobs WHERE phone = %(p)s ORDER BY try", {"p": phone})


def due_now(phone):
    _query("UPDATE call_jobs SET due_at = now() - interval '1 second' WHERE phone = %(p)s AND status = 'pending' RETURNING id", {"p": phone})


def at_ist(h, m):
    return datetime(2031, 3, 3, h, m, tzinfo=IST)


def test_off_unless_enabled(monkeypatch):
    monkeypatch.delenv("SCHEDULER_ENABLED", raising=False)
    assert not scheduler.enabled()
    scheduler.start_in_background()
    assert not any(t.name == "kin-scheduler" for t in threading.enumerate())


def test_nobody_is_called_with_daily_calls_off(sarvam):
    make(A, "Amma", hhmm(-1), daily=False)
    scheduler.tick()
    assert not sarvam.placed and not jobs(A)


def test_rings_once_at_call_time(sarvam):
    make(A, "Amma", hhmm(-1))
    out = scheduler.tick()
    assert out["placed"] == 1
    call = sarvam.placed[-1]
    assert call.phone == A and call.source == "scheduler"
    assert call.variables["parent_name"] == "Amma" and call.variables["language"] == "Hindi"
    assert call.variables["call_length_minutes"] == "1" and call.variables["call_mode"] == "daily"
    scheduler.tick()
    scheduler.tick()
    assert len(sarvam.placed) == 1


def test_not_too_late_and_not_early():
    make(B, "Papa", "19:30")
    assert scheduler.plan(at_ist(21, 31)) == 0  # more than 2 h after call time
    assert scheduler.plan(at_ist(19, 0)) == 0  # before call time
    assert scheduler.plan(at_ist(19, 31)) == 1
    assert scheduler.plan(at_ist(19, 32)) == 0  # planned once


def test_retries_twice_then_stops(sarvam):
    make(A, "Amma", hhmm(-1))
    scheduler.tick()
    result(sarvam.placed[-1].attempt_id, "no_answer")
    scheduler.tick()
    j = jobs(A)
    assert len(j) == 2 and j[1]["try"] == 1 and j[1]["status"] == "pending"
    gap = (j[1]["due_at"] - datetime.now(timezone.utc)).total_seconds()
    assert 1100 < gap < 1260  # about 20 minutes later
    assert len(sarvam.placed) == 1  # not before it's due

    due_now(A)
    scheduler.tick()
    assert len(sarvam.placed) == 2
    result(sarvam.placed[-1].attempt_id, "busy")
    scheduler.tick()
    due_now(A)
    scheduler.tick()
    assert len(sarvam.placed) == 3
    result(sarvam.placed[-1].attempt_id, "no_answer")
    scheduler.tick()
    due_now(A)
    scheduler.tick()
    assert len(sarvam.placed) == 3 and len(jobs(A)) == 3  # max 2 retries


def test_no_retry_after_they_called_back(sarvam):
    make(D, "Dadi", hhmm(-1))
    scheduler.tick()
    result(sarvam.placed[-1].attempt_id, "no_answer")
    record_call(D, {"interaction_id": "in-" + uuid.uuid4().hex, "status": "connected", "duration": 90, "output_agent_variables": {}})
    scheduler.tick()
    due_now(D)
    scheduler.tick()
    assert len(sarvam.placed) == 1
    assert jobs(D)[-1]["status"] == "skipped" and "talked" in jobs(D)[-1]["note"]


def test_switched_off_before_the_call(sarvam):
    make(E, "Mausi", hhmm(-1))
    scheduler.plan(datetime.now(timezone.utc))
    _query("UPDATE parents SET daily_calls = false WHERE phone = %(p)s RETURNING phone", {"p": E})
    scheduler.tick()
    assert not sarvam.placed and jobs(E)[0]["status"] == "skipped"


def test_waits_for_another_call_to_the_number(sarvam):
    make(C, "Nani", hhmm(-1))
    remember_call(C, {"parent_name": "Nani"}, str(uuid.uuid4()), "app")  # a "call now" with no result yet
    scheduler.tick()
    j = jobs(C)
    assert not sarvam.placed and j[0]["status"] == "pending" and "under way" in j[0]["note"]
    assert (j[0]["due_at"] - datetime.now(timezone.utc)).total_seconds() > 200  # about 5 minutes later


def test_sarvam_error_fails_the_job_not_the_loop(sarvam):
    make(F, "Chachi", hhmm(-1))
    sarvam.fail = True
    scheduler.tick()
    assert jobs(F)[0]["status"] == "failed" and "500" in jobs(F)[0]["note"]


def test_two_workers_never_ring_twice(sarvam):
    make(G, "Bua", hhmm(-1))
    scheduler.plan(datetime.now(timezone.utc))
    sarvam.delay_s = 0.6
    workers = [threading.Thread(target=scheduler.tick) for _ in range(3)]
    [w.start() for w in workers]
    [w.join() for w in workers]
    assert [p.phone for p in sarvam.placed] == [G]


def test_interrupted_job_is_never_re_rung(sarvam):
    make(G, "Bua", hhmm(-1))
    scheduler.plan(datetime.now(timezone.utc))
    _query("UPDATE call_jobs SET status = 'placing', updated_at = now() - interval '10 minutes' WHERE phone = %(p)s RETURNING id", {"p": G})
    scheduler.tick()
    assert jobs(G)[0]["status"] == "failed" and "interrupted" in jobs(G)[0]["note"]
    assert not sarvam.placed


def test_the_app_can_switch_it():
    make(A, "Amma", "19:30")
    family_id = _query("SELECT family_id FROM parents WHERE phone = %(p)s", {"p": A})[0]["family_id"]
    assert me.family_view(family_id)["parents"][0]["daily_calls"] is True
    me.put_parent(family_id, A, {"parent_name": "Amma", "daily_calls": False})
    assert me.family_view(family_id)["parents"][0]["daily_calls"] is False


def test_red_alert_counts_days_not_calls():
    now = datetime.now(timezone.utc)

    def call(i, days_ago, status):
        return {"id": i, "status": status, "signal": None, "outputs": {}, "created_at": now - timedelta(days=days_ago, minutes=i)}

    one_bad_evening = [call(1, 0, "no_answer"), call(2, 0, "busy"), call(3, 0, "no_answer"), call(4, 1, "connected")]
    assert me.parent_alert(one_bad_evening) is None
    three_days = [call(1, 0, "no_answer"), call(2, 0, "no_answer"), call(3, 1, "busy"), call(4, 2, "no_answer"), call(5, 3, "connected")]
    alert = me.parent_alert(three_days)
    assert alert["level"] == "red" and alert["reason"] == "no_answer"
    assert me.parent_alert([call(1, 0, "no_answer"), call(2, 1, "no_answer"), call(3, 2, "connected")]) is None
