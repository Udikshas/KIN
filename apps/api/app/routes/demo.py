"""Try-it demo: place a real Kin call from the website and read back the result.

Only the web server calls these routes (server actions), with the shared
WEB_API_TOKEN in the X-Web-Token header. Visitors unlock the web page with
DEMO_PASSWORD; neither secret reaches the browser.

Sarvam does not stream phone calls, so GET returns "in_progress" until the
webhook for that attempt has been stored (Postgres webhook_events, or the
fallback file), then the result: summary and outputs (no transcript; Kin
never keeps one).

Every call costs wallet credit, so calls are rate limited in memory
(single uvicorn worker): DEMO_MAX_CALLS_PER_HOUR in total, and one call per
number every DEMO_NUMBER_COOLDOWN_S seconds.

Credit: each started minute costs DEMO_RATE_PER_MIN rupees. With DEMO_CREDITS
set (the rupees available for demo calls since DEMO_CREDITS_SINCE), a call is
refused unless the credit left covers its length plus one minute. Finished
calls count their real minutes; calls still waiting for a result hold
length + 1. This is Kin's own estimate, not Sarvam's wallet balance.

Live status: Sarvam doesn't report ringing, but its on-start hook fires when
the agent picks up a connected call, so an outbound demo call shows
"calling" until then and "connected" after.
"""

import json
import math
import os
import re
import threading
import time
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.families import format_family_context, save_own_family
from app.live import connected_since
from app.parents import ProfileError, attempt_info, demo_usage, event_for_attempt, payload_source
from app.routes.sarvam import CALLS_FILE
from app.sarvam_outbound import OutboundError, place_outbound
from app.web_auth import require_web_token


E164 = re.compile(r"^\+[1-9]\d{7,14}$")
MAX_PER_HOUR = int(os.getenv("DEMO_MAX_CALLS_PER_HOUR", "10"))
NUMBER_COOLDOWN_S = int(os.getenv("DEMO_NUMBER_COOLDOWN_S", "180"))
# The agent hard-caps calls just under 5 min; allow time for the webhook too.
RESULT_TIMEOUT_S = 7 * 60
# webhook_config.metadata.source on demo calls; results are only served for these.
DEMO_SOURCE = "demo"
RATE_PER_MIN = float(os.getenv("DEMO_RATE_PER_MIN", "5"))
CREDITS = float(os.environ["DEMO_CREDITS"]) if os.getenv("DEMO_CREDITS") else None
CREDITS_SINCE = os.getenv("DEMO_CREDITS_SINCE") or None

_placed: list[float] = []  # timestamps of calls in the last hour
_last_by_number: dict[str, float] = {}
# attempt_id (or "pending-…" while Sarvam is being asked) -> placed, phone, minutes, language
_attempts: dict[str, dict] = {}
# Routes are sync (threadpool), so the limit check and the reservation must be atomic.
_limit_lock = threading.Lock()


def charge(seconds: float) -> float:
    """Rupees for a call of this length: every started minute counts."""
    return math.ceil(max(seconds, 0) / 60) * RATE_PER_MIN


def _credit_status() -> dict:
    """Caller holds _limit_lock. Raises ProfileError if Postgres can't be read."""
    usage = demo_usage(DEMO_SOURCE, CREDITS_SINCE)
    # Calls placed in this process that Postgres hasn't recorded (or not yet).
    extra = sum(a["minutes"] + 1 for k, a in _attempts.items() if k not in usage["attempts"])
    used = usage["used_min"] * RATE_PER_MIN
    held = (usage["held_min"] + extra) * RATE_PER_MIN
    return {
        "rate_per_min": RATE_PER_MIN,
        "budget": CREDITS,
        "used": used,
        "held": held,
        "remaining": None if CREDITS is None else round(CREDITS - used - held, 2),
    }


# Token is checked before the body is validated, so callers without it learn nothing.
router = APIRouter(prefix="/demo", dependencies=[Depends(require_web_token)])


def _clean(v: str | None) -> str | None:
    v = (v or "").strip()
    return v or None


# Languages the Sarvam agent can detect and reply in. "Auto" follows the parent.
Language = Literal[
    "Auto", "Hindi", "English", "Bengali", "Gujarati", "Kannada",
    "Malayalam", "Marathi", "Odia", "Punjabi", "Tamil", "Telugu",
]
AUTO_LANGUAGE = "whichever language the parent speaks; reply in the language of their first answer"


