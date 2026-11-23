"""Place one Sarvam Instant Outbound call. Shared by place_call.py and /demo/calls."""

import os

import httpx

from app.context import build_context, time_of_day
from app.greetings import GREETINGS
from app.greetings_util import language_or_default, opening_line
from app.parents import ProfileError, get_profile, has_consented, remember_call

# Committed version of the "Kin Agent" (id Kin-Evening-6c657418-97eb) that calls run.
# Sarvam has no "latest" option, so bump this in the same commit as each new
# agent version. SARVAM_APP_VERSION in the env overrides it (emergency rollback
# without a redeploy); leave that unset normally.
AGENT_VERSION = 11

REQUIRED = [
    "SARVAM_APPS_API_KEY",
    "SARVAM_ORG_ID",
    "SARVAM_WORKSPACE_ID",
    "SARVAM_APP_ID",
    "SARVAM_CONNECTION_ID",
    "SARVAM_AGENT_PHONE",
]


def agent_version() -> int:
    return int(os.environ.get("SARVAM_APP_VERSION") or AGENT_VERSION)


def phone_variable(phone: str | None) -> dict[str, str]:
    """The number the flag_urgent / flag_scam tools send back to /hooks; agent v11 and later declare it."""
    return {"parent_phone": phone} if phone and agent_version() >= 11 else {}


class OutboundError(Exception):
    """Sarvam refused the call, or the config is incomplete."""


def missing_config() -> list[str]:
    return [k for k in REQUIRED if not os.environ.get(k)]


def place_outbound(phone: str, agent_variables: dict[str, str], source: str, opening=None) -> str:
    """Asks Sarvam to call `phone` and returns the attempt_id.

    Marks the call as outbound (so the on-start hook leaves the variables
    alone), adds the last call's summary as memory, and afterwards stores the
    profile so the parent is recognised when they call Kin back.

    opening(language, time_of_day, disclose) -> str replaces the usual greeting
    (medicine reminders, app/reminders.py).
    """
    if missing := missing_config():
        raise OutboundError("Missing config: " + ", ".join(missing))

    tod = time_of_day()
    requested = agent_variables.get("language")
    # A real language name, or None for "Auto" (the demo then sends an instruction
    # like "whichever language the parent speaks" for the agent instead).
    known = requested if requested in GREETINGS else None
    if not known:
        try:
            saved = (get_profile(phone) or {}).get("language")
        except ProfileError:
            saved = None
        known = saved if saved in GREETINGS else None
    language = language_or_default(known)  # what the call opens in
    try:
        disclose = not has_consented(phone)  # "I am an AI assistant" until they have said yes
    except ProfileError:
        disclose = True
    agent_variables = {
        **agent_variables,
        "direction": "outbound",
        "time_of_day": tod,
        "language": known or requested or language,
        **phone_variable(phone),
    }
    # Recent history (memory + open threads) unless the caller supplied its own.
    for key, value in build_context(phone).items():
        agent_variables.setdefault(key, value)

    e = os.environ
    url = (
        "https://apps.sarvam.ai/api/outbounds/v1"
        f"/orgs/{e['SARVAM_ORG_ID']}/workspaces/{e['SARVAM_WORKSPACE_ID']}/outbounds"
    )
    body: dict = {
        "app_config": {
            "app_id": e["SARVAM_APP_ID"],
            "app_version": agent_version(),
            "connection_config": {
                "connection_id": e["SARVAM_CONNECTION_ID"],
                "agent_phone_number": e["SARVAM_AGENT_PHONE"],
            },
            "agent_variables": agent_variables,
            # Start in the parent's language, with a greeting for the time of day in India.
            "app_overrides": {
                "initial_language_name": language,
                "initial_bot_message": opening(language, tod, disclose) if opening else opening_line(
                    f"outbound_{tod}", language, agent_variables.get("parent_name", ""), agent_variables.get("family_name", ""),
                    disclose=disclose,
                ),
            },
        },
        "user_config": {"user_phone_number": phone},
    }
    # Without a public URL the call still happens; the result just isn't delivered.
    # The token goes in metadata (echoed back in the payload), never the URL.
    if e.get("PUBLIC_API_URL") and e.get("SARVAM_WEBHOOK_TOKEN"):
        body["webhook_config"] = {
            "url": f"{e['PUBLIC_API_URL'].rstrip('/')}/webhooks/sarvam",
            "metadata": {"source": source, "token": e["SARVAM_WEBHOOK_TOKEN"]},
        }

    res = httpx.post(url, json=body, headers={"X-API-Key": e["SARVAM_APPS_API_KEY"]}, timeout=30)
    if res.status_code != 200:
        raise OutboundError(f"Sarvam returned {res.status_code}: {res.text[:300]}")
    attempt_id = res.json()["attempt_id"]
    try:
        # Only a real language name is worth remembering, never the Auto instruction.
        remember_call(phone, {**agent_variables, "language": known}, attempt_id, source, sent=agent_variables)
    except ProfileError as err:
        print(f"outbound: call placed but profile not saved ({err})")
    return attempt_id
