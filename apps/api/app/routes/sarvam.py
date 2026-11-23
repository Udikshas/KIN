"""Sarvam webhook: receives the result of every outbound call attempt.

Sarvam does not sign webhooks, so each call carries a secret token in
webhook_config.metadata.token, which Sarvam echoes back in the payload.
A ?token= query parameter is still accepted as a fallback; it is redacted
from the access log (see app.log_redact).

Transcripts are never kept: Kin stores the agent's summary and results only
(see drop_transcript), so no one can read what the parent said word for word.

Every delivery is stored in Postgres: the raw payload in webhook_events, and
one row per call in calls (summary and results). Only if Postgres is
unreachable is the payload appended to SARVAM_CALLS_FILE (default
data/sarvam_calls.jsonl) instead, so nothing is lost; app.import_calls loads
that file back in.
"""

import hmac
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool

from app import messages, push, reminders
from app.families import mark_consent, member_by_phone, stop_daily_calls
from app.parents import (
    ProfileError,
    get_profile,
    normalize_phone,
    payload_source,
    phone_for_attempt,
    record_call,
    save_summary,
    store_event,
)

router = APIRouter()

CALLS_FILE = Path(os.getenv("SARVAM_CALLS_FILE", "data/sarvam_calls.jsonl"))


def _token_ok(sent: str, expected: str) -> bool:
    # Compare bytes: compare_digest raises on non-ASCII str.
    return bool(expected) and hmac.compare_digest(sent.encode(), expected.encode())


@router.post("/webhooks/sarvam")
async def sarvam_webhook(request: Request, token: str = Query("")) -> dict[str, str]:
    try:
        payload = await request.json()
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid JSON")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="expected a JSON object")

    # Outbound echoes our metadata under webhook_config; inbound (deployment) at the top level.
    metadata = (payload.get("webhook_config") or {}).get("metadata") or payload.get("metadata") or {}
    sent = str(metadata.get("token") or token)
    # Outbound calls carry SARVAM_WEBHOOK_TOKEN (set by our code); the inbound
    # deployment carries SARVAM_HOOK_TOKEN (set once in Sarvam's config).
    if not (_token_ok(sent, os.getenv("SARVAM_WEBHOOK_TOKEN", "")) or _token_ok(sent, os.getenv("SARVAM_HOOK_TOKEN", ""))):
        raise HTTPException(status_code=401, detail="bad token")

    # Don't store the secret alongside the call data.
    metadata.pop("token", None)
    drop_transcript(payload)

    try:
        await run_in_threadpool(save_payload, payload)  # psycopg is sync; keep the event loop free
    except ProfileError as e:
        print(f"sarvam webhook: database unavailable ({e}); kept in {CALLS_FILE}")
        _append_file(payload)
    kind = "inbound" if payload.get("deployment_id") else "outbound"
    print(f"sarvam webhook: {kind} attempt={payload.get('attempt_id')} status={payload.get('status')}")
    return {"ok": "true"}


def drop_transcript(payload: dict) -> None:
    """Replace the word-for-word transcript with only which language the person spoke
    (Try-it shows it). Kin keeps the summary and results, never the conversation."""
    turns = payload.pop("interaction_transcript", None)
    if not isinstance(turns, list):
        return
    said = " ".join(
        str(t.get("indic_text") or t.get("en_text") or "") for t in turns if isinstance(t, dict) and t.get("role") != "agent"
    )
    hindi = bool(re.search(r"[\u0900-\u097f]", said))
    english = bool(re.search(r"[A-Za-z]{2,}", said))
    spoken = "Hindi and English" if hindi and english else "Hindi" if hindi else "English" if english else None
    if spoken:
        payload["spoken_language"] = spoken


def _append_file(payload: dict) -> None:
    record = {"received_at": datetime.now(timezone.utc).isoformat(), **payload}
    CALLS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with CALLS_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def save_payload(payload: dict) -> None:
    """Store one webhook delivery: the raw event, the call row, and memory for the next call.

    Raises ProfileError only if the raw event itself could not be stored.
    """
    phone = normalize_phone(payload.get("user_phone_number"))
    if not phone and payload.get("attempt_id"):
        try:
            phone = phone_for_attempt(payload["attempt_id"])
        except ProfileError:
            phone = None
    store_event(payload, phone)
    if not phone:
        return
    try:
        direct = _update_memory(phone, payload)
    except ProfileError as e:
        print(f"sarvam webhook: call row not saved ({e})")
        return
    if direct:
        try:
            # "Tell my family": the parent's message from this call; family notes now passed on.
            messages.record_from_call(phone, payload)
        except ProfileError as e:
            print(f"sarvam webhook: family message not saved ({e})")
        # Tell the family; runs in a thread, never fails the webhook.
        if payload_source(payload) == reminders.SOURCE:
            push.notify_reminder_async(payload)  # a medicine reminder: only if not taken / not answered
        else:
            push.notify_call_async(phone, payload)  # evening card / message / no answer


def _update_memory(phone: str, payload: dict, received_at: str | None = None) -> bool:
    """received_at: the original time, when loading old payloads (app.import_calls).

    Returns True when the call was with the person Kin checks in on themselves
    (not an unknown caller, not a family member's introduction call).
    """
    # An introduction call comes from a family member's number: it belongs
    # to the parent they merged in.
    direct = True
    if not get_profile(phone):
        member = member_by_phone(phone)
        if not member:
            # Unknown caller: kept, but never used as memory for that number.
            record_call(phone, payload, caller_known=False, received_at=received_at)
            return False
        phone = member["parent_phone"]
        direct = False
    record_call(phone, payload, received_at=received_at)
    outputs = payload.get("output_agent_variables") or {}
    if outputs.get("call_summary"):
        save_summary(phone, outputs["call_summary"], received_at)
    if outputs.get("stop_calls") is True:  # agent v11: "please don't call me" wins over any earlier yes
        stop_daily_calls(phone)
    elif outputs.get("consent_given") is True:
        mark_consent(phone)
    return direct
