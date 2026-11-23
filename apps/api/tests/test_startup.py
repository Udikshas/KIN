"""The real app (app.main) starts, wires its routes and keeps the scheduler off by default."""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def app_client(monkeypatch):
    monkeypatch.setenv("WEB_API_TOKEN", "t")
    monkeypatch.delenv("SCHEDULER_ENABLED", raising=False)
    from app.main import app

    return TestClient(app), app


def test_routes_and_health(app_client):
    client, app = app_client
    paths = {r.path for r in app.routes}
    for path in ("/health", "/me", "/me/family", "/me/calls", "/me/messages", "/me/push-tokens", "/me/attempts/{attempt_id}",
                 "/me/family/parents/{phone}/call", "/me/family/members/{member_id}/call", "/demo/calls", "/demo/credits",
                 "/webhooks/sarvam", "/hooks/on-start", "/hooks/urgent", "/hooks/scam", "/families", "/waitlist", "/impact"):
        assert path in paths, path
    assert client.get("/health").json() == {"status": "ok", "scheduler": False}
    assert client.get("/me").status_code == 401


def test_team_routes_take_member_emails(app_client):
    client, _ = app_client
    web = {"X-Web-Token": "t"}
    family = client.post("/families", json={"name": "Old family"}, headers=web).json()
    r = client.post(f"/families/{family['id']}/members", json={"name": "Om", "email": "om@example.com"}, headers=web)
    assert r.status_code == 200 and r.json()["email"] == "om@example.com"
    members = client.get(f"/families/{family['id']}", headers=web).json()["members"]
    assert {"email", "linked", "role"} <= set(members[0])
