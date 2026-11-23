# Kin — project context

@AGENTS.md

Kin is a mobile app that adult children install for a parent who lives alone. Kin's AI phones the parent every evening in their own language, checks sleep, pain, mood and medicine, remembers past calls, and sends the family one evening card about what changed. Built for the **Singapore India Hackathon 2026** (theme: Social Innovation and Inclusive Development; team Rocket; student: Om Sharma).

Version 1 targets **parents living in India** (the child can live anywhere, including Singapore). Pitch line: "Singapore is the customer, India is the parent."

## Living documents (source of truth)

| What | Link |
| --- | --- |
| Final project spec (decisions, agent spec, data model, build order) | https://claude.ai/code/artifact/5cabbd8b-4398-4dba-8075-e719c27a90b9 |
| Earlier research and stack comparison (stack superseded by the spec) | https://claude.ai/code/artifact/46c770cc-db01-4d77-ade7-d4f5834d6b25 |
| Single-file HTML landing prototype (published) | https://claude.ai/artifact/Qb84aysPQ7jCWi6Lvj3qDK — source in `docs/prototypes/kin-landing.html` |
| Visual style reference (Refero, Bevel; current) | https://styles.refero.design/style/c0717d1a-b446-4166-a445-6497fe287fea |
| Earlier style reference (Refero, ElevenLabs; archived) | https://styles.refero.design/style/031056ff-7af1-46db-8daa-115f731c5d26 |

When a decision changes, update the final spec doc and this file together.

## Repo layout (pnpm workspaces + Turborepo)

| Path | Status | Stack |
| --- | --- | --- |
| `apps/web` | Built: landing page, app-screen mockups, waitlist form, family dashboard (`/dashboard`, same sign-in as the app) | Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4 |
| `apps/api` | Live at api.kin.garcade.in: `/health`, SuperTokens auth (`/auth/*`), app routes `/me/*` (family, members, parents, calls; `verify_session()`), `/webhooks/sarvam`, `/waitlist` (Postgres), Try-it `/demo/calls` (token + rate limited), `Dockerfile` | FastAPI (Python), Postgres, deployed to own VPS with Coolify |
| `apps/mobile` | Built: sign-in (SuperTokens email OTP), setup, Today / Calls / Trends / Family tabs, call, alert, memory, medicines, introduce, settings. Real data from `/me/*`; sample family in "Look around" mode (see `apps/mobile/README.md`) | Expo SDK 58 (React Native), Expo Router |
| `packages/` | Empty | Shared code later |
| `docs/prototypes/` | Reference | Original single-file HTML landing page; `web-v1-elevenlabs/` = archived first Next.js version |

Commands (run from repo root):

- `pnpm install`
- `pnpm dev:mobile` — Expo dev server for the family app.
- `pnpm dev:web` — landing page on http://localhost:3000. Next.js allows only one dev server per app; stop any other before starting.
- `pnpm build`, `pnpm lint`
- Local API (in `apps/api`): `docker compose -f docker-compose.dev.yml up -d` (Postgres on 5433 + SuperTokens on 3567), then `./scripts/dev.sh` (uvicorn on :8000; loads `.env`, then gitignored `.env.local` with the local overrides). With `AUTH_LOG_CODES=1` sign-in codes are printed in the API log instead of emailed.
- The mobile app in dev (`__DEV__`) talks to `http://<Metro host>:8000`, so Expo Go on the same Wi-Fi hits the local API; release builds use `https://api.kin.garcade.in`. `EXPO_PUBLIC_API_URL` overrides both.
- API tests: `cd apps/api && pip install -r requirements-dev.txt && pytest` (real Postgres per test via pgserver; Sarvam, Expo and SuperTokens faked). CI (`.github/workflows/ci.yml`) runs them plus `pnpm lint` on pushes to `main` / `app-dev` and on PRs.

Next.js 16 differs from older versions: read `apps/web/node_modules/next/dist/docs/` before using unfamiliar APIs (see `apps/web/AGENTS.md`).

## Locked decisions

