"""Tell my family (app/messages.py): from a call to the family's phones, and back on the next call."""

import uuid

import pytest

from app.families import _query, family_variables
from app.parents import remember_call
from app.routes import sarvam
from tests.conftest import as_user

MAA, NANI = "+919876500201", "+919876500299"
NEHA, ROHAN, EVE = "ExponentPushToken[neha]", "ExponentPushToken[rohan]", "ExponentPushToken[eve]"


@pytest.fixture
def family(client):
    client.post("/me/family", headers=as_user("neha"), json={"name": "Verma", "me": {"name": "Neha"}, "parent_phone": MAA, "parent": {"parent_name": "Maa"}})
    client.post("/me/family", headers=as_user("eve"), json={"name": "Other", "me": {"name": "Eve"}, "parent_phone": NANI, "parent": {"parent_name": "Nani"}})
    client.post("/me/family/members", headers=as_user("neha"), json={"name": "Rohan", "relation": "Son", "email": "rohan@example.com"})
    client.get("/me", headers=as_user("rohan"))  # Rohan signs in: claims his invite
    for user, token in (("neha", NEHA), ("rohan", ROHAN), ("eve", EVE)):
        client.post("/me/push-tokens", headers=as_user(user), json={"token": token})


def call(phone, outputs=None, status="connected", duration=70, source="scheduler"):
    attempt = str(uuid.uuid4())
    remember_call(phone, {"parent_name": "Maa" if phone == MAA else "Nani"}, attempt, source)
    payload = {"attempt_id": attempt, "status": status, "duration": duration, "metadata": {"source": source},
               "output_agent_variables": outputs if outputs is not None else {"call_summary": "A good day."}}
    sarvam.save_payload(payload)
    return payload


def messages(client, user="neha"):
    return client.get("/me/messages", headers=as_user(user)).json()


def test_a_message_from_the_call(client, family, expo):
    payload = call(MAA, {"call_summary": "Fine.", "message_for_family": "Please bring my glasses on Sunday."})
    m = messages(client)
    assert len(m) == 1 and m[0]["direction"] == "from_parent" and m[0]["parent_name"] == "Maa"
    assert m[0]["text"] == "Please bring my glasses on Sunday."
    assert {x["to"] for x in expo.sent} == {NEHA, ROHAN}
    assert expo.sent[0]["title"] == "Message from Maa" and "glasses" in expo.sent[0]["body"] and expo.sent[0]["data"] == {"screen": "today", "phone": MAA}

    n = len(expo.sent)
    sarvam.save_payload(payload)  # delivered twice
    assert len(messages(client)) == 1 and len(expo.sent) == n
    assert not messages(client, "eve")  # another family sees nothing


def test_tell_one_person(client, family, expo):
    call(MAA, {"message_for_family": "Bring the BP machine.", "message_to": "rohan"})
    assert [x["to"] for x in expo.sent] == [ROHAN]
    assert messages(client)[0]["to_name"] == "rohan"
    n = len(expo.sent)
    call(MAA, {"message_for_family": "Hello all", "message_to": "Priya"})  # nobody by that name
    assert len(expo.sent) - n == 2


def test_call_back_request_before_agent_v11(client, family):
    call(MAA, {"call_summary": "Wants a call.", "wants_family_callback": True})
    assert messages(client)[0]["text"] == "Please call me back."


def test_what_does_not_make_a_message(client, family, expo):
    call(MAA, {"call_summary": "Nothing new."})
    assert not messages(client) and expo.sent[-1]["title"] == "Maa's call card is ready"
    call(MAA, {}, status="no_answer", duration=0)
    assert not messages(client)
    call(MAA, {"urgent_flag": True, "message_for_family": "Call me"})
    assert expo.sent[-1]["title"] == "Maa needs attention"  # urgent beats the message in the push
    assert messages(client)[0]["text"] == "Call me"  # but the message is kept


