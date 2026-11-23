"""Sarvam on-start hook: who is on the line, before Kin says a word.

Sarvam calls POST /hooks/on-start at the start of every interaction, with
SARVAM_HOOK_TOKEN in the X-Hook-Token header (set in the agent's
on_start_config). The body carries the caller's number and our own
`direction` variable.

- Outbound calls (direction == "outbound"): the caller already passed every
  variable, so return nothing and change nothing.
- Inbound, known number: load the parent's profile and last call summary,
  switch to inbound mode and greet them by name.
- Inbound from a family member's number (their family has one parent):
  introduction mode for that parent; the member is about to merge them in.
- Inbound, unknown number: inbound mode, greet politely and ask who it is.

Any failure answers 200 with no overrides, so a hook problem never drops a call.

POST /hooks/urgent is the agent's flag_urgent tool during a call: the family is
pushed at once and the agent gets the emergency number back (app/urgent.py).
POST /hooks/scam is its flag_scam tool (scam shield): the family is pushed and
the agent gets back what to tell the parent.
"""

import hmac
import os

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.concurrency import run_in_threadpool

from app import push
from app.context import build_context, hotwords, time_of_day
from app.families import member_by_phone
from app.greetings_util import introduction_line, language_or_default, opening_line
from app.live import note_started
from app.parents import ProfileError, get_profile, normalize_phone, placed_recently
from app.sarvam_outbound import phone_variable
from app.urgent import SCAM_ADVICE, SCAM_FAMILY_TOLD, raise_alarm

router = APIRouter()

# Keys Sarvam (or our body template) may use for the caller's number.
PHONE_KEYS = ("phone", "user_identifier", "user_phone_number", "caller", "from", "phone_number")


def _find_phone(body: dict) -> str | None:
    for key in PHONE_KEYS:
        value = body.get(key)
        if isinstance(value, str) and (phone := normalize_phone(value)):
            return phone
    info = body.get("user_information") or {}
    if isinstance(info, dict):
        for value in info.values():
            if isinstance(value, str) and (phone := normalize_phone(value)):
                return phone
    return None


def _mask(phone: str | None) -> str:
    return f"{phone[:3]}…{phone[-4:]}" if phone else "none"


@router.post("/hooks/on-start")
async def on_start(request: Request, x_hook_token: str | None = Header(default=None)) -> dict:
    expected = os.getenv("SARVAM_HOOK_TOKEN", "")
    if not expected or not x_hook_token or not hmac.compare_digest(x_hook_token.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="bad token")

    try:
        body = await request.json()
    except ValueError:
        body = {}
    if not isinstance(body, dict):
        body = {}

    direction = str(body.get("direction") or "")
    unrendered = sorted(k for k, v in body.items() if isinstance(v, str) and "{{" in v)
    if direction == "outbound":
        # The call connected: Try-it and the app show "connected" instead of "calling".
        note_started(_find_phone(body))
        return {"agent_variables": {}}

    phone = _find_phone(body)
    # Sarvam filled in neither the number nor the direction: we can't tell an
    # outbound call from an inbound one, so change nothing rather than guess.
    if unrendered and not phone:
        print(f"on-start: templates not rendered ({unrendered}); leaving the call unchanged")
        return {"agent_variables": {}}
    # Backstop if Sarvam did not fill in {{ direction }}: a number Kin dialled in
    # the last few minutes is an outbound call starting, so change nothing.
    if direction != "inbound" and phone:
        try:
            if placed_recently(phone):
                print(f"on-start: {_mask(phone)} was just dialled; treating as outbound (direction={direction!r})")
                return {"agent_variables": {}}
        except ProfileError:
            pass
    try:
        profile = get_profile(phone) if phone else None
    except ProfileError as e:
        print(f"on-start: profile lookup failed ({e}); answering as unknown caller")
        profile = None
    print(
        f"on-start: inbound from {_mask(phone)}, {'known' if profile else 'unknown'} "
        f"(keys: {sorted(body)}, unrendered templates: {unrendered or 'none'})"
    )

    tod = time_of_day()
    member = None
    if not profile and phone:
        try:
            member = member_by_phone(phone)
            profile = get_profile(member["parent_phone"]) if member else None
        except ProfileError as e:
            print(f"on-start: member lookup failed ({e})")
            member = profile = None
        if member:
            print(f"on-start: family member calling, introduction for {_mask(member['parent_phone'])}")
    if not profile:
        return {
            "agent_variables": {
                "call_mode": "inbound", "caller_known": "no", "parent_name": "ji", "time_of_day": tod, **phone_variable(phone),
            },
            "custom_app_config": {"initial_bot_message": opening_line("inbound_unknown", "Hindi", disclose=True)},
        }

    language = language_or_default(profile.get("language"))
    variables = {
        "call_mode": "introduction" if member else "inbound",
        "caller_known": "yes",
        "parent_name": profile["parent_name"],
        "language": language,
        "time_of_day": tod,
    }
    if member:
        # The member on the line is who Kin speaks for on this call.
        variables["family_name"] = member["member_name"]
    for key in ("family_name", "medicines", "health_notes", "emergency_number"):
        if profile.get(key):
            variables.setdefault(key, profile[key])
    parent_phone = member["parent_phone"] if member else phone
    variables.update(phone_variable(parent_phone))
    for key, value in build_context(parent_phone).items():
        variables.setdefault(key, value)
    greeting = (
        introduction_line(language, profile["parent_name"], member["member_name"])
        if member
        else opening_line("inbound_known", language, profile["parent_name"])
    )
    return {
        "agent_variables": variables,
        "custom_app_config": {
            "initial_language_name": language,
            "initial_bot_message": greeting,
            "speech_hotwords": hotwords(variables),
        },
    }


