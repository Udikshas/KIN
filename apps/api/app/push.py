"""Push notifications to the family's phones through the Expo Push API.

The app registers each signed-in phone's Expo push token (POST /me/push-tokens).
When a call's webhook has been stored, notify_call tells every phone of that
parent's family:

- answered call: the evening card ("Maa's evening card is ready"), or
  "needs attention" / "something to watch" from the call's signal; when the
  parent left a message ("tell Neha…", app/messages.py) the push is that
  message, sent only to the named member's phones if they use the app;
- the scheduler's last try of the evening went unanswered: "didn't answer
  tonight" (earlier tries stay quiet: Kin is still retrying), or "hasn't
  answered for 3 days" once that is a red alert;
- the parent asked Kin to stop calling (agent output stop_calls): "Maa asked
  Kin to stop calling", daily calls are already off;
- medicine reminder calls (app/reminders.py): only "hasn't taken the 8:00 pm
  medicines" or "didn't answer the medicine reminder" (notify_reminder);
- Try-it calls and introduction calls (a family member merging the parent
  in) send nothing.

For an answered call the "what changed" card is written first (app/insights.py);
its headline is the push body.
Sending runs in a thread so the webhook answers Sarvam at once. Tokens Expo
reports as DeviceNotRegistered are deleted. EXPO_ACCESS_TOKEN is only needed
if "enhanced push security" is on in the Expo dashboard.
"""

import os
import threading

import httpx

from app import insights, me, reminders
from app.families import _query
from app.parents import ProfileError, payload_source
from app.scheduler import MAX_RETRIES

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
CHANNEL = "default"  # the Android channel the app creates (src/lib/push.ts)


def tokens_for(phone: str, to_name: str | None = None) -> list[str]:
    """The family's phones; only the named member's ("tell Rohan…") if they use the app."""
    rows = _query(
        "SELECT t.token, lower(m.name) AS name FROM push_tokens t JOIN parents p ON p.family_id = t.family_id "
        "LEFT JOIN members m ON m.family_id = t.family_id AND m.user_id = t.user_id WHERE p.phone = %(p)s",
        {"p": phone},
    )
    named = [r["token"] for r in rows if to_name and r["name"] == to_name.strip().lower()]
    return named or [r["token"] for r in rows]


