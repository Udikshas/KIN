"""Medicine reminder calls (app/reminders.py): set in the app, rung on time, family told if not taken."""

from datetime import datetime, timedelta, timezone

import pytest

from app import push, reminders
from app.families import _query
from app.routes import sarvam as webhook
from tests.conftest import as_user

IST = timezone(timedelta(hours=5, minutes=30))
MAA, NANI = "+919876500701", "+919876500799"
NEHA, EVE = "ExponentPushToken[neha]", "ExponentPushToken[eve]"


@pytest.fixture(autouse=True)
def settings(monkeypatch):
    if datetime.now(IST).hour == 0 and datetime.now(IST).minute < 2:
        pytest.skip("too close to midnight IST")  # reminders set "a minute ago" would be yesterday
    monkeypatch.setattr(push, "notify_reminder_async", push.notify_reminder)  # inline, so the test sees the push


@pytest.fixture
def family(client):
    client.post("/me/family", headers=as_user("neha"), json={"name": "Verma", "me": {"name": "Neha"}, "parent_phone": MAA,
                                                            "parent": {"parent_name": "Maa", "language": "Hindi", "medicines": "Amlodipine, Metformin"}})
    client.post("/me/family", headers=as_user("eve"), json={"name": "Other", "me": {"name": "Eve"}, "parent_phone": NANI, "parent": {"parent_name": "Nani"}})
    for user, token in (("neha", NEHA), ("eve", EVE)):
        client.post("/me/push-tokens", headers=as_user(user), json={"token": token})


def hhmm(delta_min: int) -> str:
    return (datetime.now(IST) + timedelta(minutes=delta_min)).strftime("%H:%M")


def add(client, time, medicines="Amlodipine 5 mg", user="neha", phone=MAA):
    return client.post("/me/reminders", headers=as_user(user), json={"phone": phone, "time": time, "medicines": medicines})


def run(now=None):
    return reminders.tick(now or datetime.now(timezone.utc))


def answer(attempt, status="connected", meds=None):
    outputs = {"call_summary": "Reminder call."}
    if meds:
        outputs["meds_taken"] = meds
    webhook.save_payload({"attempt_id": attempt, "status": status, "duration": 40 if status == "connected" else 0,
                          "metadata": {"source": "med_reminder"}, "output_agent_variables": outputs if status == "connected" else {}})


def today(client):
    return client.get("/me/family", headers=as_user("neha")).json()["parents"][0]["reminders"]


# ---- the app ---------------------------------------------------------------------

def test_add_change_remove(client, family):
    r = add(client, "20:30").json()
    assert (r["time"], r["medicines"], r["enabled"]) == ("20:30", "Amlodipine 5 mg", True)
    assert today(client)[0]["id"] == r["id"] and today(client)[0]["today"] is None
    assert client.patch(f"/me/reminders/{r['id']}", headers=as_user("neha"), json={"time": "21:00", "enabled": False}).json()["time"] == "21:00"
    assert client.patch(f"/me/reminders/{r['id']}", headers=as_user("eve"), json={"enabled": True}).status_code == 404  # not her family
    assert client.delete(f"/me/reminders/{r['id']}", headers=as_user("eve")).status_code == 404
    assert client.delete(f"/me/reminders/{r['id']}", headers=as_user("neha")).status_code == 200
    assert today(client) == []


def test_limits_and_checks(client, family):
    assert add(client, "8:30").status_code == 422  # HH:MM
    assert add(client, "25:00").status_code == 422
    assert add(client, "08:00", medicines="").status_code == 422
    assert add(client, "08:00", user="eve").status_code == 404  # Maa isn't in Eve's family
    for t in ("08:00", "13:00", "20:00", "22:00"):
        assert add(client, t).status_code == 200
    assert add(client, "23:00").status_code == 409


# ---- ringing -----------------------------------------------------------------------

def test_rings_on_time_with_the_reminder(client, family, sarvam):
    add(client, hhmm(-1), "Amlodipine 5 mg")
    add(client, hhmm(30), "Calcium")  # not yet
    assert run() == {"planned": 1, "placed": 1}
    placed = sarvam.placed[-1]
    assert placed.source == "med_reminder"
    v = placed.variables
    assert (v["call_mode"], v["medicines"], v["call_length_minutes"], v["parent_name"]) == ("medicine_reminder", "Amlodipine 5 mg", "1", "Maa")
    assert placed.opening.startswith("नमस्ते Maa") and "Amlodipine 5 mg" in placed.opening
    assert run() == {"planned": 0, "placed": 0}  # once a day
    assert today(client)[0]["today"]["state"] == "calling"


def test_skipped_next_to_the_evening_call(client, family, sarvam):
    client.put(f"/me/family/parents/{MAA}", headers=as_user("neha"), json={"parent_name": "Maa", "daily_calls": True, "call_time": hhmm(10)})
    add(client, hhmm(-1))
    run()
    assert sarvam.placed == []
    assert today(client)[0]["today"]["state"] == "skipped"


def test_taken_stays_quiet(client, family, sarvam, expo):
    add(client, hhmm(-1))
    run()
    answer(sarvam.placed[-1].attempt_id, meds="all")
    assert expo.sent == []  # no evening card either
    assert today(client)[0]["today"]["state"] == "taken"
    assert _query("SELECT insight FROM calls")[0]["insight"] is None  # not an evening call: no "what changed" card


