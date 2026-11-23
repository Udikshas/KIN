"""Red alerts that act (app/urgent.py): the agent flags an emergency mid-call, the family hears at once."""

import pytest

from app import push
from app.families import _query
from tests.conftest import as_user

MAA, NANI = "+919876500301", "+919876500399"
HOOK = {"X-Hook-Token": "h"}
NEHA, ROHAN, EVE = "ExponentPushToken[neha]", "ExponentPushToken[rohan]", "ExponentPushToken[eve]"


@pytest.fixture(autouse=True)
def settings(monkeypatch):
    monkeypatch.setenv("SARVAM_HOOK_TOKEN", "h")
    monkeypatch.setattr(push, "notify_urgent_async", push.notify_urgent)  # inline, so the test sees the push


@pytest.fixture
def family(client):
    client.post("/me/family", headers=as_user("neha"), json={"name": "Verma", "me": {"name": "Neha"}, "parent_phone": MAA, "parent": {"parent_name": "Maa"}})
    client.post("/me/family", headers=as_user("eve"), json={"name": "Other", "me": {"name": "Eve"}, "parent_phone": NANI, "parent": {"parent_name": "Nani"}})
    client.post("/me/family/members", headers=as_user("neha"),
                json={"name": "Rohan", "relation": "Son", "phone": "+919820000888", "is_emergency": True, "email": "rohan@example.com"})
    client.get("/me", headers=as_user("rohan"))
    for user, token in (("neha", NEHA), ("rohan", ROHAN), ("eve", EVE)):
        client.post("/me/push-tokens", headers=as_user(user), json={"token": token})


def flag(client, body):
    return client.post("/hooks/urgent", headers=HOOK, json=body)


def test_needs_the_hook_token(client):
    assert client.post("/hooks/urgent", json={"phone": MAA}).status_code == 401
    assert client.post("/hooks/urgent", headers={"X-Hook-Token": "wrong"}, json={"phone": MAA}).status_code == 401


def test_family_is_pushed_at_once_and_agent_gets_the_number(client, family, expo):
    r = flag(client, {"user_identifier": MAA, "reason": "fell in the bathroom, can't get up"})
    assert r.status_code == 200
    assert r.json() == {"status": "family alerted", "family_alerted": True, "emergency_contact": "Rohan", "emergency_number": "+919820000888"}
    assert {m["to"] for m in expo.sent} == {NEHA, ROHAN}  # not Eve's family
    msg = expo.sent[0]
    assert msg["title"] == "Urgent: Maa may need help" and msg["data"] == {"screen": "alert", "phone": MAA}
    assert "fell in the bathroom" in msg["body"] and "connecting Maa to Rohan" in msg["body"]


def test_repeat_flags_in_one_emergency_push_once(client, family, expo):
    flag(client, {"phone": MAA, "reason": "chest pain"})
    n = len(expo.sent)
    r = flag(client, {"phone": MAA, "reason": "chest pain, still"})
    assert r.json()["family_alerted"] is True and len(expo.sent) == n
    assert _query("SELECT count(*) AS n FROM urgent_events")[0]["n"] == 1


def test_the_app_shows_it_until_handled(client, family):
    flag(client, {"phone": MAA, "reason": "can't breathe properly"})
    parent = client.get("/me/family", headers=as_user("neha")).json()["parents"][0]
    event = parent["urgent"]
    assert event and event["reason"] == "can't breathe properly"
    assert client.post(f"/me/urgent/{event['id']}/handled", headers=as_user("eve")).status_code == 404
    assert client.post(f"/me/urgent/{event['id']}/handled", headers=as_user("rohan")).status_code == 200
    assert client.get("/me/family", headers=as_user("neha")).json()["parents"][0]["urgent"] is None
    assert client.post(f"/me/urgent/{event['id']}/handled", headers=as_user("neha")).status_code == 404  # already handled


def test_without_an_emergency_contact(client, expo):
    client.post("/me/family", headers=as_user("solo"), json={"name": "Solo", "me": {"name": "Asha"}, "parent_phone": MAA, "parent": {"parent_name": "Maa"}})
    client.post("/me/push-tokens", headers=as_user("solo"), json={"token": NEHA})
    r = flag(client, {"phone": MAA, "reason": "dizzy"})
    assert r.json()["emergency_number"] == "" and r.json()["emergency_contact"] == ""
    assert "Call Maa now." in expo.sent[-1]["body"]


def test_never_breaks_the_call(client, family, expo):
    assert flag(client, {"reason": "no number"}).json()["family_alerted"] is False
    assert flag(client, {"phone": "+919999999999", "reason": "unknown"}).json()["family_alerted"] is False
    assert client.post("/hooks/urgent", headers=HOOK, content=b"not json").status_code == 200
    assert not expo.sent