| Area | Decision |
| --- | --- |
| Live voice agent | **Sarvam Voice Agents** (formerly Samvaad). Models are fixed by Sarvam: Saaras v4 (speech-to-text), `sarvam-105b-conversations` (LLM, auto-routed), Bulbul v3/v4 (voice, selectable). No bring-your-own model inside the call. |
| Phone number | Rented from Sarvam (Sarvam Vobiz connection): **+91 79714 13869**, active since 9 Oct 2026, renews 8 Nov 2026. ₹59/month launch offer (normally ₹159). |
| Outbound calls | Sarvam **Instant Outbound API**, triggered by Kin's own scheduler (not Campaigns): `POST https://apps.sarvam.ai/api/outbounds/v1/orgs/{org_id}/workspaces/{workspace_id}/outbounds` |
| Numbers | One shared Kin number for all parents. Outbound calls are matched by `attempt_id`; inbound calls by caller number via the on-start hook. |
| After-call AI | **Claude API** on the backend: evening card summary, memory update, 30-day trend notes. Claude is not in the live call. |
| Backend | FastAPI + Postgres on own VPS via Coolify (replaced Supabase). Services: `api`, `worker`, `postgres`, `supertokens`. |
| Auth | **SuperTokens** (self-hosted core `supertokens-postgresql:12.2` on Coolify + `supertokens-python` SDK in FastAPI). Passwordless email OTP now (with `SMTP_*` set, `app/auth_email.py` sends a Kin-styled email with the code in the subject; otherwise SuperTokens' plain default email); phone OTP later (needs SMS provider + India DLT). Routes under `/auth`; protect endpoints with `verify_session()`. Expo uses `supertokens-react-native`. Firebase dropped. |
| Push | Expo Push API from FastAPI (`apps/api/app/push.py`, built): phones register at `POST /me/push-tokens`; after a call's webhook the family gets the evening card (or "needs attention" / "something to watch"), "didn't answer tonight" after the scheduler's last try, "hasn't answered for 3 days" on that red alert; once per call (`calls.notified_at`); never for Try-it or introduction calls. Every push carries the parent's `phone` in its data, so a tap opens that parent (the app switches first). Android needs FCM credentials in EAS and a build (no remote push in Expo Go); iOS works in Expo Go. |
| Voice cloning | Not used. Only real recorded family clips. |
| Languages | Hindi first, then Tamil, Malayalam, Bengali, English. |
| Later | Plivo India (₹200/month number, needs Certificate of Incorporation + GST); Singapore elders via Plivo Singapore number + local partner + a Mandarin/Hokkien voice stack (Sarvam has none). |

## Inbound calls

Parent dials +91 79714 13869 → Sarvam inbound **deployment** answers with the agent → agent's **on-start hook** `POST /hooks/on-start` (`X-Hook-Token` = `SARVAM_HOOK_TOKEN`, body `{phone: {{ user_identifier }}, direction: {{ direction }}}`) → API looks the number up in Postgres `parents` and returns `agent_variables` (name, family, medicines, `call_mode=inbound`, `caller_known`, last call summary as `memory_summary`) plus `custom_app_config.initial_bot_message` (greets by name; unknown numbers get "who is calling?" and no health details). A **family member's** number (in `members`, family with exactly one parent) gets `call_mode=introduction` for that parent: Kin asks them to merge the parent in, and the parent's spoken yes sets `parents.consent_at`. Outbound calls send `direction=outbound`, so the hook changes nothing. `parents` is filled whenever Kin places a call (`app/parents.py`); every connected call's `call_summary` is saved as memory for the next call. Inbound webhooks carry the token in top-level `metadata`.

## Agent settings (v11)

- **Languages:** 11 enabled (Hindi, English, Bengali, Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Punjabi, Odia). Each call starts in the parent's language (`app_overrides.initial_language_name` outbound, `custom_app_config` inbound); Sarvam switches if they reply in another. "Auto" = language saved on the parent's profile, else Hindi.
- **Opening lines:** per language × time of day (IST morning/afternoon/evening/night) in `apps/api/app/greetings.py`, generated once by `scripts/generate_greetings.py` (Hindi hand-written, others Sarvam mayura translate). Sent as `initial_bot_message`; `time_of_day` variable makes goodbyes fit the hour.
- **Context:** Postgres `calls` keeps every finished call; `app/context.py` builds `memory_summary` (last 5, dated "Yesterday: …") and `open_threads` (pain, missed medicines, low mood, call-back requests, concerns from the last call). `app/families.py` adds `family_context` (family-wide: members by name, relation, city and news, other parents Kin calls, family notes; never numbers) and `about_parent` (per person: routine, likes) plus `topics_avoid`; members fill in `family_name` / `emergency_number` when the parent has none. The agent uses them for the memory topic and may repeat only what is written there.
- **Knowledge base:** `kin-faq` (Sarvam KB, source in `docs/kb/*.md`, one file per topic) bound to the agent; questions about Kin go through `query_knowledge_base`. Re-upload a file after editing it.
- **Hard limits:** sexual/romantic/obscene content ends the call on the first message; abuse, threats and illegal or harmful requests get one warning, then the call ends. Sarvam has no platform guardrail settings, so this lives in the prompt.
- **Voicemail:** static, time-neutral text (Sarvam allows no variables there).
- **Inbound deployment** `Kin-inbound-8db1d765-d2dd` serves the pinned version. Changing its version needs pause → patch → resume.

## How a call works

1. The scheduler (`apps/api/app/scheduler.py`, a thread inside kin-api, on only with `SCHEDULER_ENABLED=1`) runs every minute: for parents whose family turned **Daily calls** on (`parents.daily_calls`, default off) it adds today's job at `call_time` IST (not if more than 2 h late), then claims due rows from `call_jobs` (`FOR UPDATE SKIP LOCKED`, unique per number + IST day + try, so two containers never ring twice). Source `scheduler`. `python -m app.scheduler` runs it standalone.
2. Calls Instant Outbound with the parent's number, `agent_variables` (name, language, medicines, memory) and `webhook_config.url`; stores the returned `attempt_id`.
3. Sarvam calls the parent; the conversation happens.
4. Sarvam POSTs the webhook: `status` (`connected` / `no_answer` / `busy` / `failed`), `final_agent_variables`, `interaction_transcript`, `duration`, `failure_reason`. **Transcripts are never stored:** the webhook drops `interaction_transcript` before saving anything (`drop_transcript` in `app/routes/sarvam.py`; also in `import_calls`), keeping only `spoken_language` for Try-it. Kin keeps the agent's `call_summary` and outputs. Older transcripts were removed on upgrade (`calls.transcript` dropped, stripped from `webhook_events`). Sarvam still keeps its own copy on their side.
5. `connected` → Claude writes the summary, updates memory, signal engine compares with the last 30 days → green / amber / red → card + push.
6. `no_answer` / `busy` / `failed` → retry after 20 min, max 2 retries, skipped if they talked to Kin since (built). Three **days** with no answered call = red (`parent_alert` counts IST days, not calls). Step 5 is built without any paid AI: `app/insights.py` compares each answered call with the parent's own last 30 days (pain streaks and new pain, sleep a point or more off their average, low mood when unusual or repeated, missed medicine, concerns, call-back requests) and writes `calls.insight` = {headline, changes (≤3), suggestion} before the push, whose body is the headline. `GET /me/trends` returns the 30-day note (this week vs the weeks before: answering, sleep, pain, mood, medicines, plus one thing to watch; needs ≥3 answered calls). Every line comes from a number in the data; the green/amber/red signal is still `call_signal`. Try-it calls are skipped. (Claude could later reword these, but nothing depends on it.)

**Introduction call:** the child phones the parent, taps Add call, dials the Kin number, taps Merge. The on-start hook recognises the child's number and loads the parent in introduction mode; Kin introduces itself and logs spoken consent. Fallback: a recorded intro clip (audio playback on Sarvam unconfirmed).

**Red alerts:** Sarvam `call_transfer` tool to the emergency contact (works on Sarvam Vobiz/Plivo). During the call the agent's `flag_urgent` API tool must call `POST https://api.kin.garcade.in/hooks/urgent` (header `X-Hook-Token` = `SARVAM_HOOK_TOKEN`, body: `phone` = agent variable `parent_phone` (Sarvam API tools can only send agent variables; the API fills it on outbound calls and in the on-start hook, from v11 on) and `reason`): `app/urgent.py` records it (one per parent per 15 min), pushes every family phone at once ("Urgent: Maa may need help"), answers with `emergency_contact` / `emergency_number` for the transfer, and the app shows a red banner (Call Maa / Call contact / It's handled → `POST /me/urgent/{id}/handled`). Set up in v11.

