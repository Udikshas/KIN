"""Medicine reminder calls without the AI (app/ivr.py): a recorded clip, "press 1", through Vobiz."""

import base64
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import ivr, push
from app.families import _query
from app.routes import ivr as ivr_routes
from tests.conftest import as_user
from tests.test_reminders import MAA, NEHA, add, family, hhmm, run, today  # noqa: F401  (family is a fixture)

IST = timezone(timedelta(hours=5, minutes=30))
FORM = {"content-type": "application/x-www-form-urlencoded"}


class _Res:
    def __init__(self, status, data):
        self.status_code, self._data, self.text = status, data, str(data)

    def json(self):
        return self._data


class FakeHttp:
    """Sarvam text-to-speech / translate and the Vobiz Call API."""

    def __init__(self):
        self.tts, self.translated, self.calls = [], [], []
        self.vobiz_status = 201

    def post(self, url, json=None, headers=None, timeout=None):
        if url == ivr.SARVAM_TTS:
            self.tts.append(json)
            return _Res(200, {"audios": [base64.b64encode(f"wav:{json['text']}".encode()).decode()]})
        if url == ivr.SARVAM_TRANSLATE:
            self.translated.append(json)
            return _Res(200, {"translated_text": f"[{json['target_language_code']}] {json['input']}"})
        assert url.startswith(ivr.VOBIZ_API) and headers["X-Auth-ID"] == "MA_TEST"
        self.calls.append(json)
        return _Res(self.vobiz_status, {"message": "Call fired", "request_uuid": f"vz-{len(self.calls)}"})


@pytest.fixture
def vobiz(monkeypatch):
    for k, v in {"VOBIZ_AUTH_ID": "MA_TEST", "VOBIZ_AUTH_TOKEN": "t", "VOBIZ_FROM_NUMBER": "+918000000000",
                 "PUBLIC_API_URL": "https://api.test", "SARVAM_API_KEY": "k"}.items():
        monkeypatch.setenv(k, v)
    fake = FakeHttp()
    monkeypatch.setattr(ivr, "_post", fake.post)
    monkeypatch.setattr(push, "notify_reminder_async", push.notify_reminder)
    return fake


@pytest.fixture
def callbacks():
    app = FastAPI()
    app.include_router(ivr_routes.router)
    return TestClient(app)


def token_of(call: dict) -> str:
    return call["answer_url"].split("/ivr/med/")[1].split("/")[0]


def post(callbacks, call, step, **form):
    return callbacks.post(f"/ivr/med/{token_of(call)}/{step}", content=urlencode(form), headers=FORM)


ANSWERED = {"AnswerTime": "2026-10-31 20:00:05", "EndTime": "2026-10-31 20:00:31"}


def test_rings_through_vobiz_not_the_ai(client, family, sarvam, vobiz, callbacks):
    add(client, hhmm(-1), "Amlodipine 5 mg")
    assert run() == {"planned": 1, "placed": 1}
    assert sarvam.placed == []  # no AI minutes
    call = vobiz.calls[-1]
    assert (call["to"], call["from"]) == (MAA, "+918000000000")
    assert call["answer_url"].startswith("https://api.test/ivr/med/") and call["hangup_url"].endswith("/hangup")
    # The parent's language (Hindi), hand-written: no translation, three clips spoken once.
    assert vobiz.translated == [] and len(vobiz.tts) == 3
    ask = vobiz.tts[0]["text"]
    assert ask.startswith("नमस्ते Maa") and "Amlodipine 5 mg" in ask and "1 दबाइए" in ask
    assert today(client)[0]["today"]["state"] == "calling"

    xml = post(callbacks, call, "answer").text
    assert "<Gather" in xml and 'numDigits="1"' in xml and "/ivr/audio/" in xml and xml.endswith("<Hangup/></Response>")
    clip = xml.split("<Play>")[1].split("</Play>")[0].rsplit("/", 1)[1]
    audio = callbacks.get(f"/ivr/audio/{clip}")
    assert audio.status_code == 200 and audio.headers["content-type"] == "audio/wav" and audio.content.startswith(b"wav:")


