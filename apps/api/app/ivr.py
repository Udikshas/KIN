"""Medicine reminder calls without the AI: a recorded message and "press 1", through Vobiz.

The Sarvam agent bills ₹3.50 for every started minute, so a 20-second reminder
costs as much as a short chat. When Vobiz is configured (VOBIZ_AUTH_ID,
VOBIZ_AUTH_TOKEN, VOBIZ_FROM_NUMBER, plus PUBLIC_API_URL and SARVAM_API_KEY),
app/reminders.py rings through here instead: a plain phone call at about
₹0.45/min that plays one clip and listens for a key.

  "Namaste Maa. This is Kin, a reminder your family set up. It is time for your
   8:00 pm medicines: Amlodipine 5 mg. Press 1 when you have taken them.
   Press 2 if you cannot take them now."

1 → "Thank you…" (taken), 2 → "All right, I will let your family know"
(not taken), no key after two plays → hang up (unclear). Not answered →
no_answer, and reminders.plan() retries as for AI calls.

The clips are spoken once by Sarvam text-to-speech (Bulbul) in the parent's
language and kept in Postgres (ivr_audio, keyed by a hash of the text), so a
reminder that rings every day costs no AI after the first call. Hindi and
English lines are hand-written; other languages are translated from English.

Vobiz fetches /ivr/med/{token}/answer when the call is answered, posts the key
to …/digits and the end of the call to …/hangup (app/routes/ivr.py). The token
is a fresh secret per call. On hangup the result becomes a webhook payload in
the same shape as Sarvam's (source "med_reminder", meds_taken all / none /
unclear), stored with routes.sarvam.save_payload, so retries, the family push,
the streak and the calendar work exactly as for AI reminder calls.
"""

import base64
import hashlib
import json
import os
import secrets
from datetime import datetime
from xml.sax.saxutils import escape

import httpx

from app.families import _one, _query
from app.parents import remember_call

VOBIZ_API = "https://api.vobiz.ai/api/v1"
SARVAM_TTS = "https://api.sarvam.ai/text-to-speech"
SARVAM_TRANSLATE = "https://api.sarvam.ai/translate"
VOICE = ("roopa", "bulbul:v3")  # a female voice that speaks every language below
SAMPLE_RATE = 8000  # phone audio; higher rates only make Vobiz fetch more
RING_SECONDS = 40
TIME_LIMIT = 120
WAIT_FOR_KEY = 8  # seconds after the clip ends
PLAYS = 2  # the clip again once if no key was pressed

REQUIRED = ["VOBIZ_AUTH_ID", "VOBIZ_AUTH_TOKEN", "VOBIZ_FROM_NUMBER", "PUBLIC_API_URL", "SARVAM_API_KEY"]

LANG_CODES = {
    "Hindi": "hi-IN", "English": "en-IN", "Bengali": "bn-IN", "Tamil": "ta-IN", "Telugu": "te-IN",
    "Kannada": "kn-IN", "Malayalam": "ml-IN", "Marathi": "mr-IN", "Gujarati": "gu-IN", "Punjabi": "pa-IN",
    "Odia": "od-IN",
}

# {name}, {when} ("8:00 pm") and {medicines} are filled per reminder.
LINES = {
    "English": {
        "ask": "Namaste {name}. This is Kin, a reminder your family set up. It is time for your {when} medicines: "
               "{medicines}. Press 1 when you have taken them. Press 2 if you cannot take them now.",
        "taken": "Thank you, {name}. Take care.",
        "later": "All right. I will let your family know.",
    },
    "Hindi": {
        "ask": "नमस्ते {name}। मैं Kin हूँ, आपके परिवार ने यह याद दिलाने को कहा है। {when} की दवाई का समय हो गया है: "
               "{medicines}। दवाई ले लें तो 1 दबाइए। अभी नहीं ले सकते तो 2 दबाइए।",
        "taken": "धन्यवाद {name}। अपना ध्यान रखिए।",
        "later": "ठीक है। मैं आपके परिवार को बता दूँगी।",
    },
}


class IvrError(Exception):
    """The clip could not be made or Vobiz refused the call."""


def _post(url: str, **kwargs) -> httpx.Response:
    """Every request to Sarvam and Vobiz (the tests replace this)."""
    return httpx.post(url, **kwargs)


def configured() -> bool:
    return all(os.environ.get(k) for k in REQUIRED)


