"""/me: families, members, invites, parents, calls and what each user may see."""

from app.families import family_variables
from app.parents import record_call
from tests.conftest import as_user

MAA = "+919876543210"
FAMILY = {
    "name": "Sharma family",
    "me": {"name": "Neha", "relation": "Daughter", "phone": "+6581234567", "city": "Singapore"},
    "parent_phone": "98765 43210",
    "parent": {
        "parent_name": "Amma", "language": "Hindi", "city": "Lucknow",
        "medicines": "Amlodipine 5 mg after breakfast, Metformin 500 mg after lunch",
        "call_time": "19:15", "call_length_minutes": 3,
    },
}


def seed_calls():
    def call(i, status, outputs, created):
        record_call(MAA, {
            "attempt_id": f"a{i}", "interaction_id": f"i{i}", "status": status, "duration": 180,
            "output_agent_variables": outputs,
            "interaction_transcript": [{"role": "agent", "en_text": "Hello", "indic_text": "नमस्ते"}, {"role": "user", "en_text": "Fine"}],
        }, received_at=created)

    call(1, "connected", {"call_summary": "Fine day.", "meds_taken": "all", "mood": "ok", "sleep_quality": 4}, "2026-10-25T13:45:00Z")
    call(2, "connected", {"call_summary": "Knee pain.", "meds_taken": "all", "mood": "ok", "pain_mentioned": True, "pain_location": "knee"}, "2026-10-26T13:45:00Z")
    call(3, "no_answer", {}, "2026-10-27T13:45:00Z")
    call(4, "connected", {"call_summary": "Low.", "meds_taken": "some", "mood": "low"}, "2026-10-28T13:45:00Z")
    call(5, "connected", {"call_summary": "Pain again.", "meds_taken": "all", "mood": "ok", "pain_mentioned": True, "wants_family_callback": True}, "2026-10-29T13:45:00Z")
    # An unknown caller from the same number: kept, but never shown or used as memory.
    record_call(MAA, {"attempt_id": "x", "interaction_id": "x", "status": "connected", "output_agent_variables": {}}, caller_known=False)


def test_no_family_yet(client):
    r = client.get("/me", headers=as_user("neha"))
    assert r.status_code == 200 and r.json()["family_id"] is None
    assert client.get("/me/family", headers=as_user("neha")).status_code == 404
    assert client.get("/me/family").status_code == 401


def test_create_family(client):
    r = client.post("/me/family", json=FAMILY, headers=as_user("neha"))
    assert r.status_code == 200, r.text
    fam = r.json()
    assert fam["parents"][0]["phone"] == MAA  # normalised to E.164
    owner = fam["members"][0]
    assert owner["role"] == "owner" and owner["linked"]
    assert client.post("/me/family", json=FAMILY, headers=as_user("neha")).status_code == 409  # one family per user


def test_a_stranger_cannot_claim_a_parent(client):
    client.post("/me/family", json=FAMILY, headers=as_user("neha"))
    eve = {**FAMILY, "me": {"name": "Eve"}}
    assert client.post("/me/family", json=eve, headers=as_user("eve")).status_code == 409
    assert client.post("/me/family", json={**eve, "parent_phone": "+919999999999"}, headers=as_user("eve")).status_code == 200
    assert client.put(f"/me/family/parents/{MAA}", json={"parent_name": "Amma"}, headers=as_user("eve")).status_code == 409


def test_calls_signals_and_alert(client):
    client.post("/me/family", json=FAMILY, headers=as_user("neha"))
    seed_calls()
    r = client.get("/me/calls", headers=as_user("neha"))
    calls = r.json()
    assert r.status_code == 200 and len(calls) == 5  # the unknown caller's call is hidden
    assert [c["signal"] for c in calls] == ["amber", "amber", None, "amber", "green"]
    assert "transcript" not in calls[0]
    detail = client.get(f"/me/calls/{calls[0]['id']}", headers=as_user("neha")).json()
    assert detail["summary"] == "Pain again." and "transcript" not in detail

    parent = client.get("/me/family", headers=as_user("neha")).json()["parents"][0]
    assert parent["alert"]["level"] == "amber" and parent["alert"]["pain_days"] == 2
    assert "family to call back" in parent["open_threads"]


def test_invites_and_isolation(client):
    fam = client.post("/me/family", json=FAMILY, headers=as_user("neha")).json()
    seed_calls()
    r = client.post("/me/family/members", json={"name": "Rahul", "relation": "Son", "phone": "+919820000000", "is_emergency": True,
                                                "email": "RAHUL@example.com"}, headers=as_user("neha"))
    assert r.status_code == 200 and r.json()["linked"] is False

    # Rahul's first sign-in claims the invite (email matched case-insensitively).
    assert client.get("/me", headers=as_user("rahul")).json()["family_id"] == fam["family"]["id"]
    assert len(client.get("/me/calls", headers=as_user("rahul")).json()) == 5
    calls = client.get("/me/calls", headers=as_user("neha")).json()
    assert client.get("/me/calls", headers=as_user("eve")).status_code == 404
    assert client.get(f"/me/calls/{calls[0]['id']}", headers=as_user("eve")).status_code == 404
    assert "Rahul" in family_variables(MAA).get("family_context", "")


