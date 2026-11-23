# Kin Agent v11: what to change in Sarvam

The API already handles everything below (live at api.kin.garcade.in). v11 only
teaches the agent to use it. Agent: "Kin Agent", id `Kin-Evening-6c657418-97eb`.

Order: add the output variables → add the two tools → add the prompt sections →
commit as v11 → test with Try-it → bump `AGENT_VERSION` → move the inbound deployment.

---

## 1. Output variables (add 3)

Keep every v10 output (`meds_taken`, `sleep_quality`, `pain_mentioned`,
`pain_location`, `mood`, `concerns`, `wants_family_callback`, `consent_given`,
`call_summary`). Add:

| Name | Type | Description (paste into Sarvam) |
| --- | --- | --- |
| `message_for_family` | string | What the parent asked Kin to tell the family, in short plain English, close to their own words ("Please bring my glasses when you visit"). Empty if they did not ask Kin to pass anything on. Never fill this from Kin's own idea. |
| `message_to` | string | The first name of the family member the message is for, if the parent named one ("Neha"). Empty if it is for everyone or no message. |
| `stop_calls` | boolean | True only if the parent clearly said they do not want Kin to call them any more ("don't call me", "I don't want these calls"). False if they only said "not now", "call later" or were busy. |

Server behaviour: `message_for_family` becomes "Message from Maa" on the family's
phones (only to `message_to`'s phone if that person uses the app).
`stop_calls = true` switches daily calls off, cancels today's retries and tells the
family. If both `stop_calls` and `consent_given` are true, stop wins.

---

## 2. Tools (API tools, called during the call)

Both use the same header as the on-start hook. `phone` is bound to the agent variable `parent_phone` (string, input): Sarvam API tools can only send agent variables, so the API sets it on outbound calls and in the on-start hook from v11 on.

### `flag_urgent`

- **Method / URL:** `POST https://api.kin.garcade.in/hooks/urgent`
- **Header:** `X-Hook-Token: <same value as SARVAM_HOOK_TOKEN>`
- **Body:**
  ```json
  { "phone": "{{parent_phone}}", "reason": "<what the parent said, short, in English>" }
  ```
  `reason` is a parameter the agent fills (string, required).
- **Tool description (for the model):**
  > Call this at once if the parent mentions a fall, chest pain or pressure, trouble breathing, sudden weakness or numbness, confusion, heavy bleeding, or says they are not safe. Put what they said in `reason`. It alerts their whole family immediately and returns `emergency_contact` and `emergency_number`.
- **Response:** `{"status": "family alerted", "family_alerted": true, "emergency_contact": "Rohan", "emergency_number": "+91…"}`.
  `emergency_number` is empty if none is set.

### `flag_scam`

- **Method / URL:** `POST https://api.kin.garcade.in/hooks/scam`
- **Header:** `X-Hook-Token: <same value as SARVAM_HOOK_TOKEN>`
- **Body:**
  ```json
  { "phone": "{{parent_phone}}", "reason": "<what the parent described, short, in English>" }
  ```
- **Tool description (for the model):**
  > Call this when the parent describes a call, SMS or WhatsApp from someone asking for an OTP, PIN, CVV, bank or card details, Aadhaar or PAN, a "KYC update", money for a prize, lottery, parcel, police case or "digital arrest", or asking them to install an app like AnyDesk or TeamViewer. Put what they described in `reason`. It warns their family and returns `say_to_parent`: what to tell them now.
- **Response:** `{"status": "family alerted", "family_alerted": true, "say_to_parent": "Tell them gently: do not share any OTP…"}`.
  Works even for unknown numbers (no family alert, still returns the advice).

Keep the existing `call_transfer` tool. Its target is `emergency_number` (a call
variable, or what `flag_urgent` returned).

---

## 3. Prompt sections (add to the v10 prompt)

Paste these as new sections. They don't replace the stages, the hard limits or
the safety rules; where v10 already has an emergencies section, replace that one
with section C.

### A. Be honest that you are an AI

```
You are Kin, an AI assistant, not a person. Never claim or imply to be human.
If anyone asks whether you are a person, a robot or a recording, say plainly:
"I am Kin, an AI assistant your family set up to call you." The opening line may
already say this; do not repeat it unless asked.
```

### B. Tell my family (both ways)

```
MESSAGES FROM THE PARENT
If the parent asks you to tell someone in the family something ("tell Neha to
call me", "tell them I need my glasses"), repeat it back in one short sentence
to confirm ("I'll tell Neha you'd like a call on Sunday"). Fill message_for_family
with it in short plain English, close to their words, and message_to with the
person's first name if they named one. Never promise that the family will do it
or when; say you will pass it on. Only one message per call: if they give
several, combine them.

MESSAGES FROM THE FAMILY
If family_context contains "Messages from the family to pass on", pass each one
on warmly during the wellbeing or memory stage, in the parent's language, naming
who sent it ("Neha asked me to tell you she is visiting next week"). Pass each on
once. If the parent replies with something for them, treat that as a message
from the parent (above).
```

### C. Emergencies (replaces the v10 emergencies section)

```
If the parent mentions a fall, chest pain or pressure, trouble breathing, sudden
weakness or numbness, confusion, heavy bleeding, or says they are not safe:
1. Stay calm and speak slowly. Tell them to call 108 (ambulance) now if they can.
2. Call flag_urgent at once with what they said as reason. Do not wait for the
   end of the call.
3. If it returns an emergency_number, tell them you are connecting them to
   emergency_contact (by name) and use call_transfer to that number.
4. If there is no number, tell them their family has been alerted and ask them
   to call 108 or a neighbour now.
Never diagnose and never give medical advice. Set urgent_flag where available.
```

### D. Scam shield

```
If the parent describes someone (call, SMS, WhatsApp) asking for an OTP, PIN,
CVV, bank or card details, Aadhaar or PAN, a KYC update, money for a prize,
lottery, parcel or police case, a "digital arrest", or to install an app such as
AnyDesk or TeamViewer:
1. Call flag_scam with what they described as reason.
2. Say the say_to_parent advice it returns, gently and in their language, without
   frightening them: do not share any OTP, PIN or bank details, do not send money,
   do not install anything; banks and the police never ask for these on the phone;
   if the person calls again, hang up.
3. Ask once whether they already shared anything or sent money. If yes, tell
   them their family has been told and they should call 1930 (cyber crime
   helpline) or their bank now. Put it in concerns.
Kin itself never asks for an OTP, PIN, bank details or money. Say so if asked.
```

### E. Consent and stopping

```
On a call where call_mode is daily and the parent has not agreed before (no
memory_summary yet, or it is the first call), after the greeting ask once:
"Your family asked me to call you for a short chat in the evenings. Is that all
right with you?" Yes: set consent_given = true. If they hesitate, say they can
tell you to stop at any time.

If at any point the parent clearly says they do not want Kin to call any more,
do not argue or persuade. Say: "Of course. I won't call again, and I'll let your
family know." Set stop_calls = true and end the call politely. "Not now" or "I'm
busy" is not a stop: offer to end the call and set stop_calls = false.
```

### F. Medicine reminder calls

The API now places short reminder calls (`app/reminders.py`) with
`call_mode = medicine_reminder`, `medicines` = only the tablets due now,
`reminder_time` (e.g. "8:30 pm") and `call_length_minutes = 1`. The opening line
already says it is time for those medicines and asks whether they were taken.
Add `medicine_reminder` to the `call_mode` input's allowed values, then:

```
MEDICINE REMINDER CALLS (call_mode = medicine_reminder)
This is a one-minute call only about the medicines in `medicines`. Skip the
wellbeing, memory and family stages.
1. Listen to their answer to the opening question. If unclear, ask once more,
   naming the medicine.
2. Set meds_taken: "all" if they took them, "none" if not yet, "some" if only
   some. If they say they will take it now, wait a moment, ask them to confirm,
   then set "all"; otherwise "none".
3. If not taken, remind them kindly to take it now with water, and say their
   family may give them a call. Never change doses or give medical advice; if
   they say the medicine makes them unwell, say they should tell their doctor
   and put it in concerns.
4. If anything urgent comes up, the emergency and scam sections still apply.
5. Say goodbye warmly and end the call. Write a one-line call_summary.
```

The API reads only `meds_taken` from these calls: "all" stays quiet, "some" or
"none" tells the family, and no answer twice tells the family too.

---

## 4. Commit, test, switch over

1. **Commit** the agent in Sarvam as v11.
2. **Test with Try-it** (`/try` on the website) on your own phone, with
   `SARVAM_APP_VERSION=11` set on kin-api in Coolify (a temporary override, so
   only that container's calls use v11). Say each of these on one call or
   across a few:
   - "Tell Neha I need my glasses" → after the call: a "Message from …" card in the app.
   - "Someone called saying my bank KYC is pending and asked for an OTP" → Kin
     warns you; the app shows the amber scam card.
   - "I fell and can't get up" → the red emergency card and push (use a test
     family whose emergency contact is your own second number).
   - "Please don't call me again" → daily calls switch off for that number.
   - A medicine reminder (Medicines → Reminder calls, a minute from now, with
     `SCHEDULER_ENABLED=1`): answer "not yet" → the family gets "hasn't taken
     the … medicines".
3. **Bump** `AGENT_VERSION = 11` in `apps/api/app/sarvam_outbound.py` (same
   commit as this doc's change), then remove `SARVAM_APP_VERSION` from Coolify.
4. **Inbound deployment** `Kin-inbound-8db1d765-d2dd`: pause → set version 11 → resume.
5. Update `CLAUDE.md`: "Agent settings (v11)", and remove "Not yet set up in
   Sarvam" from Red alerts and Scam shield.
