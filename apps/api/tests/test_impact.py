"""GET /impact (app/impact.py): totals only, for the website."""

import json
import uuid

import pytest

from app.families import _query
from app.parents import remember_call
from app.routes import sarvam
from tests.conftest import as_user

MAA = "+919876500601"
WEB = {"X-Web-Token": "t"}


@pytest.fixture(autouse=True)
def settings(monkeypatch):
    monkeypatch.setenv("WEB_API_TOKEN", "t")
    monkeypatch.setenv("SARVAM_HOOK_TOKEN", "h")


def call(phone, status="connected", outputs=None, source="scheduler", language="Hindi", duration=125):
    attempt = str(uuid.uuid4())
    remember_call(phone, {"parent_name": "Maa", "language": language}, attempt, source, sent={"language": language})
    sarvam.save_payload({"attempt_id": attempt, "status": status, "duration": duration, "metadata": {"source": source},
                         "output_agent_variables": outputs or {"call_summary": "Fine."}})


def test_needs_the_web_token(client):
    assert client.get("/impact").status_code == 401
    assert client.get("/impact", headers={"X-Web-Token": "wrong"}).status_code == 401


def test_empty(client):
    data = client.get("/impact", headers=WEB).json()
    assert data["calls"] == 0 and data["answer_rate"] is None and data["since"] is None
    assert len(data["daily"]) == 14 and all(d["calls"] == 0 for d in data["daily"])


def test_totals(client):
    client.post("/me/family", headers=as_user("neha"), json={"name": "Verma", "me": {"name": "Neha"}, "parent_phone": MAA, "parent": {"parent_name": "Maa"}})
    call(MAA, outputs={"call_summary": "Knee.", "pain_mentioned": True, "meds_taken": "some", "mood": "low", "message_for_family": "Call me"})
    call(MAA, status="no_answer", duration=0)
    call("+919876500699", source="demo", language="English", duration=60)
    client.post("/hooks/scam", headers={"X-Hook-Token": "h"}, json={"phone": MAA, "reason": "OTP"})

    # A call Sarvam never reported back on still counts as placed.
    remember_call(MAA, {"parent_name": "Maa"}, str(uuid.uuid4()), "scheduler")
    assert client.get("/impact", headers=WEB).json()["answer_rate"] is None  # nothing 15 minutes old yet
    _query("UPDATE call_attempts SET created_at = now() - interval '1 hour'")

    data = client.get("/impact", headers=WEB).json()
    assert (data["families"], data["parents"]) == (1, 1)
    assert (data["calls"], data["answered"], data["demo_calls"]) == (4, 2, 1)
    assert data["answer_rate"] == 0.5 and data["minutes"] == 3  # 2 of 4 dialled; 125 s + 60 s
    assert data["languages"] == ["English", "Hindi"]
    assert data["noticed"] == {"pain": 1, "missed_meds": 1, "low_mood": 1}
    assert data["alerts"] == {"urgent": 0, "scam": 1}
    assert data["messages"]["from_parents"] == 1
    # Summed over the 14 days: an hour back can be yesterday when this runs just after midnight IST.
    assert (sum(d["calls"] for d in data["daily"]), sum(d["answered"] for d in data["daily"])) == (4, 2)
    assert data["since"] in {d["day"] for d in data["daily"][-2:]}
    # Totals only: nothing personal in the answer.
    text = json.dumps(data)
    for secret in (MAA, "Maa", "Neha", "Verma", "Knee", "OTP", "Call me"):
        assert secret not in text, secret