def _base() -> str:
    return os.environ["PUBLIC_API_URL"].rstrip("/")


# ---- the clips -----------------------------------------------------------------------

def _sarvam_headers() -> dict:
    return {"api-subscription-key": os.environ["SARVAM_API_KEY"], "content-type": "application/json"}


def _translate(text: str, code: str) -> str:
    res = _post(SARVAM_TRANSLATE, headers=_sarvam_headers(), timeout=30, json={
        "input": text, "source_language_code": "en-IN", "target_language_code": code,
        "speaker_gender": "Female", "mode": "formal", "model": "mayura:v1",
    })
    if res.status_code != 200:
        raise IvrError(f"Sarvam translate returned {res.status_code}: {res.text[:200]}")
    return res.json()["translated_text"]


def lines_for(language: str | None, name: str, when: str, medicines: str) -> tuple[str, dict[str, str]]:
    """(language used, {"ask", "taken", "later"}) for this reminder."""
    language = language if language in LANG_CODES else "Hindi"
    fill = {"name": name or "ji", "when": when, "medicines": medicines}
    if language in LINES:
        return language, {k: v.format(**fill) for k, v in LINES[language].items()}
    code = LANG_CODES[language]
    return language, {k: _translate(v.format(**fill), code) for k, v in LINES["English"].items()}


def audio_key(language: str, text: str) -> str:
    return hashlib.sha256(f"{VOICE[0]}|{VOICE[1]}|{language}|{text}".encode()).hexdigest()[:32]


def ensure_audio(language: str, text: str) -> str:
    """The clip's key, speaking it with Sarvam the first time only."""
    key = audio_key(language, text)
    if _one("SELECT 1 AS ok FROM ivr_audio WHERE key = %(k)s", {"k": key}):
        return key
    speaker, model = VOICE
    res = _post(SARVAM_TTS, headers=_sarvam_headers(), timeout=60, json={
        "text": text, "target_language_code": LANG_CODES[language], "speaker": speaker, "model": model,
        "speech_sample_rate": SAMPLE_RATE, "output_audio_codec": "wav", "pace": 0.9,
    })
    if res.status_code != 200:
        raise IvrError(f"Sarvam text-to-speech returned {res.status_code}: {res.text[:200]}")
    audio = b"".join(base64.b64decode(a) for a in res.json()["audios"])
    _query(
        "INSERT INTO ivr_audio (key, language, text, audio) VALUES (%(k)s, %(l)s, %(t)s, %(a)s) "
        "ON CONFLICT (key) DO NOTHING RETURNING key",
        {"k": key, "l": language, "t": text, "a": audio},
    )
    return key


def audio(key: str) -> bytes | None:
    row = _one("SELECT audio FROM ivr_audio WHERE key = %(k)s", {"k": key})
    return bytes(row["audio"]) if row else None


def audio_url(key: str) -> str:
    return f"{_base()}/ivr/audio/{key}.wav"


# ---- placing the call ------------------------------------------------------------------

def place_reminder(job_id: int, phone: str, row: dict, when: str, source: str) -> str:
    """Rings `phone` with the reminder for this med_jobs row; returns Vobiz's call id (the attempt_id)."""
    try:
        language, lines = lines_for(row.get("language"), row.get("parent_name") or "", when, row["medicines"])
        clips = {k: ensure_audio(language, text) for k, text in lines.items()}
    except (httpx.HTTPError, KeyError, ValueError) as e:
        raise IvrError(f"clip failed: {type(e).__name__}: {e}") from e
    token = secrets.token_urlsafe(18)
    _query(
        "INSERT INTO ivr_calls (token, job_id, phone, clips) VALUES (%(t)s, %(j)s, %(p)s, %(c)s) RETURNING token",
        {"t": token, "j": job_id, "p": phone, "c": json.dumps(clips)},
    )
    base = f"{_base()}/ivr/med/{token}"
    e = os.environ
    try:
        res = _post(
            f"{VOBIZ_API}/Account/{e['VOBIZ_AUTH_ID']}/Call/",
            headers={"X-Auth-ID": e["VOBIZ_AUTH_ID"], "X-Auth-Token": e["VOBIZ_AUTH_TOKEN"]},
            json={
                "from": e["VOBIZ_FROM_NUMBER"], "to": phone, "caller_name": "Kin",
                "answer_url": f"{base}/answer", "answer_method": "POST",
                "hangup_url": f"{base}/hangup", "hangup_method": "POST",
                "ring_timeout": RING_SECONDS, "time_limit": TIME_LIMIT,
            },
            timeout=30,
        )
    except httpx.HTTPError as err:
        raise IvrError(f"Vobiz unreachable: {err}") from err
    if res.status_code not in (200, 201):
        raise IvrError(f"Vobiz returned {res.status_code}: {res.text[:300]}")
    attempt_id = res.json().get("request_uuid")
    if not attempt_id:
        raise IvrError(f"Vobiz gave no call id: {res.text[:300]}")
    _query("UPDATE ivr_calls SET attempt_id = %(a)s WHERE token = %(t)s RETURNING token", {"a": attempt_id, "t": token})
    remember_call(phone, {"parent_name": row.get("parent_name")}, attempt_id, source,
                  sent={"channel": "ivr", "language": language, "medicines": row["medicines"], "reminder_time": when})
    return attempt_id


