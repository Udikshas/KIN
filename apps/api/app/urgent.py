"""Emergencies Kin hears during a call: tell the family at once, while the call is still on.

The Sarvam agent's `flag_urgent` tool calls POST /hooks/urgent (app/routes/hooks.py)
when the parent mentions a fall, chest pain, trouble breathing or confusion. Kin
then:
- records the event (one per parent per DEDUPE_MINUTES: the agent may flag twice);
- pushes every family phone straight away: "Urgent: Maa may need help";
- answers the agent with the emergency contact's number for `call_transfer`.

The app shows an open event as a red banner on Today until someone marks it
handled (POST /me/urgent/{id}/handled). The after-call evening card still says
"needs attention" from the call's urgent_flag.

Scam shield: the agent's `flag_scam` tool (POST /hooks/scam) records an event
of kind 'scam' when the parent describes a caller or message asking for an OTP,
PIN, bank details, money or a remote-access app. The family is pushed ("Maa may
be talking to a scammer") and the app shows an amber banner; the agent gets back
what to tell the parent, and there is no call transfer.
"""

from app.families import _one, _query

DEDUPE_MINUTES = 15
SHOW_HOURS = 12  # an unhandled event older than this no longer shows as live
# What the agent says to the parent after flag_scam (returned to the tool call).
SCAM_ADVICE = (
    "Tell them gently: do not share any OTP, PIN or bank details, do not send money and do not install any app "
    "the caller asks for. Banks and the police never ask for these on the phone. If the caller rings again, "
    "hang up."
)
# Added only when a family was actually alerted.
SCAM_FAMILY_TOLD = " Their family has been told and will call them."


def raise_alarm(phone: str, reason: str | None, kind: str = "urgent") -> dict:
    """Records the emergency. Returns who to push and who Kin should connect the parent to."""
    parent = _one(
        "SELECT p.parent_name, p.family_id, p.emergency_number FROM parents p WHERE p.phone = %(p)s",
        {"p": phone},
    )
    if not parent:
        return {"known": False}
    contact = None
    if parent["family_id"]:
        contact = _one(
            "SELECT name, phone FROM members WHERE family_id = %(f)s AND is_emergency AND phone IS NOT NULL LIMIT 1",
            {"f": parent["family_id"]},
        )
    number = parent["emergency_number"] or (contact and contact["phone"])
    recent = _one(
        "SELECT id FROM urgent_events WHERE phone = %(p)s AND kind = %(k)s "
        "AND created_at > now() - make_interval(mins => %(m)s) LIMIT 1",
        {"p": phone, "k": kind, "m": DEDUPE_MINUTES},
    )
    event_id, new = (recent["id"], False) if recent else (_query(
        "INSERT INTO urgent_events (phone, family_id, reason, kind) VALUES (%(p)s, %(f)s, %(r)s, %(k)s) RETURNING id",
        {"p": phone, "f": parent["family_id"], "r": (reason or "").strip()[:300] or None, "k": kind},
    )[0]["id"], True)
    return {
        "known": True,
        "new": new,
        "kind": kind,
        "event_id": event_id,
        "name": parent["parent_name"],
        "family_id": parent["family_id"],
        "contact_name": contact["name"] if contact else None,
        "emergency_number": number,
    }


def open_event(phone: str) -> dict | None:
    """The latest unhandled emergency (or scam warning) for this parent, for the app's banner.

    An emergency outranks a scam warning: it shows first while both are open.
    """
    return _one(
        f"SELECT id, kind, reason, created_at FROM urgent_events WHERE phone = %(p)s AND handled_at IS NULL "
        f"AND created_at > now() - interval '{SHOW_HOURS} hours' ORDER BY kind = 'urgent' DESC, created_at DESC LIMIT 1",
        {"p": phone},
    )


def mark_handled(family_id: int, event_id: int, member_id: int) -> bool:
    return bool(_query(
        "UPDATE urgent_events SET handled_at = now(), handled_by = %(m)s "
        "WHERE id = %(i)s AND family_id = %(f)s AND handled_at IS NULL RETURNING id",
        {"i": event_id, "f": family_id, "m": member_id},
    ))