class DemoMember(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    relation: str | None = Field(default=None, max_length=40)
    city: str | None = Field(default=None, max_length=60)
    notes: str | None = Field(default=None, max_length=200)

    @field_validator("name", "relation", "city", "notes", mode="before")
    @classmethod
    def strip(cls, v):
        return _clean(v) if isinstance(v, str) or v is None else v


class DemoFamily(BaseModel):
    """Advanced: family-wide and per-person context, saved for this number only."""

    name: str | None = Field(default=None, max_length=60)
    context: str | None = Field(default=None, max_length=300)
    about: str | None = Field(default=None, max_length=300)
    topics_avoid: str | None = Field(default=None, max_length=200)
    members: list[DemoMember] = Field(default_factory=list, max_length=4)

    @field_validator("name", "context", "about", "topics_avoid", mode="before")
    @classmethod
    def strip(cls, v):
        return _clean(v) if isinstance(v, str) or v is None else v


class DemoCall(BaseModel):
    phone: str
    parent_name: str = Field(min_length=1, max_length=40)
    family_name: str | None = Field(default=None, max_length=40)
    language: Language = "Auto"
    call_length_minutes: Literal[1, 3, 5] = 3
    medicines: str | None = Field(default=None, max_length=200)
    health_notes: str | None = Field(default=None, max_length=200)
    emergency_number: str | None = None
    family: DemoFamily | None = None

    @field_validator("phone", "emergency_number")
    @classmethod
    def e164(cls, v: str | None) -> str | None:
        v = _clean(v)
        if v is not None and not E164.match(v):
            raise ValueError("use international format, e.g. +919876543210")
        return v

    @field_validator("parent_name", "family_name", "medicines", "health_notes")
    @classmethod
    def strip(cls, v: str | None) -> str | None:
        return _clean(v)


@router.get("/credits")
def credits() -> dict:
    with _limit_lock:
        try:
            return _credit_status()
        except ProfileError:
            # Without Postgres the spend is unknown; say so instead of guessing.
            return {"rate_per_min": RATE_PER_MIN, "budget": CREDITS, "used": None, "held": None, "remaining": None}


@router.post("/calls")
def create_call(req: DemoCall) -> dict[str, str]:
    now = time.time()
    pending = f"pending-{now}"
    with _limit_lock:
        _placed[:] = [t for t in _placed if now - t < 3600]
        for a, info in list(_attempts.items()):
            if now - info["placed"] > RESULT_TIMEOUT_S:
                del _attempts[a]
        if len(_placed) >= MAX_PER_HOUR:
            raise HTTPException(status_code=429, detail="Demo call limit reached. Try again in a while.")
        wait = NUMBER_COOLDOWN_S - (now - _last_by_number.get(req.phone, 0))
        if wait > 0:
            raise HTTPException(status_code=429, detail=f"This number was just called. Try again in {int(wait)} s.")
        if CREDITS is not None:
            try:
                left = _credit_status()["remaining"]
            except ProfileError:
                raise HTTPException(status_code=503, detail="Kin can't check the demo credit right now. Try again in a minute.")
            need = (req.call_length_minutes + 1) * RATE_PER_MIN
            if left < need:
                raise HTTPException(
                    status_code=402,
                    detail=f"Not enough demo credit left (₹{max(left, 0):g}). A {req.call_length_minutes}-minute call needs up to ₹{need:g}.",
                )
        # Reserve the slot and the credit before calling Sarvam; released below if the call fails.
        previous = _last_by_number.get(req.phone)
        _placed.append(now)
        _last_by_number[req.phone] = now
        mine = {"placed": now, "phone": req.phone, "minutes": req.call_length_minutes, "language": req.language}
        _attempts[pending] = mine

    variables = {
        "parent_name": req.parent_name,
        "language": AUTO_LANGUAGE if req.language == "Auto" else req.language,
        "call_mode": "daily",
        "call_length_minutes": str(req.call_length_minutes),
    }
    optional = {
        "family_name": req.family_name,
        "medicines": req.medicines,
        "health_notes": req.health_notes,
        "emergency_number": req.emergency_number,
    }
    variables.update({k: v for k, v in optional.items() if v})

    family = req.family
    if family and (family.name or family.context or family.about or family.topics_avoid or family.members):
        # Sent straight to this call, so it works even if saving fails; saved
        # for this number so inbound and later calls know the family too.
        members = [m.model_dump() for m in family.members]
        if family.name or family.context or members:
            variables["family_context"] = format_family_context(family.name, members, [], family.context)
        if family.about:
            variables["about_parent"] = family.about
        if family.topics_avoid:
            variables["topics_avoid"] = family.topics_avoid
        if not req.family_name and members:
            variables["family_name"] = members[0]["name"]
        try:
            if not save_own_family(req.phone, req.parent_name, family.model_dump()):
                print("demo: number has a real family; details used for this call only")
        except ProfileError as e:
            print(f"demo: family not saved ({e})")

    try:
        attempt_id = place_outbound(req.phone, variables, source=DEMO_SOURCE)
    except OutboundError as e:
        print(f"demo call failed: {e}")
        with _limit_lock:
            _attempts.pop(pending, None)
            if now in _placed:
                _placed.remove(now)
            if previous is None:
                _last_by_number.pop(req.phone, None)
            else:
                _last_by_number[req.phone] = previous
        raise HTTPException(status_code=502, detail="Could not place the call. Please try again.")

    with _limit_lock:
        _attempts.pop(pending, None)
        _attempts[attempt_id] = mine
    print(f"demo call placed: attempt={attempt_id}")
    return {"attempt_id": attempt_id}


def _find_result(attempt_id: str) -> dict | None:
    try:
        record = event_for_attempt(attempt_id)
    except ProfileError:
        record = None
    if record is None:
        record = _find_in_file(attempt_id)
    # Never hand out non-demo calls (real parents' calls) through this route.
    return record if record and payload_source(record) == DEMO_SOURCE else None


def _find_in_file(attempt_id: str) -> dict | None:
    """Fallback: payloads kept in the file while Postgres was unreachable."""
    if not CALLS_FILE.exists():
        return None
    # Newest last; scan from the end so the lookup stays quick.
    for line in reversed(CALLS_FILE.read_text(encoding="utf-8").splitlines()):
        if attempt_id in line:
            try:
                record = json.loads(line)
            except ValueError:
                continue
            if record.get("attempt_id") == attempt_id:
                return record
    return None


def _attempt(attempt_id: str) -> dict | None:
    """In memory first; Postgres covers calls placed before an API restart."""
    if attempt_id in _attempts:
        return _attempts[attempt_id]
    try:
        info = attempt_info(attempt_id, DEMO_SOURCE)
    except ProfileError:
        return None
    if not info:
        return None
    v = info["variables"]
    language = v.get("language")
    return {
        "placed": info["created_at"].timestamp(),
        "phone": info["phone"],
        "minutes": int(v.get("call_length_minutes") or 0) or None,
        # Auto is sent as an instruction, not a language name.
        "language": language if language in Language.__args__ else "Auto",
    }


@router.get("/calls/{attempt_id}")
def get_call(attempt_id: str) -> dict:
    if not re.fullmatch(r"[0-9a-fA-F-]{8,64}", attempt_id):
        raise HTTPException(status_code=400, detail="bad attempt id")

    record = _find_result(attempt_id)
    info = _attempt(attempt_id)
    if record is None:
        if info is None:
            raise HTTPException(status_code=404, detail="Unknown call")
        elapsed = int(time.time() - info["placed"])
        state = "in_progress" if elapsed < RESULT_TIMEOUT_S else "timeout"
        connected = connected_since(info["phone"], info["placed"])
        return {"state": state, "elapsed_s": elapsed, "stage": "connected" if connected else "calling"}

    outputs = record.get("output_agent_variables") or {}
    duration = record.get("duration") or 0
    return {
        "state": "done",
        "status": record.get("status"),
        "duration_s": round(duration),
        "charge": charge(duration),
        "rate_per_min": RATE_PER_MIN,
        "placed_at": datetime.fromtimestamp(info["placed"], timezone.utc).isoformat() if info else None,
        "minutes": info["minutes"] if info else None,
        "language": info["language"] if info else None,
        "failure_reason": record.get("failure_reason"),
        "spoken_language": record.get("spoken_language"),
        "outputs": {k: outputs.get(k) for k in (
            "call_summary", "meds_taken", "sleep_quality", "pain_mentioned", "pain_location",
            "mood", "concerns", "wants_family_callback", "urgent_flag", "call_outcome",
        )},
    }