def _hook_token_ok(sent: str | None) -> bool:
    expected = os.getenv("SARVAM_HOOK_TOKEN", "")
    return bool(expected and sent and hmac.compare_digest(sent.encode(), expected.encode()))


async def _tool_call(request: Request, x_hook_token: str | None, kind: str) -> dict | None:
    """Shared by the in-call tools: the recorded alarm (app/urgent.py), or None if nothing was recorded."""
    if not _hook_token_ok(x_hook_token):
        raise HTTPException(status_code=401, detail="bad token")
    try:
        body = await request.json()
    except ValueError:
        body = {}
    if not isinstance(body, dict):
        body = {}
    phone = _find_phone(body)
    reason = str(body.get("reason") or body.get("details") or "").strip() or None
    if not phone:
        print(f"{kind}: no caller number in the tool call (keys: {sorted(body)})")
        return None
    try:
        alarm = await run_in_threadpool(raise_alarm, phone, reason, kind)
    except ProfileError as e:
        print(f"{kind}: not recorded ({e})")
        return None
    if not alarm["known"]:
        print(f"{kind}: {_mask(phone)} is not a parent Kin knows")
        return None
    if alarm["new"]:
        push.notify_urgent_async(phone, alarm, reason)
    print(f"{kind}: {_mask(phone)} flagged ({'new' if alarm['new'] else 'repeat'})")
    return alarm


@router.post("/hooks/urgent")
async def urgent(request: Request, x_hook_token: str | None = Header(default=None)) -> dict:
    """The agent's flag_urgent tool, during the call (app/urgent.py).

    Body: the caller's number (same keys as on-start, e.g. {{ user_identifier }})
    and `reason` (what Kin heard). Pushes the family at once and answers with
    the emergency number for call_transfer. Never fails the call: any problem
    still answers 200.
    """
    alarm = await _tool_call(request, x_hook_token, "urgent")
    if not alarm:
        return {"status": "noted", "family_alerted": False}
    return {
        "status": "family alerted",
        "family_alerted": True,
        "emergency_contact": alarm["contact_name"] or "",
        "emergency_number": alarm["emergency_number"] or "",
    }


@router.post("/hooks/scam")
async def scam(request: Request, x_hook_token: str | None = Header(default=None)) -> dict:
    """The agent's flag_scam tool (scam shield, app/urgent.py).

    Same body as /hooks/urgent: the caller's number and `reason` (what the
    parent described, e.g. "a caller from 'the bank' asked for the OTP").
    Pushes the family and answers with what Kin should tell the parent now.
    """
    alarm = await _tool_call(request, x_hook_token, "scam")
    return {"status": "family alerted" if alarm else "noted", "family_alerted": bool(alarm), "say_to_parent": SCAM_ADVICE + (SCAM_FAMILY_TOLD if alarm else "")}
