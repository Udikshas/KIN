"""What changed (app/insights.py): each call against the parent's own usual, no AI service."""

import uuid

import pytest

from app.families import _query
from app.insights import backfill, read_call
from app.parents import remember_call
from app.routes import sarvam
from tests.conftest import as_user

MAA = "+919876500501"
NEHA = "ExponentPushToken[neha]"
USUAL = {"sleep_quality": 4, "mood": "ok", "meds_taken": "all", "pain_mentioned": False}


@pytest.fixture
def family(client):
    client.post("/me/family", headers=as_user("neha"), json={"name": "Verma", "me": {"name": "Neha"}, "parent_phone": MAA, "parent": {"parent_name": "Maa"}})
    client.post("/me/push-tokens", headers=as_user("neha"), json={"token": NEHA})


def call(outputs, status="connected", days_ago=0, source="scheduler", phone=MAA):
    attempt = str(uuid.uuid4())
    remember_call(phone, {"parent_name": "Maa"}, attempt, source)
    payload = {"attempt_id": attempt, "status": status, "duration": 90, "metadata": {"source": source},
               "output_agent_variables": {"call_summary": "Agent summary.", **outputs}}
    sarvam.save_payload(payload)
    if days_ago:
        _query("UPDATE calls SET created_at = now() - make_interval(days => %(d)s) WHERE attempt_id = %(a)s", {"d": days_ago, "a": attempt})
    return payload


# ---- the card, from outputs alone ---------------------------------------------

def test_a_usual_day():
    card = read_call("Maa", {**USUAL, "sleep_quality": 4}, [USUAL] * 5)
    assert card == {"headline": "A usual day for Maa: medicines taken, slept well, in good spirits", "changes": [], "suggestion": ""}


def test_pain_streak_and_worse_sleep():
    before = [USUAL] * 5 + [{**USUAL, "pain_mentioned": True, "pain_location": "knee"}] * 2
    card = read_call("Maa", {**USUAL, "sleep_quality": 2, "pain_mentioned": True, "pain_location": "knee"}, before)
    assert card["headline"] == "Maa: knee pain, day 3, slept badly"
    assert card["changes"][:2] == ["Knee pain on 3 calls in a row", "Slept worse: 2/5, usually about 4/5"]
    assert card["suggestion"] == "Ask whether the knee needs a doctor."


def test_new_pain_low_mood_and_missed_medicine():
    card = read_call("Maa", {**USUAL, "pain_mentioned": True, "mood": "low", "meds_taken": "some"}, [USUAL] * 6)
    assert card["changes"] == [
        "New: pain, none in the 6 calls before",
        "Sounded low, which is unusual for Maa",
        "Missed some medicine, first miss in a while",
    ]


def test_a_call_back_request_is_the_suggestion():
    card = read_call("Maa", {**USUAL, "wants_family_callback": True}, [USUAL] * 4)
    assert card["headline"].startswith("Maa: wants a call")
    assert card["suggestion"] == "Call Maa: they asked to hear from you."


def test_without_history_it_only_says_what_this_call_showed():
    card = read_call("Maa", {"sleep_quality": 1, "pain_mentioned": True, "pain_location": "back"}, [])
    assert card["changes"] == ["Mentioned back pain"]  # no "usual" to compare sleep with yet


# ---- through the webhook ----------------------------------------------------------

def test_card_is_saved_and_pushed(client, family, expo):
    for d in (4, 3, 2, 1):
        call(USUAL, days_ago=d)
    call({**USUAL, "sleep_quality": 2, "mood": "low"})
    assert expo.sent[-1]["body"] == "Maa: slept badly, sounded low"
    latest = client.get("/me/calls", headers=as_user("neha")).json()[0]
    assert latest["insight"]["changes"][0] == "Slept worse: 2/5, usually about 4/5"
    assert client.get(f"/me/calls/{latest['id']}", headers=as_user("neha")).json()["insight"] == latest["insight"]


def test_a_retried_webhook_keeps_the_first_card(family, expo):
    payload = call(USUAL)
    first = _query("SELECT insight FROM calls")[0]["insight"]
    sarvam.save_payload(payload)
    assert _query("SELECT insight FROM calls")[0]["insight"] == first


def test_unanswered_and_demo_calls_get_no_card(family):
    call({}, status="no_answer")
    call(USUAL, source="demo", phone="+919876500599")
    assert _query("SELECT count(*) AS n FROM calls WHERE insight IS NOT NULL")[0]["n"] == 0


# ---- the 30-day note ----------------------------------------------------------------

def test_trend_note(client, family):
    for d in (20, 15, 10):
        call(USUAL, days_ago=d)
    call({}, status="no_answer", days_ago=9)
    assert client.get("/me/trends", headers=as_user("neha")).json()["note"]["watch"] == ""
    for d in (3, 2, 1):
        call({**USUAL, "sleep_quality": 2, "pain_mentioned": True, "pain_location": "knee"}, days_ago=d)
    note = client.get("/me/trends", headers=as_user("neha")).json()["note"]
    assert note["calls"] == 7
    assert note["points"][0] == "Answered 6 of 7 calls"
    assert "Sleep down this week: 2.0/5, before 4.0/5" in note["points"]
    assert "Pain (knee) on 3 of 3 calls this week, 0 of 3 before" in note["points"]
    assert note["watch"] == "Sleep: it has dropped this week."
    assert client.get("/me/trends", headers=as_user("eve")).status_code == 404  # no family


def test_too_early_for_a_note(client, family):
    call(USUAL)
    assert client.get("/me/trends", headers=as_user("neha")).json() == {"note": None}


def test_backfill_cards_for_earlier_calls(client, family):
    for d in (4, 3, 2):
        call(USUAL, days_ago=d)
    call({**USUAL, "sleep_quality": 1}, days_ago=1)
    call({}, status="no_answer")
    _query("UPDATE calls SET insight = NULL")  # as before cards existed
    assert backfill() == 4  # answered calls only
    cards = [r["insight"] for r in _query("SELECT insight FROM calls WHERE status = 'connected' ORDER BY created_at")]
    assert cards[-1]["changes"] == ["Slept worse: 1/5, usually about 4/5"]  # judged against the calls before it
    assert backfill() == 0  # only ever fills the gaps