def send(tokens: list[str], title: str, body: str, data: dict) -> int:
    """Sends one message to each token; returns how many Expo accepted."""
    headers = {"accept": "application/json", "content-type": "application/json"}
    if os.getenv("EXPO_ACCESS_TOKEN"):
        headers["authorization"] = f"Bearer {os.environ['EXPO_ACCESS_TOKEN']}"
    accepted = 0
    for i in range(0, len(tokens), 100):  # Expo takes at most 100 messages a request
        batch = tokens[i : i + 100]
        messages = [
            {"to": t, "title": title, "body": body, "data": data, "sound": "default", "channelId": CHANNEL, "priority": "high"}
            for t in batch
        ]
        try:
            res = httpx.post(EXPO_PUSH_URL, json=messages, headers=headers, timeout=15)
            tickets = res.json().get("data") or []
        except (httpx.HTTPError, ValueError) as e:
            print(f"push: send failed ({type(e).__name__}: {e})")
            continue
        for token, ticket in zip(batch, tickets):
            if ticket.get("status") == "ok":
                accepted += 1
            elif (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
                _query("DELETE FROM push_tokens WHERE token = %(t)s RETURNING token", {"t": token})
            else:
                print(f"push: ticket error {ticket.get('message')}")
    return accepted


def message_for(phone: str, payload: dict) -> tuple[str, str, dict, str | None] | None:
    """(title, body, data, to_name) for this finished call, or None when it's not worth a push.

    to_name: the family member a "tell my family" message was for (None = everyone).
    """
    if payload_source(payload) == "demo":
        return None
    parent = _query(
        "SELECT parent_name, family_id FROM parents WHERE phone = %(p)s AND family_id IS NOT NULL",
        {"p": phone},
    )
    if not parent:
        return None
    name, family_id = parent[0]["parent_name"], parent[0]["family_id"]
    status = payload.get("status")
    outputs = payload.get("output_agent_variables") or {}

    if status == "connected":
        key = payload.get("interaction_id") or payload.get("attempt_id")
        row = _query("SELECT id, insight FROM calls WHERE coalesce(interaction_id, attempt_id) = %(k)s ORDER BY id DESC LIMIT 1", {"k": key})
        signal = me.call_signal(status, outputs)
        call_id = row[0]["id"] if row else None
        note = _query(
            "SELECT text, to_name FROM family_messages WHERE call_id = %(c)s AND direction = 'from_parent'", {"c": call_id}
        ) if call_id else []
        if outputs.get("stop_calls") is True and signal != "red":
            return (f"{name} asked Kin to stop calling",
                    f"Daily calls are off. Talk to {name}, and switch them back on in Kin only if they agree.",
                    {"screen": "parent"}, None)
        # A message from the parent is the news, unless the call needs attention.
        if note and signal != "red":
            return f"Message from {name}", f"“{note[0]['text']}”"[:180], {"screen": "today"}, note[0]["to_name"]
        title = {
            "red": f"{name} needs attention",
            "amber": f"{name}'s call card: something to watch",
        }.get(signal, f"{name}'s call card is ready")
        # What changed (app/insights.py) when something did; on a usual day the agent's own summary says more.
        insight = (row[0]["insight"] if row else None) or {}
        changed = insight.get("headline") if insight.get("changes") or insight.get("suggestion") else None
        body = (changed or outputs.get("call_summary") or "Open Kin to see how the call went.")[:180]
        return title, body, {"callId": call_id}, None

    # Not answered: quiet while the scheduler still has a retry to make.
    job = _query("SELECT try FROM call_jobs WHERE attempt_id = %(a)s", {"a": payload.get("attempt_id")})
    if not job or job[0]["try"] < MAX_RETRIES:
        return None
    alert = me.parent_alert(me.recent_calls(family_id, phone, days=10, limit=30))
    if alert and alert["level"] == "red" and alert["reason"] == "no_answer":
        return f"{name} hasn't answered for 3 days", f"Kin couldn't reach {name}. Please call them or someone nearby.", {"screen": "alert"}, None
    return f"{name} didn't answer tonight", f"Kin tried {MAX_RETRIES + 1} times. You may want to call {name}.", {"screen": "call"}, None


def _first_delivery(payload: dict) -> bool:
    """Claims this call for notifying; False if another delivery of the same webhook already did."""
    key = payload.get("interaction_id") or payload.get("attempt_id")
    return bool(key) and bool(_query(
        "UPDATE calls SET notified_at = now() "
        "WHERE id = (SELECT id FROM calls WHERE coalesce(interaction_id, attempt_id) = %(k)s ORDER BY id DESC LIMIT 1) "
        "AND notified_at IS NULL RETURNING id",
        {"k": key},
    ))


def notify_call(phone: str, payload: dict) -> None:
    try:
        if payload_source(payload) != "demo":
            insights.call_insight(phone, payload)  # the card first, so the push can carry its headline
    except Exception as e:  # a card problem must never stop the push
        print(f"push: insight failed: {type(e).__name__}: {e}")
    try:
        msg = message_for(phone, payload)
        if not msg or not _first_delivery(payload):
            return
        title, body, data, to_name = msg
        tokens = tokens_for(phone, to_name)
        if tokens:
            sent = send(tokens, title, body, {**data, "phone": phone})  # which parent, for the app
            print(f"push: '{title}' to {sent}/{len(tokens)} phones")
    except ProfileError as e:
        print(f"push: database unavailable ({e})")
    except Exception as e:  # a push problem must never affect storing the call
        print(f"push: failed: {type(e).__name__}: {e}")


def notify_urgent(phone: str, alarm: dict, reason: str | None) -> None:
    """During the call: every family phone, at once (app/urgent.py), for an emergency or a scam."""
    try:
        tokens = tokens_for(phone)
        if not tokens:
            return
        name = alarm["name"]
        heard = f"Kin heard: “{reason.strip()}”. " if reason and reason.strip() else ""
        if alarm.get("kind") == "scam":
            title = f"Scam warning: {name} may be talking to a scammer"
            then = f"Kin told {name} not to share any OTP or send money. Call {name} to check."
        else:
            title = f"Urgent: {name} may need help"
            then = f"Kin is connecting {name} to {alarm['contact_name']}." if alarm.get("contact_name") else f"Call {name} now."
        sent = send(tokens, title, (heard + then)[:180], {"screen": "alert", "phone": phone})
        print(f"push: {alarm.get('kind', 'urgent')} for {name} to {sent}/{len(tokens)} phones")
    except ProfileError as e:
        print(f"push: database unavailable ({e})")
    except Exception as e:
        print(f"push: urgent failed: {type(e).__name__}: {e}")


def notify_reminder(payload: dict) -> None:
    """A medicine reminder call ended (app/reminders.py): push only when not taken, or never answered."""
    try:
        msg = reminders.on_result(payload)
        if not msg:
            return
        tokens = tokens_for(msg["phone"])
        if tokens:
            sent = send(tokens, msg["title"], msg["body"][:180], {**msg["data"], "phone": msg["phone"]})
            print(f"push: '{msg['title']}' to {sent}/{len(tokens)} phones")
    except ProfileError as e:
        print(f"push: database unavailable ({e})")
    except Exception as e:
        print(f"push: reminder failed: {type(e).__name__}: {e}")


def notify_reminder_async(payload: dict) -> None:
    threading.Thread(target=notify_reminder, args=(payload,), name="kin-push-reminder", daemon=True).start()


def notify_urgent_async(phone: str, alarm: dict, reason: str | None) -> None:
    threading.Thread(target=notify_urgent, args=(phone, alarm, reason), name="kin-push-urgent", daemon=True).start()


def notify_call_async(phone: str, payload: dict) -> None:
    threading.Thread(target=notify_call, args=(phone, payload), name="kin-push", daemon=True).start()
