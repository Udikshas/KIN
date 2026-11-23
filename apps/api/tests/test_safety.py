"""Scam shield, consent and the AI disclosure, and deleting an account."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app import push
from app.families import _query
from app.greetings_util import opening_line
from app.parents import remember_call
from app.routes import sarvam
from tests.conftest import as_user, deleted_users

MAA, NANI = "+919876500401", "+919876500499"
HOOK = {"X-Hook-Token": "h"}
NEHA, ROHAN, EVE = "ExponentPushToken[neha]", "ExponentPushToken[rohan]", "ExponentPushToken[eve]"


@pytest.fixture(autouse=True)
def settings(monkeypatch):
    monkeypatch.setenv("SARVAM_HOOK_TOKEN", "h")
    monkeypatch.setattr(push, "notify_urgent_async", push.notify_urgent)


@pytest.fixture
def family(client):
    client.post("/me/family", headers=as_user("neha"), json={"name": "Verma", "me": {"name": "Neha"}, "parent_phone": MAA, "parent": {"parent_name": "Maa"}})
    client.post("/me/family", headers=as_user("eve"), json={"name": "Other", "me": {"name": "Eve"}, "parent_phone": NANI, "parent": {"parent_name": "Nani"}})
    client.post("/me/family/members", headers=as_user("neha"),
                json={"name": "Rohan", "relation": "Son", "phone": "+919820000888", "is_emergency": True, "email": "rohan@example.com"})
    client.get("/me", headers=as_user("rohan"))
    for user, token in (("neha", NEHA), ("rohan", ROHAN), ("eve", EVE)):
        client.post("/me/push-tokens", headers=as_user(user), json={"token": token})


def call(phone, outputs):
    attempt = str(uuid.uuid4())
    remember_call(phone, {"parent_name": "Maa"}, attempt, "scheduler")
    sarvam.save_payload({"attempt_id": attempt, "status": "connected", "duration": 70,
                         "metadata": {"source": "scheduler"}, "output_agent_variables": outputs})


def parent(client, user="neha"):
    return client.get("/me/family", headers=as_user(user)).json()["parents"][0]


# ---- scam shield ------------------------------------------------------------

def test_scam_warns_the_family_and_coaches_kin(client, family, expo):
    assert client.post("/hooks/scam", json={"phone": MAA}).status_code == 401
    r = client.post("/hooks/scam", headers=HOOK, json={"user_identifier": MAA, "reason": "caller from 'the bank' asked for the OTP"})
    assert r.status_code == 200
    body = r.json()
    assert body["family_alerted"] is True and "OTP" in body["say_to_parent"] and "family has been told" in body["say_to_parent"]
    assert "emergency_number" not in body  # no transfer for a scam
    assert {m["to"] for m in expo.sent} == {NEHA, ROHAN}
    assert expo.sent[0]["title"] == "Scam warning: Maa may be talking to a scammer"
    assert "asked for the OTP" in expo.sent[0]["body"]
    event = parent(client)["urgent"]
    assert event["kind"] == "scam" and "OTP" in event["reason"]


def test_an_emergency_outranks_a_scam_warning(client, family, expo):
    client.post("/hooks/scam", headers=HOOK, json={"phone": MAA, "reason": "lottery prize, asked for a fee"})
    client.post("/hooks/urgent", headers=HOOK, json={"phone": MAA, "reason": "chest pain"})
    assert len(expo.sent) == 4  # both pushed: a scam flag never swallows an emergency
    event = parent(client)["urgent"]
    assert event["kind"] == "urgent"
    client.post(f"/me/urgent/{event['id']}/handled", headers=as_user("neha"))
    assert parent(client)["urgent"]["kind"] == "scam"


def test_scam_from_an_unknown_number_still_coaches_kin(client, expo):
    r = client.post("/hooks/scam", headers=HOOK, json={"phone": "+919999999999"})
    assert r.json()["family_alerted"] is False and r.json()["say_to_parent"]
    assert "family has been told" not in r.json()["say_to_parent"]  # nobody was told
    assert expo.sent == []


# ---- consent and disclosure --------------------------------------------------

def test_kin_says_it_is_an_ai_until_the_parent_agrees(family, monkeypatch):
    """The real place_outbound, with only Sarvam's HTTP call faked."""
    from app import sarvam_outbound

    for key in sarvam_outbound.REQUIRED:
        monkeypatch.setenv(key, "x")
    sent = []

    class _Ok:
        status_code = 200

        def json(self):
            return {"attempt_id": str(uuid.uuid4())}

    def fake_post(url, json, headers, timeout):
        sent.append(json["app_config"]["app_overrides"]["initial_bot_message"])
        return _Ok()

    monkeypatch.setattr(sarvam_outbound.httpx, "post", fake_post)
    sarvam_outbound.place_outbound(MAA, {"parent_name": "Maa", "language": "English"}, source="app")
    assert "I am an AI assistant, not a person." in sent[-1]
    assert sent[-1].endswith("?")  # still ends on the question
    call(MAA, {"call_summary": "Said yes.", "consent_given": True})
    sarvam_outbound.place_outbound(MAA, {"parent_name": "Maa", "language": "English"}, source="app")
    assert "AI assistant" not in sent[-1]