def test_replies_and_notes_reach_the_next_call(client, family):
    call(MAA, {"message_for_family": "Please bring my glasses on Sunday."})
    glasses = messages(client)[0]
    assert client.post("/me/messages", headers=as_user("neha"), json={"text": "Yes Maa, I'll bring them Sunday.", "reply_to": glasses["id"]}).status_code == 200
    all_ = messages(client)
    reply = [x for x in all_ if x["direction"] == "to_parent"][0]
    assert reply["from_name"] == "Neha" and reply["delivered_at"] is None and reply["reply_to"] == glasses["id"]
    answered = [x for x in all_ if x["id"] == glasses["id"]][0]
    assert answered["done_at"] and answered["done_by_name"] == "Neha"  # replying deals with it

    assert client.post("/me/messages", headers=as_user("rohan"), json={"text": "Maa, I'm visiting next week."}).status_code == 200
    context = family_variables(MAA).get("family_context", "")
    assert 'Neha says: "Yes Maa, I\'ll bring them Sunday."' in context and 'Rohan says: "Maa, I\'m visiting next week."' in context

    # Notes written before a call are passed on in it; one written after it started waits.
    _query("UPDATE family_messages SET created_at = now() - interval '10 minutes' WHERE direction = 'to_parent' RETURNING id")
    client.post("/me/messages", headers=as_user("neha"), json={"text": "Written during the call."})
    call(MAA, {"call_summary": "Heard the news."}, duration=60)
    waiting = [x["text"] for x in messages(client) if x["direction"] == "to_parent" and not x["delivered_at"]]
    assert waiting == ["Written during the call."]
    context = family_variables(MAA).get("family_context", "")
    assert "bring them Sunday" not in context and "Written during the call." in context


def test_only_notes_said_on_the_call_count_as_passed_on(client, family):
    for i in range(5):
        client.post("/me/messages", headers=as_user("neha"), json={"text": f"Note {i}"})
    _query("UPDATE family_messages SET created_at = now() - interval '10 minutes' WHERE direction = 'to_parent' RETURNING id")
    _query("UPDATE family_messages SET created_at = now() - interval '9 days' WHERE text = 'Note 0' RETURNING id")

    call(MAA, {"meds_taken": "all"}, source="med_reminder")  # a reminder call skips the family part
    assert len([x for x in messages(client) if x["direction"] == "to_parent" and not x["delivered_at"]]) == 5

    call(MAA, {"call_summary": "Heard the news."})  # the call had Note 1-3 (max 3, none older than a week)
    waiting = sorted(x["text"] for x in messages(client) if x["direction"] == "to_parent" and not x["delivered_at"])
    assert waiting == ["Note 0", "Note 4"]
    assert "Note 4" in family_variables(MAA).get("family_context", "")


def test_who_can_send_and_mark_done(client, family):
    call(MAA, {"message_for_family": "Bring the BP machine."})
    bp = messages(client)[0]
    assert client.post("/me/messages", headers=as_user("neha"), json={"text": "x", "phone": NANI}).status_code == 404
    assert client.post("/me/messages", headers=as_user("neha"), json={"text": "x", "reply_to": 999999}).status_code == 404
    assert client.post("/me/messages", headers=as_user("neha"), json={"text": ""}).status_code == 422
    assert client.post(f"/me/messages/{bp['id']}/done", headers=as_user("eve")).status_code == 404
    assert client.post(f"/me/messages/{bp['id']}/done", headers=as_user("rohan")).status_code == 200
    assert [x for x in messages(client) if x["id"] == bp["id"]][0]["done_by_name"] == "Rohan"
    note = client.post("/me/messages", headers=as_user("neha"), json={"text": "A note"}).json()
    assert client.post(f"/me/messages/{note['id']}/done", headers=as_user("neha")).status_code == 404  # only the parent's messages


def test_limits(client, family):
    for i in range(10):
        assert client.post("/me/messages", headers=as_user("neha"), json={"text": f"note {i}"}).status_code == 200
    r = client.post("/me/messages", headers=as_user("neha"), json={"text": "one too many"})
    assert r.status_code == 429
    assert family_variables(MAA)["family_context"].count(" says: ") == 3  # at most 3 per call
