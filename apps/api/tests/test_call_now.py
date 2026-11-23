"""'Ask Kin to call now' from the app: the parent or a family member, with every limit."""

import uuid

import pytest

from app.parents import _run, record_call, remember_call, store_event
from app.routes import me as me_routes
from tests.conftest import as_user

AMMA = "+919876500001"
OTHER = "+919876500002"  # Eve's parent
URL = f"/me/family/parents/{AMMA}/call"
NOW = {"confirm": True}


@pytest.fixture(autouse=True)
def limits(monkeypatch):
    monkeypatch.setattr(me_routes, "CALL_COOLDOWN_S", 600)
    monkeypatch.setattr(me_routes, "CALLS_PER_DAY", 3)
    monkeypatch.setenv("SARVAM_HOOK_TOKEN", "h")
    for k in ("SARVAM_APPS_API_KEY", "SARVAM_ORG_ID", "SARVAM_WORKSPACE_ID", "SARVAM_APP_ID", "SARVAM_CONNECTION_ID", "SARVAM_AGENT_PHONE"):
        monkeypatch.setenv(k, "x")


@pytest.fixture
def families(client):
    r = client.post("/me/family", headers=as_user("neha"), json={
        "name": "Verma family", "me": {"name": "Neha", "relation": "Daughter"}, "parent_phone": AMMA,
        "parent": {"parent_name": "Amma", "language": "Hindi", "medicines": "BP tablet", "call_length_minutes": 1},
    })
    assert r.status_code == 200, r.text
    client.post("/me/family", headers=as_user("eve"), json={"name": "Other", "me": {"name": "Eve"}, "parent_phone": OTHER,
                                                             "parent": {"parent_name": "Papa"}})


def finish(attempt, status="connected"):
    payload = {"attempt_id": attempt, "status": status, "duration": 70 if status == "connected" else 0, "metadata": {"source": "app"},
               "output_agent_variables": {"call_summary": "Fine today."} if status == "connected" else {}}
    store_event(payload, None)
    phone = _run("SELECT phone FROM call_attempts WHERE attempt_id = %(a)s", {"a": attempt}, fetch=True)[0]
    record_call(phone, payload)


def age(attempt, seconds):
    """Pretend the attempt was placed `seconds` ago."""
    _run("UPDATE call_attempts SET created_at = now() - make_interval(secs => %(s)s) WHERE attempt_id = %(a)s", {"s": seconds, "a": attempt})


def test_who_may_ask(client, families, sarvam):
    assert client.post(URL, json=NOW).status_code == 401
    assert client.post(URL, headers=as_user("neha"), json={}).status_code == 422  # must confirm
    assert client.post(URL, headers=as_user("eve"), json=NOW).status_code == 404  # someone else's parent
    assert client.post("/me/family/parents/+919999999999/call", headers=as_user("neha"), json=NOW).status_code == 404
    assert not sarvam.placed


def test_call_the_parent_and_follow_it(client, families, sarvam):
    r = client.post(URL, headers=as_user("neha"), json=NOW)
    assert r.status_code == 200 and r.json()["parent_name"] == "Amma"
    a1 = r.json()["attempt_id"]
    call = sarvam.placed[-1]
    assert call.phone == AMMA and call.source == "app"
    assert call.variables["parent_name"] == "Amma" and call.variables["language"] == "Hindi"
    assert call.variables["medicines"] == "BP tablet" and call.variables["call_length_minutes"] == "1"

    second = client.post(URL, headers=as_user("neha"), json=NOW)
    assert second.status_code == 409 and "already calling" in second.json()["detail"]
    assert len(sarvam.placed) == 1  # a double tap places one call

    assert client.get(f"/me/attempts/{a1}", headers=as_user("neha")).json()["state"] == "calling"
    client.post("/hooks/on-start", headers={"X-Hook-Token": "h"}, json={"phone": AMMA, "direction": "outbound"})
    assert client.get(f"/me/attempts/{a1}", headers=as_user("neha")).json()["state"] == "connected"
    assert client.get(f"/me/attempts/{a1}", headers=as_user("eve")).status_code == 404

    finish(a1)
    done = client.get(f"/me/attempts/{a1}", headers=as_user("neha")).json()
    assert done["state"] == "done" and done["call_id"] and done["status"] == "connected"
    calls = client.get("/me/calls", headers=as_user("neha")).json()
    assert calls[0]["id"] == done["call_id"] and calls[0]["summary"] == "Fine today."


