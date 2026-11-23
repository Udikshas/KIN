"""Push notifications (app/push.py) and tonight's daily-call status (me.daily_status)."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app import me
from app.families import _query
from app.parents import remember_call
from app.routes import sarvam
from tests.conftest import as_user

IST = timezone(timedelta(hours=5, minutes=30))
MAA, PAPA, NANI = "+919876500101", "+919876500102", "+919876500199"
NEHA, ROHAN, EVE = "ExponentPushToken[neha-phone]", "ExponentPushToken[rohan-phone]", "ExponentPushToken[eve-phone]"
NAMES = {MAA: "Maa", NANI: "Nani", PAPA: "Papa"}


@pytest.fixture
def phones(client):
    client.post("/me/family", headers=as_user("neha"), json={"name": "Verma", "me": {"name": "Neha"}, "parent_phone": MAA,
                                                              "parent": {"parent_name": "Maa", "call_time": "19:30", "daily_calls": True}})
    client.post("/me/family", headers=as_user("eve"), json={"name": "Other", "me": {"name": "Eve"}, "parent_phone": NANI, "parent": {"parent_name": "Nani"}})
    client.post("/me/family/members", headers=as_user("neha"), json={"name": "Rohan", "relation": "Son", "phone": "+919820000777"})
    for user, token, platform in (("neha", NEHA, "ios"), ("neha", ROHAN, "android"), ("eve", EVE, None)):
        assert client.post("/me/push-tokens", headers=as_user(user), json={"token": token, "platform": platform}).status_code == 200


def webhook(phone, status="connected", source="scheduler", outputs=None, attempt=None):
    if not attempt:
        attempt = str(uuid.uuid4())
        remember_call(phone, {"parent_name": NAMES.get(phone, "x")}, attempt, source)
    payload = {"attempt_id": attempt, "status": status, "duration": 70 if status == "connected" else 0, "metadata": {"source": source},
               "output_agent_variables": outputs or ({"call_summary": "Ate on time, back is better."} if status == "connected" else {})}
    sarvam.save_payload(payload)
    return attempt, payload


def scheduled(phone, try_, day=None):
    """A scheduler attempt (try 0 = evening call, 1-2 = retries) to `phone`."""
    attempt = str(uuid.uuid4())
    remember_call(phone, {"parent_name": NAMES[phone]}, attempt, "scheduler")
    _query("INSERT INTO call_jobs (phone, day, try, due_at, status, attempt_id) VALUES (%(p)s, %(d)s, %(t)s, now(), 'placed', %(a)s) RETURNING id",
           {"p": phone, "d": day or datetime.now(IST).date(), "t": try_, "a": attempt})
    return attempt


def test_tokens_need_a_family_and_a_valid_shape(client):
    assert client.post("/me/push-tokens", json={"token": NEHA}).status_code == 401
    assert client.post("/me/push-tokens", headers=as_user("nobody"), json={"token": NEHA}).status_code == 404
    client.post("/me/family", headers=as_user("neha"), json={"name": "V", "me": {"name": "Neha"}, "parent_phone": MAA, "parent": {"parent_name": "Maa"}})
    assert client.post("/me/push-tokens", headers=as_user("neha"), json={"token": "not-a-token"}).status_code == 422


def test_evening_card(phones, expo):
    a1, payload = webhook(MAA)
    assert {m["to"] for m in expo.sent} == {NEHA, ROHAN}  # the family's phones, not Eve's
    msg = expo.sent[0]
    assert msg["title"] == "Maa's call card is ready" and "back is better" in msg["body"] and msg["channelId"] == "default"
    call_id = _query("SELECT id FROM calls WHERE attempt_id = %(a)s", {"a": a1})[0]["id"]
    assert msg["data"]["callId"] == call_id

    n = len(expo.sent)
    sarvam.save_payload(payload)  # Sarvam delivers the same webhook again
    assert len(expo.sent) == n


def test_signal_sets_the_title(phones, expo):
    webhook(MAA, outputs={"call_summary": "Fell in the bathroom.", "urgent_flag": True})
    assert expo.sent[-1]["title"] == "Maa needs attention"
    webhook(MAA, outputs={"call_summary": "Knee hurts.", "pain_mentioned": True})
    assert expo.sent[-1]["title"] == "Maa's call card: something to watch"


def test_who_gets_nothing(phones, expo):
    webhook(MAA, source="demo")  # Try-it
    webhook(PAPA, status="no_answer")  # a number with no family
    webhook(MAA, status="no_answer", source="app")  # "call now": the app shows it live
    assert not expo.sent
    webhook(NANI)
    assert {m["to"] for m in expo.sent} == {EVE}


def test_no_answer_waits_for_the_last_try(phones, expo):
    for try_ in (0, 1):
        webhook(MAA, status="no_answer", attempt=scheduled(MAA, try_))
        assert not expo.sent  # Kin is still retrying
    webhook(MAA, status="no_answer", attempt=scheduled(MAA, 2))
    assert expo.sent[-1]["title"] == "Maa didn't answer tonight" and "3 times" in expo.sent[-1]["body"]


def test_three_days_without_an_answer(phones, expo):
    for days in (2, 1):
        _query("INSERT INTO calls (phone, direction, attempt_id, status, outputs, created_at) "
               "VALUES (%(p)s, 'outbound', %(a)s, 'no_answer', '{}', now() - make_interval(days => %(d)s)) RETURNING id",
               {"p": MAA, "a": str(uuid.uuid4()), "d": days})
    webhook(MAA, status="no_answer", attempt=scheduled(MAA, 2))
    assert expo.sent[-1]["title"] == "Maa hasn't answered for 3 days" and expo.sent[-1]["data"] == {"screen": "alert", "phone": MAA}


def test_dead_tokens_introductions_and_sign_out(client, phones, expo):
    expo.dead.add(ROHAN)
    webhook(MAA)
    left = [r["token"] for r in _query("SELECT token FROM push_tokens")]
    assert ROHAN not in left and NEHA in left  # DeviceNotRegistered -> removed

    n = len(expo.sent)
    sarvam.save_payload({"attempt_id": str(uuid.uuid4()), "interaction_id": "intro-1", "user_phone_number": "+919820000777", "status": "connected",
                         "duration": 80, "deployment_id": "d", "output_agent_variables": {"call_summary": "Introduced Kin.", "consent_given": True}})
    assert len(expo.sent) == n  # a family member's introduction call

    assert client.request("DELETE", "/me/push-tokens", headers=as_user("neha"), json={"token": NEHA}).status_code == 200
    webhook(MAA)
    assert len(expo.sent) == n


# ---- tonight's status in the app -------------------------------------------------------------

B = "+919876500150"


def status(now):
    return me.daily_status(B, True, "19:30", now)


def at(h, m):
    return (datetime(2031, 3, 3, h, 0, tzinfo=IST) + timedelta(minutes=m)).astimezone(timezone.utc)


def job(try_, state, result=None):
    attempt = str(uuid.uuid4())
    _query("INSERT INTO call_jobs (phone, day, try, due_at, status, attempt_id) VALUES (%(p)s, '2031-03-03', %(t)s, %(due)s, %(s)s, %(a)s) RETURNING id",
           {"p": B, "t": try_, "due": at(19, 30 + 20 * try_), "s": state, "a": attempt})
    if result:
        _query("INSERT INTO webhook_events (kind, attempt_id, status, payload) VALUES ('outbound', %(a)s, %(s)s, '{}') RETURNING id", {"a": attempt, "s": result})


def test_daily_status_through_an_evening():
    assert me.daily_status(B, False, "19:30") is None
    s = status(at(15, 0))
    assert s["state"] == "scheduled" and datetime.fromisoformat(s["at"]) == at(19, 30)
    s = status(at(23, 0))
    assert s["state"] == "scheduled" and datetime.fromisoformat(s["at"]) == at(19, 30) + timedelta(days=1)

    job(0, "placed")
    assert status(at(19, 31))["state"] == "calling"
    _query("DELETE FROM call_jobs RETURNING id")
    job(0, "placed", "no_answer")
    s = status(at(19, 35))
    assert s["state"] == "retrying" and s["at"] is None  # retry not planned yet
    job(1, "pending")
    s = status(at(19, 40))
    assert s["state"] == "retrying" and datetime.fromisoformat(s["at"]).astimezone(IST).strftime("%H:%M") == "19:50"
    _query("UPDATE call_jobs SET status = 'placed' WHERE try = 1 RETURNING id")
    _query("INSERT INTO webhook_events (kind, attempt_id, status, payload) SELECT 'outbound', attempt_id, 'no_answer', '{}' FROM call_jobs WHERE try = 1 RETURNING id")
    job(2, "placed", "no_answer")
    s = status(at(20, 15))
    assert s["state"] == "missed" and s["tries"] == 3 and datetime.fromisoformat(s["next"]).astimezone(IST).date().isoformat() == "2031-03-04"


def test_daily_status_answered():
    job(0, "placed", "no_answer")
    job(1, "placed", "connected")
    assert status(at(20, 0))["state"] == "answered"


def test_family_view_carries_the_status(client, phones):
    parent = client.get("/me/family", headers=as_user("neha")).json()["parents"][0]
    assert parent["daily"]["state"] in ("scheduled", "calling", "retrying", "answered", "missed", "failed")


def test_push_test_goes_to_the_callers_own_phones(client, phones, expo):
    assert client.post("/me/push-test", json={}).status_code == 401
    n = len(expo.sent)
    r = client.post("/me/push-test", headers=as_user("neha"), json={"kind": "amber"})
    assert r.status_code == 200 and r.json()["phones"] == 2
    assert {m["to"] for m in expo.sent[n:]} == {NEHA, ROHAN} and "something to watch" in expo.sent[n]["title"]
    client.post("/me/family/members", headers=as_user("neha"), json={"name": "Zed", "relation": "Son", "phone": "+919820000888"})
    assert client.post("/me/push-test", headers=as_user("zed"), json={}).status_code in (404, 409)  # no phone registered