def test_press_1_is_taken_and_stays_quiet(client, family, sarvam, vobiz, callbacks, expo):
    add(client, hhmm(-1))
    run()
    call = vobiz.calls[-1]
    post(callbacks, call, "answer")
    xml = post(callbacks, call, "digits", Digits="1").text
    assert "<Play>" in xml and "Gather" not in xml
    post(callbacks, call, "hangup", **ANSWERED)
    assert today(client)[0]["today"]["state"] == "taken"
    assert expo.sent == []
    row = _query("SELECT status, duration_s, summary, source FROM calls")[0]
    assert (row["status"], row["duration_s"], row["summary"], row["source"]) == ("connected", 26, None, "med_reminder")


def test_press_2_tells_the_family(client, family, sarvam, vobiz, callbacks, expo):
    add(client, hhmm(-1), "Metformin")
    run()
    call = vobiz.calls[-1]
    post(callbacks, call, "answer")
    post(callbacks, call, "digits", Digits="2")
    post(callbacks, call, "hangup", **ANSWERED)
    post(callbacks, call, "hangup", **ANSWERED)  # Vobiz retries the callback
    assert today(client)[0]["today"]["state"] == "not_taken"
    assert [m["to"] for m in expo.sent] == [NEHA]
    assert expo.sent[0]["title"].startswith("Maa hasn't taken the ") and "Metformin" in expo.sent[0]["body"]


def test_no_key_plays_twice_then_hangs_up_unclear(client, family, sarvam, vobiz, callbacks, expo):
    add(client, hhmm(-1))
    run()
    call = vobiz.calls[-1]
    post(callbacks, call, "answer")
    assert "<Gather" in post(callbacks, call, "digits", Digits="").text  # once more
    assert post(callbacks, call, "digits", Digits="").text.endswith("<Response><Hangup/></Response>")
    post(callbacks, call, "hangup", **ANSWERED)
    assert today(client)[0]["today"]["state"] == "unclear"
    assert expo.sent == []


def test_not_answered_retries_once_then_tells(client, family, sarvam, vobiz, callbacks, expo):
    add(client, hhmm(-1))
    run()
    post(callbacks, vobiz.calls[-1], "hangup", AnswerTime="", EndTime="2026-10-31 20:00:40")
    assert expo.sent == [] and run()["planned"] == 1
    _query("UPDATE med_jobs SET due_at = now() - interval '1 second' WHERE status = 'pending'")
    assert run()["placed"] == 1 and len(vobiz.calls) == 2
    assert len(vobiz.tts) == 3  # the clips were made once and reused
    post(callbacks, vobiz.calls[-1], "hangup", AnswerTime="")
    assert expo.sent[-1]["title"].startswith("Maa didn't answer the ")
    assert today(client)[0]["today"]["state"] == "no_answer"


def test_other_languages_are_translated(client, family, sarvam, vobiz):
    client.put(f"/me/family/parents/{MAA}", headers=as_user("neha"), json={"parent_name": "Maa", "language": "Tamil"})
    add(client, hhmm(-1))
    run()
    assert {t["target_language_code"] for t in vobiz.translated} == {"ta-IN"}
    assert vobiz.tts[0]["target_language_code"] == "ta-IN" and vobiz.tts[0]["text"].startswith("[ta-IN] Namaste Maa")


def test_vobiz_refusing_fails_the_job(client, family, sarvam, vobiz):
    vobiz.vobiz_status = 402
    add(client, hhmm(-1))
    assert run() == {"planned": 1, "placed": 0}
    assert _query("SELECT status, note FROM med_jobs")[0]["status"] == "failed"


def test_unknown_token_just_hangs_up(callbacks, vobiz):
    assert callbacks.post("/ivr/med/nope/answer").text.endswith("<Response><Hangup/></Response>")
    assert callbacks.post("/ivr/med/nope/hangup", content="AnswerTime=", headers=FORM).json() == {"ok": True}
    assert callbacks.get("/ivr/audio/" + "0" * 32 + ".wav").status_code == 404


def test_without_vobiz_the_ai_still_calls(client, family, sarvam):
    add(client, hhmm(-1))
    run()
    assert sarvam.placed and sarvam.placed[-1].source == "med_reminder"