def test_not_taken_tells_the_family_once(client, family, sarvam, expo):
    add(client, hhmm(-1), "Amlodipine 5 mg")
    run()
    attempt = sarvam.placed[-1].attempt_id
    answer(attempt, meds="none")
    assert [m["to"] for m in expo.sent] == [NEHA]  # not Eve's family
    msg = expo.sent[0]
    assert msg["title"].startswith("Maa hasn't taken the ") and msg["title"].endswith(" medicines")
    assert "Amlodipine 5 mg" in msg["body"] and msg["data"] == {"screen": "medicines", "phone": MAA}
    answer(attempt, meds="none")  # Sarvam retries the webhook
    assert len(expo.sent) == 1
    assert today(client)[0]["today"]["state"] == "not_taken"


def test_no_answer_retries_once_then_tells(client, family, sarvam, expo):
    add(client, hhmm(-1))
    run()
    answer(sarvam.placed[-1].attempt_id, status="no_answer")
    assert expo.sent == []  # one more try first
    assert run()["planned"] == 1
    job = _query("SELECT try, due_at FROM med_jobs ORDER BY try DESC LIMIT 1")[0]
    assert job["try"] == 1 and job["due_at"] > datetime.now(timezone.utc) + timedelta(minutes=14)
    assert today(client)[0]["today"]["state"] == "retrying"
    _query("UPDATE med_jobs SET due_at = now() - interval '1 second' WHERE status = 'pending'")
    assert run()["placed"] == 1
    answer(sarvam.placed[-1].attempt_id, status="no_answer")
    assert expo.sent[-1]["title"].startswith("Maa didn't answer the ")
    assert run()["planned"] == 0  # no third try
    assert today(client)[0]["today"]["state"] == "no_answer"


def test_switched_off_or_stopped(client, family, sarvam):
    r = add(client, hhmm(-1)).json()
    client.patch(f"/me/reminders/{r['id']}", headers=as_user("neha"), json={"enabled": False})
    run()
    assert sarvam.placed == []
    client.patch(f"/me/reminders/{r['id']}", headers=as_user("neha"), json={"enabled": True})
    # "Please don't call me again" on any call switches reminders off too.
    from app.families import stop_daily_calls
    stop_daily_calls(MAA)
    run()
    assert sarvam.placed == []
    assert today(client)[0]["enabled"] is False


def test_reminder_calls_are_labelled_in_the_call_list(client, family, sarvam):
    add(client, hhmm(-1))
    run()
    answer(sarvam.placed[-1].attempt_id, meds="all")
    assert client.get("/me/calls", headers=as_user("neha")).json()[0]["source"] == "med_reminder"


# ---- the Medicines screen's calendar and streak ------------------------------------------

def _reminder_day(rid, days_ago, outcome, try_=0):
    day = (datetime.now(IST) - timedelta(days=days_ago)).date()
    _query("INSERT INTO med_jobs (reminder_id, phone, day, try, due_at, status, outcome) "
           "VALUES (%(r)s, %(p)s, %(d)s, %(t)s, now(), 'placed', %(o)s)",
           {"r": rid, "p": MAA, "d": day, "t": try_, "o": outcome})


def _evening_call(days_ago, meds):
    import uuid
    from app.parents import remember_call
    attempt = str(uuid.uuid4())
    remember_call(MAA, {"parent_name": "Maa"}, attempt, "scheduler")
    webhook.save_payload({"attempt_id": attempt, "status": "connected", "duration": 90, "metadata": {"source": "scheduler"},
                          "output_agent_variables": {"call_summary": "Fine.", "meds_taken": meds}})
    _query("UPDATE calls SET created_at = now() - make_interval(days => %(d)s) WHERE attempt_id = %(a)s", {"d": days_ago, "a": attempt})


def medicine(client):
    return client.get("/me/family", headers=as_user("neha")).json()["parents"][0]["medicine"]


def test_streak_and_calendar(client, family):
    morning = add(client, "08:00").json()["id"]
    night = add(client, "21:00").json()["id"]
    _reminder_day(morning, 6, "taken")
    _reminder_day(morning, 5, "not_taken")  # breaks the run
    for d in (4, 3, 2, 1):
        _reminder_day(morning, d, "taken")
    _reminder_day(night, 2, "taken")
    _reminder_day(night, 3, "no_answer", try_=0)
    _reminder_day(night, 3, "taken", try_=1)  # the retry counts, not the first try
    m = medicine(client)
    assert len(m["days"]) == 30 and m["days"][-1]["day"] == datetime.now(IST).date().isoformat()
    states = [d["state"] for d in m["days"][-7:]]
    assert states == ["taken", "not_taken", "taken", "taken", "taken", "taken", None]
    assert (m["streak"], m["best"], m["taken_days"], m["known_days"]) == (4, 4, 5, 6)  # today has no result yet: run ends yesterday
    day2 = m["days"][-3]
    assert sorted(x["what"] for x in day2["items"]) == ["8:00 am reminder", "9:00 pm reminder"]


def test_evening_calls_count_too(client, family):
    _evening_call(2, "all")
    _evening_call(1, "some")
    m = medicine(client)
    assert [d["state"] for d in m["days"][-3:]] == ["taken", "not_taken", None]
    assert m["days"][-3]["items"][0]["what"].endswith(" call")
    assert m["streak"] == 0


def test_a_day_with_a_missed_reminder_and_a_taken_one_is_partly(client, family):
    a, b = add(client, "08:00").json()["id"], add(client, "21:00").json()["id"]
    _reminder_day(a, 1, "taken")
    _reminder_day(b, 1, "no_answer", try_=1)
    assert medicine(client)["days"][-2]["state"] == "partly"


def test_nothing_yet(client, family):
    m = medicine(client)
    assert (m["streak"], m["best"], m["known_days"]) == (0, 0, 0) and all(d["state"] is None for d in m["days"])