def test_cooldown_failure_timeout_and_daily_limit(client, families, sarvam):
    a1 = client.post(URL, headers=as_user("neha"), json=NOW).json()["attempt_id"]
    finish(a1)
    r = client.post(URL, headers=as_user("neha"), json=NOW)
    assert r.status_code == 429 and "min ago" in r.json()["detail"]

    age(a1, 700)
    sarvam.fail = True
    assert client.post(URL, headers=as_user("neha"), json=NOW).status_code == 502
    sarvam.fail = False
    r = client.post(URL, headers=as_user("neha"), json=NOW)
    assert r.status_code == 200  # a failed call doesn't start a cooldown
    a2 = r.json()["attempt_id"]

    age(a2, 9 * 60)
    assert client.get(f"/me/attempts/{a2}", headers=as_user("neha")).json()["state"] == "timeout"
    age(a2, 700)
    r = client.post(URL, headers=as_user("neha"), json=NOW)
    assert r.status_code == 200  # third call today
    age(r.json()["attempt_id"], 700)
    r = client.post(URL, headers=as_user("neha"), json=NOW)
    assert r.status_code == 429 and "today's 3 calls" in r.json()["detail"]


def test_another_call_under_way_blocks(client, families):
    remember_call(AMMA, {"parent_name": "Amma"}, str(uuid.uuid4()), "demo")  # a Try-it call to the same number
    assert client.post(URL, headers=as_user("neha"), json=NOW).status_code == 409
    assert client.get("/me/attempts/not-a-real-id", headers=as_user("neha")).status_code == 404


def test_call_a_family_member(client, families, sarvam):
    kavya_phone = "+919876500033"
    kavya = client.post("/me/family/members", headers=as_user("neha"), json={"name": "Kavya", "relation": "Daughter", "phone": kavya_phone}).json()
    raj = client.post("/me/family/members", headers=as_user("neha"), json={"name": "Raj", "relation": "Son"}).json()
    spy = client.post("/me/family/members", headers=as_user("neha"), json={"name": "Spy", "phone": OTHER}).json()  # Eve's parent's number
    url = lambda m: f"/me/family/members/{m['id']}/call"  # noqa: E731

    assert client.post(url(kavya), headers=as_user("neha"), json={}).status_code == 422
    assert client.post(url(kavya), headers=as_user("eve"), json=NOW).status_code == 404
    r = client.post(url(raj), headers=as_user("neha"), json=NOW)
    assert r.status_code == 422 and "phone number for Raj" in r.json()["detail"]
    assert client.post(url(spy), headers=as_user("neha"), json=NOW).status_code == 409  # another family's parent
    assert not sarvam.placed

    r = client.post(url(kavya), headers=as_user("neha"), json=NOW)
    assert r.status_code == 200 and r.json()["parent_name"] == "Kavya"
    ak = r.json()["attempt_id"]
    assert sarvam.placed[-1].phone == kavya_phone and sarvam.placed[-1].variables["parent_name"] == "Kavya"
    fam = client.get("/me/family", headers=as_user("neha")).json()
    assert [p["phone"] for p in fam["parents"]] == [AMMA, kavya_phone]  # Amma stays first; Kavya gets her own profile
    assert client.post(url(kavya), headers=as_user("neha"), json=NOW).status_code == 409

    finish(ak)
    done = client.get(f"/me/attempts/{ak}", headers=as_user("neha")).json()
    assert done["state"] == "done"
    assert client.get(f"/me/calls/{done['call_id']}", headers=as_user("neha")).json()["phone"] == kavya_phone
    amma_calls = client.get(f"/me/calls?phone={AMMA}", headers=as_user("neha")).json()
    assert done["call_id"] not in [c["id"] for c in amma_calls]  # Amma's history stays hers
    age(ak, 700)
    assert client.post(url(kavya), headers=as_user("neha"), json=NOW).status_code == 200
