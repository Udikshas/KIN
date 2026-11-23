"""Try-it (/demo): credit, live status, duplicates and what survives a restart."""

import uuid

import pytest

from app.parents import remember_call, store_event
from app.routes import demo

WEB = {"X-Web-Token": "t"}


@pytest.fixture(autouse=True)
def demo_settings(monkeypatch):
    monkeypatch.setenv("WEB_API_TOKEN", "t")
    monkeypatch.setenv("SARVAM_HOOK_TOKEN", "h")
    monkeypatch.setattr(demo, "RATE_PER_MIN", 5.0)
    monkeypatch.setattr(demo, "CREDITS", 40.0)
    monkeypatch.setattr(demo, "CREDITS_SINCE", "2020-01-01T00:00:00Z")
    monkeypatch.setattr(demo, "NUMBER_COOLDOWN_S", 180)
    monkeypatch.setattr(demo, "MAX_PER_HOUR", 50)


def place(client, phone, minutes=1, lang="Hindi"):
    return client.post("/demo/calls", headers=WEB, json={"phone": phone, "parent_name": "Amma", "language": lang, "call_length_minutes": minutes})


def finish(attempt, status="connected", duration=61.0, source="demo"):
    store_event({
        "attempt_id": attempt, "status": status, "duration": duration, "metadata": {"source": source},
        "output_agent_variables": {"call_summary": "Ate dinner, feeling fine.", "mood": "happy"},
    }, None)


def credits(client):
    return client.get("/demo/credits", headers=WEB).json()


def test_needs_the_web_token(client):
    assert client.get("/demo/credits").status_code == 401


def test_a_call_from_placed_to_charged(client):
    assert credits(client)["remaining"] == 40 and credits(client)["used"] == 0
    r = place(client, "+919800000001")
    assert r.status_code == 200, r.text
    a1 = r.json()["attempt_id"]
    assert credits(client)["held"] == 10 and credits(client)["remaining"] == 30  # 1 min + 1 held

    status = client.get(f"/demo/calls/{a1}", headers=WEB).json()
    assert status["state"] == "in_progress" and status["stage"] == "calling"
    hook = client.post("/hooks/on-start", headers={"X-Hook-Token": "h"}, json={"phone": "+919800000001", "direction": "outbound"})
    assert hook.status_code == 200 and hook.json() == {"agent_variables": {}}
    assert client.get(f"/demo/calls/{a1}", headers=WEB).json()["stage"] == "connected"

    finish(a1, duration=61.0)
    done = client.get(f"/demo/calls/{a1}", headers=WEB).json()
    assert done["state"] == "done" and done["charge"] == 10 and done["duration_s"] == 61  # 1:01 bills 2 minutes
    assert done["language"] == "Hindi" and done["minutes"] == 1 and done["placed_at"]
    c = credits(client)
    assert c["used"] == 10 and c["held"] == 0 and c["remaining"] == 30


def test_same_number_twice_is_refused(client):
    assert place(client, "+919800000001").status_code == 200
    r = place(client, "+919800000001")
    assert r.status_code == 429 and "just called" in r.json()["detail"]


def test_unanswered_costs_nothing_and_auto_stays_auto(client):
    a = place(client, "+919800000002", lang="Auto").json()["attempt_id"]
    finish(a, status="no_answer", duration=0)
    r = client.get(f"/demo/calls/{a}", headers=WEB).json()
    assert r["charge"] == 0 and r["status"] == "no_answer" and r["language"] == "Auto"


def test_credit_runs_out(client):
    a1 = place(client, "+919800000001").json()["attempt_id"]
    finish(a1, duration=61)  # ₹10 used, ₹30 left
    r = place(client, "+919800000003", minutes=5)
    assert r.status_code == 200  # needs ₹30, has ₹30
    a3 = r.json()["attempt_id"]
    r = place(client, "+919800000004", minutes=1)
    assert r.status_code == 402 and "Not enough demo credit" in r.json()["detail"]
    finish(a3, duration=125)  # 2:05 bills 3 minutes = ₹15
    assert credits(client)["used"] == 25 and credits(client)["remaining"] == 15


def test_a_failed_call_releases_its_hold(client, sarvam):
    sarvam.fail = True
    assert place(client, "+919800000005").status_code == 502
    sarvam.fail = False
    assert credits(client)["held"] == 0 and credits(client)["remaining"] == 40
    assert place(client, "+919800000005").status_code == 200  # no cooldown after a failure


def test_restart_keeps_calls_and_holds(client):
    a = place(client, "+919800000005").json()["attempt_id"]
    # The API restarts: memory is gone, Postgres still knows the call and its hold.
    demo._attempts.clear()
    demo._last_by_number.clear()
    r = client.get(f"/demo/calls/{a}", headers=WEB).json()
    assert r["state"] == "in_progress" and r["stage"] == "calling"
    assert credits(client)["held"] == 10
    finish(a, duration=59)
    r = client.get(f"/demo/calls/{a}", headers=WEB).json()
    assert r["charge"] == 5 and r["language"] == "Hindi" and r["minutes"] == 1


def test_real_calls_stay_hidden_and_free(client):
    real = str(uuid.uuid4())
    remember_call("+919800000009", {"parent_name": "X"}, real, "scheduler")
    finish(real, source="scheduler")
    assert client.get(f"/demo/calls/{real}", headers=WEB).status_code == 404
    assert credits(client)["used"] == 0
    assert client.get("/demo/calls/xyz!", headers=WEB).status_code == 400