def test_unknown_callers_hear_it_too(client):
    r = client.post("/hooks/on-start", headers=HOOK, json={"phone": "+919999999990", "direction": "inbound"})
    assert "AI सहायक" in r.json()["custom_app_config"]["initial_bot_message"]


def test_parent_says_stop_and_kin_stops(client, family, expo):
    client.put(f"/me/family/parents/{MAA}", headers=as_user("neha"), json={"parent_name": "Maa", "daily_calls": True, "call_time": "19:00"})
    call(MAA, {"call_summary": "First call.", "consent_given": True})
    assert parent(client)["consent_at"] and parent(client)["daily_calls"] is True
    today = datetime.now(timezone(timedelta(hours=5, minutes=30))).date()
    _query("INSERT INTO call_jobs (phone, day, try, due_at) VALUES (%(p)s, %(d)s, 1, now() + interval '1 hour')", {"p": MAA, "d": today})
    call(MAA, {"call_summary": "Asked not to be called.", "stop_calls": True, "consent_given": False})
    p = parent(client)
    assert p["daily_calls"] is False and p["consent_at"] is None
    assert _query("SELECT status FROM call_jobs WHERE phone = %(p)s", {"p": MAA})[0]["status"] == "skipped"
    assert expo.sent[-1]["title"] == "Maa asked Kin to stop calling"


# ---- deleting an account ------------------------------------------------------

def test_a_member_leaves_and_the_family_stays(client, family):
    r = client.delete("/me", headers=as_user("rohan"))
    assert r.status_code == 200 and r.json() == {"deleted": "membership"}
    assert deleted_users == ["rohan"]
    assert client.get("/me/family", headers=as_user("neha")).status_code == 200
    names = [m["name"] for m in client.get("/me/family", headers=as_user("neha")).json()["members"]]
    assert "Rohan" not in names
    assert _query("SELECT count(*) AS n FROM push_tokens WHERE user_id = 'rohan'")[0]["n"] == 0


def test_the_owner_deletes_everything(client, family):
    call(MAA, {"call_summary": "A good day.", "message_for_family": "Bring my glasses"})
    client.post("/hooks/urgent", headers=HOOK, json={"phone": MAA, "reason": "dizzy"})
    r = client.delete("/me", headers=as_user("neha"))
    assert r.json() == {"deleted": "family", "parents": 1}
    for table in ("calls", "call_attempts", "webhook_events", "urgent_events", "family_messages"):
        assert _query(f"SELECT count(*) AS n FROM {table} WHERE phone = %(p)s", {"p": MAA})[0]["n"] == 0, table
    assert _query("SELECT count(*) AS n FROM parents WHERE phone = %(p)s", {"p": MAA})[0]["n"] == 0
    assert _query("SELECT count(*) AS n FROM members WHERE name IN ('Neha', 'Rohan')")[0]["n"] == 0
    assert client.get("/me/family", headers=as_user("neha")).status_code == 404
    assert client.get("/me/family", headers=as_user("eve")).status_code == 200  # other families untouched
    assert _query("SELECT count(*) AS n FROM parents WHERE phone = %(p)s", {"p": NANI})[0]["n"] == 1


def test_needs_a_session(client):
    assert client.delete("/me").status_code == 401