# ---- during the call (app/routes/ivr.py) -------------------------------------------------

def call_for(token: str) -> dict | None:
    return _one("SELECT token, job_id, phone, attempt_id, clips, digits, prompts, finished_at FROM ivr_calls "
                "WHERE token = %(t)s", {"t": token})


def _xml(*elements: str) -> str:
    return '<?xml version="1.0" encoding="UTF-8"?><Response>' + "".join(elements) + "</Response>"


def _play(key: str) -> str:
    return f"<Play>{escape(audio_url(key))}</Play>"


def _ask(call: dict) -> str:
    _query("UPDATE ivr_calls SET prompts = prompts + 1 WHERE token = %(t)s RETURNING token", {"t": call["token"]})
    action = escape(f"{_base()}/ivr/med/{call['token']}/digits")
    return _xml(
        f'<Gather action="{action}" method="POST" inputType="dtmf" numDigits="1" finishOnKey="none" '
        f'executionTimeout="{WAIT_FOR_KEY}">{_play(call["clips"]["ask"])}</Gather>',
        "<Hangup/>",
    )


def answer_xml(call: dict) -> str:
    return _ask(call)


def digits_xml(call: dict, digits: str) -> str:
    """What to play after a key (or none): thanks, "I'll tell your family", the clip again, or hang up."""
    key = (digits or "").strip()[:1]
    if key in ("1", "2"):
        _query("UPDATE ivr_calls SET digits = %(d)s WHERE token = %(t)s RETURNING token", {"d": key, "t": call["token"]})
        return _xml(_play(call["clips"]["taken" if key == "1" else "later"]), "<Hangup/>")
    if call["prompts"] < PLAYS:
        return _ask(call)
    return _xml("<Hangup/>")


def _seconds(start: str | None, end: str | None) -> int:
    try:
        fmt = "%Y-%m-%d %H:%M:%S"
        return max(0, int((datetime.strptime(end[:19], fmt) - datetime.strptime(start[:19], fmt)).total_seconds()))
    except (TypeError, ValueError):
        return 0


def finish(token: str, form: dict) -> dict | None:
    """The call ended: claims it once and returns the Sarvam-shaped payload to store (None if already done)."""
    claimed = _query(
        "UPDATE ivr_calls SET finished_at = now() WHERE token = %(t)s AND finished_at IS NULL "
        "RETURNING phone, attempt_id, digits",
        {"t": token},
    )
    if not claimed or not claimed[0]["attempt_id"]:
        return None
    c = claimed[0]
    answered = bool((form.get("AnswerTime") or "").strip())
    payload = {
        "attempt_id": c["attempt_id"],
        "user_phone_number": c["phone"],
        "status": "connected" if answered else "no_answer",
        "duration": _seconds(form.get("AnswerTime"), form.get("EndTime")) if answered else 0,
        "metadata": {"source": "med_reminder", "channel": "ivr"},
        "output_agent_variables": {},
        "vobiz": {k: form.get(k) for k in ("CallUUID", "HangupCause", "AnswerTime", "EndTime") if form.get(k)},
    }
    if answered:
        # No call_summary: a key press is not something to bring up on the evening call.
        payload["output_agent_variables"] = {"meds_taken": {"1": "all", "2": "none"}.get(c["digits"] or "", "unclear")}
    return payload