**Scam shield:** a second API tool `flag_scam` → `POST https://api.kin.garcade.in/hooks/scam` (same header and body) when the parent describes a caller or message asking for an OTP, PIN, bank details, money, a "KYC update", a prize fee or a remote-access app. Stored in `urgent_events` with `kind='scam'` (an emergency outranks it in the banner), family pushed "Scam warning: Maa may be talking to a scammer", amber banner (Call Maa / Call 1930). The tool answers `say_to_parent` (don't share OTP/PIN, don't send money or install apps, hang up; banks and police never ask). Prompt: call it, then say that advice calmly without scaring them. Set up in v11. "Their family has been told" is added to the advice only when a family was actually alerted.

**Consent and AI disclosure:** every opening line says "I am an AI assistant, not a person" (`AI_DISCLOSURE` in `app/greetings_util.py`, all 11 languages, hand-written, worth a native check) until the parent has said yes (`consent_at`), and always to unknown inbound callers. Agent v11 output `stop_calls` (true only when the parent clearly asks Kin not to call them again) switches `daily_calls` off, clears `consent_at`, drops pending retries and pushes "Maa asked Kin to stop calling". The app asks "Does Maa know?" before Daily calls can be switched on without consent.

**Medicine reminder calls** (`app/reminders.py`, tables `med_reminders` and `med_jobs`): per parent up to 4 reminders (IST "HH:MM" + which medicines), set in the app under Medicines → Reminder calls (`POST /me/reminders`, `PATCH`/`DELETE /me/reminders/{id}`; listed in `family_view` as `parents[].reminders` with today's state). The scheduler thread rings at that time (source `med_reminder`, `call_mode=medicine_reminder`, 1 minute, opening straight with the reminder), skips a reminder within 30 min of the evening call, retries once after 15 min. The webhook's `meds_taken` decides: all → quiet (tick in the app); some/none → push "Maa hasn't taken the 8:30 pm medicines"; no answer twice → push. No evening card or "what changed" card for these calls, and the app leaves them out of Today and Trends. `stop_calls` switches reminders off too. Agent prompt: section F of `docs/sarvam-agent-v11.md`. **Without the AI (`app/ivr.py`, `app/routes/ivr.py`):** when `VOBIZ_AUTH_ID`, `VOBIZ_AUTH_TOKEN` and `VOBIZ_FROM_NUMBER` are set (own Vobiz account, ~₹0.45/min instead of the agent's ₹3.50 per started minute), a reminder is a plain call that plays one clip ("…Press 1 when you have taken them. Press 2 if you cannot take them now.") and listens for a key: 1 → taken, 2 → not taken, no key after two plays → unclear, not answered → retry. Clips are spoken once with Sarvam Bulbul (Hindi/English hand-written, other languages translated with mayura), kept in Postgres `ivr_audio` and served at `/ivr/audio/{key}.wav`; Vobiz calls `/ivr/med/{token}/answer|digits|hangup` (fresh secret token per call, `ivr_calls`, redacted from access logs). On hangup the result is stored as a Sarvam-shaped payload through `save_payload`, so retries, pushes and the calendar are unchanged. Without those env vars the agent rings as before. **Medicine calendar:** `parents[].medicine` = `reminders.history` (30 IST days, oldest first): each day's reminder outcomes (latest try) plus evening calls' `meds_taken` → taken / not_taken / partly (taken, but a reminder unanswered) / no_answer / unclear; `streak` (days in a row all taken, ending today or yesterday while today has no result), `best`, `taken_days`, `known_days`. The app shows it on Medicines (`components/medicine-calendar.tsx`).

**Medicine stock and reorder** (`app/stock.py`, table `medicine_stock`, `parents.chemist_phone`): per medicine (matched by name, case-insensitive) the family records tablets a day, strip size and tablets at home (`PUT /me/stock`); what's left = count − per_day × days since (rounded up), `POST /me/stock/{id}/restock` adds strips to what's left now, `DELETE /me/stock/{id}`. `parents[].stock` gives left / days_left / runs_out_on / low (≤ 5 days) / `suggested_strips` (about a month if ongoing). **Courses:** `course_ends_on` (last IST day of a set prescription, e.g. 5 days of antibiotics; NULL = ongoing): low only if what's left won't last to the end (`enough_for_course`), `suggested_strips` covers only the rest of the course, `course_done` after it — never alerted or restocked again. `POST /me/stock/restock` {items: [{id, packs}]} = "Restock all" (checks every id first). A background thread (`stock.start_in_background`, every 30 min, 9 am–8 pm IST, `STOCK_ALERTS=0` turns it off; runs even with the scheduler off) pushes "Maa's Amlodipine runs out in about 4 days" once per stock level (cleared by a restock or recount). App: stock line on each medicine, a sheet to count / add strips / reorder (chemist's WhatsApp with the order written out, or Tata 1mg / PharmEasy / Apollo 24|7 / Blinkit search links; ordering and payment happen there), and a "running low · Reorder" line on Today. **Reorder several at once** (app `reorder-all.tsx`): Amazon is the only shop whose link can fill a cart with several products, so each medicine's Amazon product is saved once (`PUT /me/medicine-products` with a product or `amzn.in` share link; `stock.asin_from` follows a short link once; table `medicine_products`; `parents[].products`) and "Add all to the Amazon cart" opens one `amazon.in/gp/aws/cart/add.html?ASIN.n=…&Quantity.n=…` link; the chemist gets one WhatsApp message with the whole list; Tata 1mg / PharmEasy / Apollo / Blinkit can't be filled from outside, so a guided pass adds each to the same cart there. **MedPay** in-app ordering (pharmacy API: catalogue with photos, orders, delivery webhooks) is phase 2 and waits on their onboarding (credentials and docs come by email from techsupport@medpay.in; they may ask for a registered company). It would slot in at the top of the Reorder sheet.

**Monthly groceries** (`app/groceries.py`, table `grocery_items`, `parents.kirana_phone`, `parents.groceries_alerted_on`): per parent a list of items with a quantity ("5 kg") and `every_days` (7/14/21/30/60); due = `every_days` after `last_bought_on` (or now if never bought), shown 3 days ahead. `POST /me/groceries` {phone, items} (same name updates), `PATCH`/`DELETE /me/groceries/{id}`, `POST /me/groceries/bought` {ids} restarts each cycle. `parents[].groceries` (due first). The stock thread nudges "Maa's groceries: 6 items due this week" at most weekly, 9 am–8 pm IST. App: Family → Groceries ("Add the usual list" of staples, due / later, per-item frequency, Bought), an order sheet (all due items into one Amazon cart in one tap once each item's Amazon link is saved — `PUT /me/groceries/{id}/amazon`, `grocery_items.amazon_asin`; one WhatsApp to the kirana; Blinkit / Zepto / BigBasket / Instamart can't be filled from outside, so a guided one-cart pass, share / copy, "Bought them? Mark N bought" at the top) and a "Groceries due · Order" line on Today. Only what's due is ticked.

**Changing a parent's number:** `PUT /me/family/parents/{phone}/phone` {phone} (`me.change_parent_phone`) moves the parent row and every table filed under the number (`PARENT_PHONE_TABLES`: calls, attempts, webhook events, jobs, messages, urgent events, reminders, stock, groceries, products, IVR calls). Refused (409) for a number in another family or already one of this family's parents. App and dashboard: Mobile field on the parent's Profile.

**Deleting an account:** `DELETE /me` (Settings). The owner deletes the whole family: parents, calls, raw webhooks, attempts, jobs, messages, alerts, members, push tokens. Anyone else leaves (their member row and tokens go). Then the SuperTokens user is deleted.

## Sarvam agent spec

Agent "Kin Agent" (id `Kin-Evening-6c657418-97eb`; the id is permanent, only the name changed). Calls run the committed version pinned in `apps/api/app/sarvam_outbound.py` (`AGENT_VERSION`; Sarvam has no "latest"). After committing a new agent version, bump `AGENT_VERSION` in the same git commit and move the inbound deployment to it. The `SARVAM_APP_VERSION` env var is only an override for rollbacks.

- Stages: greeting → wellbeing (sleep, pain, appetite, mood, visitors) → medicines → one memory topic → closing.
- Input variables: `parent_name`, `language`, `family_name`, `medicines`, `health_notes`, `memory_summary`, `open_threads`, `topics_avoid`, `call_mode` (daily / introduction / inbound), `emergency_number`, `parent_phone` (v11; only for the two tools, never spoken).
- Output variables: `meds_taken` (all/some/none/unclear), `sleep_quality` (1–5), `pain_mentioned`, `pain_location`, `mood` (happy/ok/low/distressed), `concerns`, `wants_family_callback`, `consent_given` (introduction call, or a yes on an early daily call), and since v11 for "Tell my family" and stopping: `message_for_family` (text: what the parent asked Kin to pass on, short, in English, their words; empty otherwise), `message_to` (the family member's name if they named one) and `stop_calls` (boolean, true only if the parent clearly says they don't want Kin to call any more; Kin says it understands and their family will be told). Prompt: when the parent asks Kin to tell the family something, repeat it back to confirm ("I'll tell Neha you need your glasses") and fill those two; never promise the family will act. When `family_context` contains "Messages from the family to pass on", pass each on warmly during the call ("Neha asked me to tell you…"). Tools since v11: `flag_urgent`, `flag_scam`, `call_transfer` (to `emergency_number`). Full v11 spec and test plan: `docs/sarvam-agent-v11.md`.
- Tools: on-start hook (profile + memory), `call_transfer`, API tools `flag_urgent` and `flag_scam`, on-end hook.
- Safety: fall / chest pain / can't breathe / disorientation → tell them to call 108, `flag_urgent`, transfer to family. Never give medical advice. Repeat back when unsure. Never mention `topics_avoid` (families edit them on the parent's Profile screen, "Topics Kin avoids": up to 6, one comma-separated line of ≤200 characters in `parents.topics_avoid`).

## Data model (Postgres)

Live (`apps/api/app/db.py`, created/upgraded on first use): `families` (name, context) → `members` (name, relation, phone, city, notes, is_emergency; unique per family + phone) and `parents` (phone PK, `family_id`, profile, `about`, `topics_avoid`, `consent_at`, last call summary) → `calls` (one row per call: status, duration, summary, outputs, failure_reason, source — no transcript; `caller_known=false` for unknown numbers, never used as memory) and `call_attempts` (every call placed, with the exact `agent_variables` sent); `webhook_events` keeps every raw Sarvam delivery (token removed), Try-it reads results from it; `waitlist` separate. The JSONL file (`SARVAM_CALLS_FILE`) is only a fallback while Postgres is down — load it back with `python -m app.import_calls` on kin-api. Managed by the team through `/families` (X-Web-Token) and by families through the app routes `/me/*` (`app/me.py`, `app/routes/me.py`): a SuperTokens user is linked to one `members` row (`user_id`; `role='owner'` for whoever created the family; `email` on a member is an invite, claimed on first sign-in). A family may only attach a parent number that is new to Kin or already theirs. `parents` also has `city`, `call_time` (IST "HH:MM") and `call_length_minutes` and `daily_calls` (bool, default off) for the scheduler; `call_jobs` holds its planned calls (try 0 = evening call, 1–2 = retries). "Ask Kin to call now" in the app: `POST /me/family/parents/{phone}/call` or `POST /me/family/members/{id}/call` (a member becomes a `parents` row of the family on first call, same new-or-ours rule, so their calls and memory stay under their own number; inbound from them is then a known caller, not introduction mode) (`{confirm: true}`, source `app`, one call per number every `APP_CALL_COOLDOWN_S`, `APP_CALLS_PER_DAY` per family) and `GET /me/attempts/{id}` (calling / connected via the on-start hook in `app/live.py` / done + call_id). **Tell my family** (`app/messages.py`, table `family_messages`): a connected call's `message_for_family` (until agent v11: `wants_family_callback` → "Please call me back.") becomes a from_parent message, pushed as "Message from Maa" (only to the named member's phones if `message_to` matches one using the app) and shown on Today until marked done; `GET/POST /me/messages`, `POST /me/messages/{id}/done`. Notes the family writes (to_parent) are added to the next call's `family_context` (max 3, 7 days) and count as delivered after the next answered call. Per-call signal (green/amber/red, same rule as Try-it) and a first family alert (red: urgent or 3 unanswered; amber: 3 of the last 5 answered calls flagged) are computed in `app/me.py`.

Planned next: `medicines`, `call_schedules`, `call_jobs`, `calls`, `call_results`, `memories`, `daily_scores`, `alerts`, `consents`. Field lists are in the final spec doc.

## Backend notes

- Public HTTPS domain needed for `/webhooks/sarvam` and `/hooks/on-start`.
- Sarvam webhooks aren't signed: protect them with a secret token in `webhook_config.metadata.token` (not the URL; query strings end up in access logs).
- Secrets (Sarvam, Claude, auth) live in Coolify env vars, never in the app or repo.
- Turn on Coolify scheduled Postgres backups.

## Costs

- Voice AI: **₹3.50/min, billed per started minute** (confirmed on the first real call, 10 Oct 2026: 2:26 call → 3 units → ₹10.50). Phone line ~₹0.40/min on top.
- Call length is a per-call variable `call_length_minutes` (1 / 3 / 5, default 3); the prompt sizes the turn budget to it (~5 / ~12 / ~20 agent turns). Hard cap `max_interaction_time_seconds: 295` is only a backstop. A 3-minute daily call bills ~₹11–12, ~₹350 per parent per month (30 calls), ~SGD 5.5.
- Number rental (₹59/month launch, ₹159 normally) is shared across all parents.
- Keep at least ₹200 spare in the Sarvam wallet; if it's short on renewal day Sarvam releases the number and cancels deployments.

## Landing page (`apps/web`)

Refero "Bevel" style (https://styles.refero.design/style/c0717d1a-b446-4166-a445-6497fe287fea), light theme, with the Kin app shown in iOS 26 "Liquid Glass" style phone mockups. Previous ElevenLabs-style version archived in `docs/prototypes/web-v1-elevenlabs/`.

### Page structure (`src/app/page.tsx`)

Nav → Hero → Languages → Bento → Features → CallDemo → MoreFeatures → Privacy → Plans → Cta → Footer.

| Section | File | Anchor | Notes |
| --- | --- | --- | --- |
| Nav | `landing/nav.tsx` | — | Floating glass pill: The app, Hear a call, Privacy, Plans + dark "Sign in" pill (→ `/dashboard`). Hides on scroll down, returns on scroll up |
| Hero | `landing/hero.tsx` | `#top` | Headline + 2-line subtitle, CTAs "Get a demo call" (dark WashPill, phone icon → `/try`) / "Hear a call". 3 upright phones: Today (front, 310px), Lock screen (back-left), live Call (back-right, dark) |
| Languages | `landing/languages.tsx` | `#languages` | Supported languages strip |
| Bento | `landing/bento.tsx` | `#app` | 3 cards: Calls, Evening card (lock screen, `notifications="high"`), Trends |
| Features | `landing/features.tsx` | `#features` | Memory and Alerts panels |
| CallDemo | `landing/call-demo.tsx` | `#call` | Dark section, "Hear tonight's call"; `VoiceOrb` wraps the play/pause button. Scripts in `call-scripts.ts`; real audio in `public/audio/call-{hi,ta,en}.mp3` with line cues in `call-audio.ts`, generated once by `apps/api/scripts/generate_call_audio.py` (Sarvam TTS). Re-run it only when the script text changes. |
| MoreFeatures | `landing/more-features.tsx` | `#more` | Bevel mask scroll (see below): intro, medicines (reminder calls, stock, reorder), groceries, family (Tell my family messages), scam shield |
| Privacy | `landing/privacy.tsx` | `#privacy` | 4 points; question-mark and heart-with-beat icons are hand-drawn SVG paths (keep them) |
| Plans | `landing/plans.tsx` | `#plans` | Indian prices only. Families ₹799/month or ₹7,999/year → `#waitlist`; centres ₹349 per senior a month → `#waitlist-centre`; insurers 3-month pilot, then ₹599 per member a month → `#waitlist-insurer` |
| Cta | `landing/cta.tsx` | `#waitlist` | "Be one of the first families" + `WaitlistForm` |
| Footer | `landing/footer.tsx` | — | Brand column, Kin / Trust / Plans link columns, emergency notice card (108 / 995), giant faded "Kin" wordmark, "Built by team Rocket" |

Every button and link goes somewhere: on-page anchors or the waitlist. Smooth scroll via `data-scroll-behavior="smooth"` on `<html>` + CSS `scroll-behavior` (off under `prefers-reduced-motion`). Sections use `scroll-mt-24`.

### Try-it demo (`/try`)

Footer button "Try it out" → `/try`. Password page (`DEMO_PASSWORD`, httpOnly HMAC cookie scoped to `/try`, read behind `<Suspense>` as Cache Components requires; the gate calls `connection()` so runtime-only env vars are never baked in at build). Once unlocked: form (phone, name, family, language Hindi/English, call length 1/3/5 min, medicines, health notes, emergency number, consent tick; collapsible **Family · advanced**: family name, about them, family news, up to 4 members with relation/city/news, topics to avoid — sent straight into that call and saved as a family of its own for that number via `save_own_family`, never shared with another number) → server action `placeDemoCall` → API `POST /demo/calls` with `X-Web-Token` (`WEB_API_TOKEN`) → Sarvam Instant Outbound. The page polls `getDemoCall` every 3 s and shows Call placed → Calling → Connected (the on-start hook fires for outbound calls and marks the number connected; Sarvam reports no ringing) with a timer. Sarvam doesn't stream phone calls, so the evening card (summary, mood, sleep, pain, medicines, callback, language spoken, IST date/time, charge, follow-ups, green/amber/red) appears once the webhook lands. No transcript is shown or kept. Calls placed from the browser are listed under "Recent calls" (localStorage, this browser only). **Demo credit** (Kin's estimate, not the Sarvam wallet): `DEMO_RATE_PER_MIN` (default ₹5) per started minute, budget `DEMO_CREDITS` counted from `DEMO_CREDITS_SINCE`; a call is refused (402) unless the credit left covers its length + 1 minute, unanswered calls cost 0, `GET /demo/credits` feeds the estimate under Call length. Default length is 1 min. Files: `src/app/try/page.tsx`, `src/app/actions/demo.ts`, `src/lib/demo-auth.ts`, `src/components/try/*` (family section: `family-fields.tsx`), `apps/api/app/routes/demo.py`.

### Family dashboard (`/dashboard`)

The app's features on a desktop browser, same SuperTokens email-OTP account ("Sign in" in the nav, footer link). The browser only talks to `src/app/kin-api/[...path]/route.ts`, which forwards `/auth/signinup/*`, `/auth/signout` and `/me/*` to `KIN_API_URL` in header mode and keeps the tokens in httpOnly cookies (`kin_at`, `kin_rt`; refreshed on 401), so the API needs no CORS entry and page scripts never see a token. Client state is `src/lib/kin/kin.tsx` (+ `api.ts`, `data.ts`, `validate.ts`, `theme.ts`), copied from `apps/mobile/src/lib` — keep them in step. Pages: Today, Calls (+ `/calls/[id]`), Trends, Medicines (list, stock, reorder, reminder calls, 30-day calendar, chemist), Groceries (list, usual list, Amazon links, order, kirana), Messages, Family (people, parents, memory), Profile (parent settings, mobile number, topics), Settings (sign out, delete). "Look around" sample family survives a reload (sessionStorage). No pushes on the web: it reloads every minute while visible. Components in `src/components/dashboard/`.

### Impact page (`/impact`)

Public page "Kin so far" (footer link): live totals from `GET /impact` on the API (`app/impact.py`, `X-Web-Token`), fetched server-side on every visit. Totals only, never names, numbers, messages or transcripts: calls answered of placed, answer rate, minutes, languages, answered calls per day for 14 IST days (bar chart with hover and a table view, `components/impact/daily-chart.tsx`), what Kin noticed (calls with pain, missed medicines, low mood, emergency and scam alerts), families, parents, spoken consents, parents calling Kin themselves, messages carried, and how many were Try-it demo calls. Unknown callers are left out.

### Waitlist

- `src/app/actions/waitlist.ts`: server action `joinWaitlist`. Validates name, email, optional phone, city, role (family / centre / insurer), language (families only), consent. Sends the sign-up to the API (`POST /waitlist`, `X-Web-Token`), which upserts it into Postgres table `waitlist` (unique per lower(email) + role; created on first use by `apps/api/app/db.py`). If the API is not configured or unreachable, it appends one JSON line to `WAITLIST_FILE` instead (default `apps/web/data/waitlist.jsonl`, gitignored), so nothing is lost; import later with `python -m app.import_waitlist` on kin-api.
- `landing/waitlist-form.tsx`: client form with `useActionState`; inline errors; values refilled with `defaultValue` (React 19 resets forms after an action); success state "You're on the list, {name}". Clicks on any `#waitlist`, `#waitlist-centre`, `#waitlist-insurer` link scroll to the form, preselect the role and focus the name field.

### App mockups

- `components/app/phone.tsx`: `Phone({ width, tone: "light" | "dark" })`. Screens are designed at 393 × 852 and scaled with CSS `zoom`; the frame `public/art/iphone-frame.webp` (from the rtm-management-platform landing, 979 × 2000) is overlaid on top. Screen opening: left 5.3%, top 2.5%, width 89.4%, height 95%, radius `11.5% / 5.4%`.
- `components/app/kit.tsx`: shared glass UI: Avatar, Rings / Ring (gradient activity rings), Pill, GlassButton, Icon, ScreenHeader (glass "Amma" pill), TabBar (glass capsule with Today / Calls / Trends / Family using the app's own tab icons, active tab blue on a soft bubble, + separate dark phone button, matching `apps/mobile/src/components/tab-bar.tsx`; keep it in step with the app), Card (`glass rounded-[28px] p-[16px]`).
- `components/app/screens.tsx`: TodayScreen, GroceriesScreen, ScamScreen, CallScreen (dark, uses `VoiceOrb`), LockScreen (real iOS lock screen, expanded "Kin" notification group, `notifications="bottom" | "high"`), TrendsScreen (7D/30D/90D, sleep bars, speech line with dashed usual range), MemoryScreen, AlertScreen, MedicinesScreen, FamilyScreen, IntroScreen.
- Cards stay compact: no large empty areas inside cards or phones.
- `/screens` route (`src/app/screens/page.tsx`) is a contact sheet of all 9 screens for design review. Delete it (or hide it) before deploying.

### Motion

- `components/ui/voice-orb.tsx`: `VoiceOrb({ size, active, audio })`. Indigo glass sphere filled with one blended gradient cloud (two blurred conic colour fields turning slowly in opposite directions + a wandering soft light). No pulsing or scaling; with `audio` the light brightens slightly with the voice (Web Audio analyser).
- Bevel mask scroll in `more-features.tsx` (lg and up): each panel has `clip-path: inset(0 round 32px)` and holds a `position: fixed` phone at the same viewport spot, so the next screen slides up inside a phone that seems to stay still. Pure CSS, no scroll listeners. On mobile each panel shows its own phone.
- Keyframes in `globals.css`: breathe, drift, float, marquee, fade-up, kin-orbit, kin-wander. All stop under `prefers-reduced-motion`.

### Design tokens (`src/app/globals.css`)

- Paper `#ffffff` page, Cloud `#ebf0f8` bento cards (no border, no shadow), Mist `#f4f7fb`, Line `#e3e8f0`, Ink `#222326` headings, Body `#747679` copy, Faint `#a3a6ab`, Charcoal `#1f2025` buttons and dark section.
- Inter 400/500/600; display = 600, -0.03em tracking, line-height 1 (`display` utility; 40/56/64/80px). Body 18–24px. Noto Sans Devanagari / Tamil for Indic text.
- Pill buttons only (128px radius): Charcoal fill with Cloud text, or white/Cloud soft (`ui/pill-link.tsx`). Secondary actions "Hear a call" (hero), "Get a demo call" (nav, `tone="dark"`; footer) use `ui/wash-pill.tsx`: white pill + Charcoal icon disc, sky-colour wash rising into the bottom 40% on hover. Cards 24px, panels 32px radius. 80px section rhythm (`ui/section.tsx`).
- Utilities: `glass`, `glass-dark`, `glass-tint` (Liquid Glass approximation with `backdrop-filter`), `mesh-light` (light screen background), `no-scrollbar`.
- Metric colours: tokens gold `#ffca00`, coral `#ffab94`, green `#31ce01`, blue `#415eee`, lilac `#b9a6ff`; the app kit uses deeper variants (lilac `#9d86ff`, coral `#ff8f70`, gold `#ffb800`). Only in product visuals and soft washes, never on buttons or links.
- Status ok / watch / alert (+ `-soft`) only as small markers for the green / amber / red ladder.
- Copy: plain, warm, short. Say "your parent" / "Amma", not jargon. Use "Join the waitlist", not "pilot" CTAs.

### Assets

`public/brand` (kin-mark, kin-logo, app-icon), `public/art` (hero-sky, wash-lilac, wash-sky, night-glow, iphone-frame), `public/avatars` (amma, kamala, joseph, neha, rahul, priya). Favicon `src/app/icon.svg`, OG image `src/app/opengraph-image.png` (static 1200 × 630, screenshotted from the real hero phones; re-shoot it if the hero screens change).

### Deploy checklist

Full Coolify steps: `docs/deploy-coolify.md`. Web and API are separate Coolify apps, each with its own Dockerfile (`apps/web/Dockerfile`, build context = repo root, `output: "standalone"`; `apps/api/Dockerfile`, context = `apps/api`).

- Set `NEXT_PUBLIC_SITE_URL` as a Coolify **build** variable (inlined at build; used for `metadataBase`, share previews).
- Mount a persistent volume at `/data` (image default `WAITLIST_FILE=/data/waitlist.jsonl`).
- Remove `/screens`.

### Working with the user on design

- Change only what was asked. When the user says one thing needs fixing, leave the rest (e.g. privacy icons: only the question mark was changed).
- Earlier "elderly-friendly" app redesign and Phosphor icon tab bar were reverted at the user's request; keep the current glass design.

## Open questions (ask Sarvam)

- Volume pricing below ₹3.50/min?
- Concurrent calls per number?
- Can an agent play a recorded audio clip?
- Call forwarding cost?
- Recording/transcript retention and deletion?
- TRAI NDNC impact on consent-based daily calls?
- Startup or hackathon credits?

## Build order

1. Hindi agent in Sarvam + one Instant Outbound call to own phone, screen-recorded (interview demo).
2. FastAPI on the VPS (Coolify): Postgres, Alembic tables, webhook endpoint storing call results.
3. Claude summary → evening card; basic Expo screen.
4. Onboarding, scheduler worker, retries, push notifications.
5. On-start hook (inbound + introduction), red-alert transfer, family invites.
6. 30-day trends and signal engine, WhatsApp card, more languages.

## Interview

11 Oct 2026, 11:00 am, Panel 7, Microsoft Teams. 3–4 min pitch + 5–8 min Q&A, 3–5 slides. AI assistance during the interview is prohibited. Demo: the landing page call panel (Replay) plus a recorded Sarvam call.