def test_member_rules(client):
    client.post("/me/family", json=FAMILY, headers=as_user("neha"))
    client.post("/me/family/members", json={"name": "Rahul", "phone": "+919820000000", "is_emergency": True}, headers=as_user("neha"))
    client.post("/me/family/members", json={"name": "Aarav", "relation": "Grandchild", "is_emergency": True}, headers=as_user("neha"))
    members = client.get("/me/family", headers=as_user("neha")).json()["members"]
    assert sum(m["is_emergency"] for m in members) == 1  # one red alert contact per family
    owner = [m for m in members if m["role"] == "owner"][0]
    assert client.delete(f"/me/family/members/{owner['id']}", headers=as_user("neha")).status_code == 409  # not yourself
    duplicate = client.post("/me/family/members", json={"name": "Dup", "phone": "+919820000000"}, headers=as_user("neha"))
    assert duplicate.status_code == 409


def test_member_edit_clears_fields_and_remove(client):
    client.post("/me/family", json=FAMILY, headers=as_user("neha"))
    kavya = client.post("/me/family/members", json={"name": "Kavya", "phone": "+919820022222", "city": "Delhi"}, headers=as_user("neha")).json()
    r = client.patch(f"/me/family/members/{kavya['id']}", json={"name": "Kavya", "city": "Mumbai", "phone": None}, headers=as_user("neha"))
    assert r.status_code == 200 and r.json()["city"] == "Mumbai" and r.json()["phone"] is None
    assert client.delete(f"/me/family/members/{kavya['id']}", headers=as_user("neha")).status_code == 200
    assert all(m["name"] != "Kavya" for m in client.get("/me/family", headers=as_user("neha")).json()["members"])


def test_parent_update_keeps_other_fields(client):
    client.post("/me/family", json=FAMILY, headers=as_user("neha"))
    r = client.put(f"/me/family/parents/{MAA}", json={"parent_name": "Amma", "call_time": "20:00", "medicines": "Calcium after dinner"},
                   headers=as_user("neha"))
    parent = client.get("/me/family", headers=as_user("neha")).json()["parents"][0]
    assert r.status_code == 200 and parent["call_time"] == "20:00" and parent["language"] == "Hindi"
    bad = client.put(f"/me/family/parents/{MAA}", json={"parent_name": "X", "call_time": "25:00"}, headers=as_user("neha"))
    assert bad.status_code == 422


def test_change_parent_phone_moves_everything(client):
    client.post("/me/family", json=FAMILY, headers=as_user("neha"))
    seed_calls()
    neha = as_user("neha")
    client.post("/me/reminders", json={"phone": MAA, "time": "08:30", "medicines": "Amlodipine"}, headers=neha)
    client.post("/me/groceries", json={"phone": MAA, "items": [{"name": "Atta", "qty": "5 kg"}]}, headers=neha)
    new = "+919812345678"

    r = client.put(f"/me/family/parents/{MAA}/phone", json={"phone": "98123 45678"}, headers=neha)
    assert r.status_code == 200 and r.json()["phone"] == new
    parent = client.get("/me/family", headers=neha).json()["parents"]
    assert [p["phone"] for p in parent] == [new]
    assert parent[0]["parent_name"] == "Amma" and parent[0]["call_time"] == "19:15"
    assert len(parent[0]["reminders"]) == 1 and parent[0]["groceries"][0]["name"] == "Atta"
    assert len(client.get(f"/me/calls?phone={new}", headers=neha).json()) == 5

    # Another family's number, a number already in the family, someone else's parent: refused.
    client.post("/me/family", json={**FAMILY, "me": {"name": "Eve"}, "parent_phone": "+919999999999"}, headers=as_user("eve"))
    assert client.put(f"/me/family/parents/{new}/phone", json={"phone": "+919999999999"}, headers=neha).status_code == 409
    assert client.put(f"/me/family/parents/+919999999999/phone", json={"phone": "+919811111111"}, headers=neha).status_code == 409
    assert client.put(f"/me/family/parents/{new}/phone", json={"phone": "123"}, headers=neha).status_code == 422


def test_webhook_keeps_no_transcript(client, monkeypatch):
    """Only the summary and results are stored, never the conversation word for word."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.db import pool
    from app.routes import sarvam

    app = FastAPI()
    app.include_router(sarvam.router)
    monkeypatch.setenv("SARVAM_WEBHOOK_TOKEN", "w")
    client.post("/me/family", json=FAMILY, headers=as_user("neha"))
    r = TestClient(app).post("/webhooks/sarvam", json={
        "attempt_id": "t1", "interaction_id": "ti1", "status": "connected", "duration": 60,
        "user_phone_number": MAA, "webhook_config": {"metadata": {"token": "w"}},
        "interaction_transcript": [{"role": "agent", "en_text": "Hello"}, {"role": "user", "indic_text": "ठीक हूँ", "en_text": "I am fine"}],
        "output_agent_variables": {"call_summary": "Feeling fine."},
    })
    assert r.status_code == 200
    with pool().connection() as conn:
        payload = conn.execute("SELECT payload FROM webhook_events WHERE attempt_id = 't1'").fetchone()[0]
        columns = {c for (c,) in conn.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'calls'")}
    assert "interaction_transcript" not in payload and payload["spoken_language"] == "Hindi"
    assert "transcript" not in columns
    calls = client.get("/me/calls", headers=as_user("neha")).json()
    assert calls[0]["summary"] == "Feeling fine."
