# Kin Mobile

The family app, built with Expo SDK 58 and Expo Router, and written in TypeScript. It turns the glass mockups in `apps/web/src/components/app/` into real screens.

## Run

From the repo root:

```bash
pnpm install
pnpm dev:mobile        # Expo dev server: press a (Android), i (iOS) or w (web)
pnpm --filter mobile lint   # typecheck
```

Scan the QR code with Expo Go, or press `w` to open it in the browser. To use a different backend, set `EXPO_PUBLIC_API_URL`. The default is `https://api.kin.garcade.in` (set in `app.json` → `extra.apiUrl`).

## Screens (`src/app`)

| Route | Screen |
| --- | --- |
| `sign-in` | Sign in with an emailed code (SuperTokens passwordless, header tokens kept in SecureStore), or **Look around with a sample family** |
| `(tabs)/index` | Today: the evening card (rings, tonight's call, watch/asked tiles, tomorrow's topic, this week) |
| `(tabs)/calls` | Tonight's question and the recent calls |
| `(tabs)/trends` | 7D / 30D / 90D toggle; medicine, sleep and answered rings; sleep bars; speech rate |
| `(tabs)/family` | Family circle, medicines, introduce Kin, emergency contact, Kin's number |
| `calls/[id]` | One call: summary, outputs, what changed (no transcript: Kin never keeps one) |
| `call` | Dark call screen (phone button in the tab bar): call the parent, read the last call |
| `alert` | Amber/red alert, with its evidence and what to ask |
| `memory`, `medicines`, `introduce` | Memory, medicines (add/remove), introduction call steps |
| `parent`, `member`, `settings` | Edit the parent's profile and call settings; add a family member, or (`member?id=`, from a tap on the Family tab) edit, call or remove one; account settings |

Shared UI is in `src/components/kit.tsx`, a port of the web `kit.tsx`. The custom glass tab bar is in `src/components/tab-bar.tsx`, and the tokens are in `src/lib/theme.ts`.

## Data

Signed in, everything comes from the API's app routes (`apps/api/app/routes/me.py`, behind `verify_session()`):

- `GET /me/family` returns the family, its members and its parents. Each parent includes the open threads Kin will follow up on and the current alert.
- `GET /me/calls` lists the calls. `GET /me/calls/{id}` returns one call (summary and outputs).
- Saving the parent profile, medicines and members writes through the API. The family reloads after each save; pull down on any screen to reload too.
- **Emergency banner** (`src/components/urgent-banner.tsx`, on Today and the Alert screen): when Kin flags an emergency mid-call, a red card with what Kin heard, **Call {parent}**, **Call {emergency contact}** (or 108) and **It's handled**. A **scam warning** (Kin's `flag_scam`) is the same card in amber: what the parent told Kin, **Call {parent}**, **Call 1930** (cyber crime helpline), **All fine, nothing was shared**.
- **What changed** (`src/components/insight-card.tsx`, on Today and the call screen): the evening card worked out on the server from the parent's own last 30 days (no paid AI): headline, up to 3 changes and a "Try this". Trends shows the 30-day note ("Kin noticed") and a mood and pain strip. **Share** (Today's share icon, "Share with the family" on a call) sends the card as text to WhatsApp or anywhere.
- **Medicine streak and calendar** (`src/components/medicine-calendar.tsx`, top of Medicines): "13 days in a row", best run, and the last 30 days, Monday-first, one mark per day (✓ taken, ✕ not taken, – no answer, ½ partly); tap a day to see each reminder or call.
- **Stock and reorder** (`src/components/stock-sheet.tsx`, tap a medicine on Medicines): tablets a day, strip size and count at home; "3 tablets left · runs out Tue" on each medicine; +1/+2/+3 strips when bought; Reorder via the chemist's WhatsApp (order written out) or Tata 1mg, PharmEasy, Apollo 24|7, Blinkit. Today shows "Amlodipine: 3 days left · Reorder" when one is low, and a refill push arrives at about 5 days left.
- **Groceries** (`src/app/groceries.tsx`, `src/components/grocery-order.tsx`, Family → Groceries): a monthly list for the parent's home ("Add the usual list" to start), each item with a quantity and how often (weekly … every 2 months); due items first with **Order** and **Bought all** at the top; the order sheet puts every due item into **one Amazon cart in one tap** (each item's Amazon link saved once), sends one WhatsApp to the kirana, or walks through Blinkit / Zepto / BigBasket / Instamart (which can't be filled from outside) for one cart; Today shows "Groceries due · Order".
- **Courses and Restock all** (Medicines): when counting a medicine choose **Prescribed for** Ongoing / 3 / 5 / 7 / 10 / 14 days; a course shows "enough to finish the course" and is never suggested past its end. **Reorder** and **Restock all** sit at the top of Medicines; Restock all (after a confirm) adds each low medicine's suggested strips in one go.
- **Reorder several at once** (`src/components/reorder-all.tsx`, "Reorder running low" on Medicines, or Today's Reorder): running-low medicines ticked with about a month of strips; **Add all to the Amazon cart** in one tap once each medicine's Amazon link is saved (paste a product or share link once); one WhatsApp message to the chemist with the whole list, or a guided pass through Tata 1mg / PharmEasy / Apollo 24|7 / Blinkit that adds each to the same cart in that app (they don't let other apps fill a cart, so one checkout is the best a link can do), share or copy the list, and "Bought them?" to add all the strips to stock.
- **Reminder calls** (`src/components/reminder-calls.tsx`, on the Medicines screen): up to 4 a day, each a time and which medicines, with today's result (Taken / Not taken / No answer) and an on/off switch. Adding one before the parent has said yes asks "Does Maa know?" first.
- **Messages** (`src/app/messages.tsx`, "All messages" under Tell my family on Today): every message both ways, filter All / From / To the parent, with Reply and Done.
- **Daily calls consent** (`src/app/parent.tsx`): switching Daily calls on before the parent has said yes asks "Does Maa know?" first.
- **Delete my account** (Settings): the owner deletes the family and all its data; anyone else leaves the family (`DELETE /me`).
- **Tell my family** (`src/components/family-messages.tsx`, on Today): what the parent asked Kin to pass on during a call, with **Reply** and **Done**, and **Send {parent} a message**; Kin passes the family's notes on during the next call. Free-form messages from the parent need the Sarvam agent's `message_for_family` output (agent v11, see CLAUDE.md); until then a call-back request shows as "Please call me back."
- **Read aloud** (`src/lib/speech.ts`, call screen): **Listen** reads the summary and what changed. It uses the phone's own voices (`expo-speech`, AVSpeechSynthesizer on iOS, the same engine as ReadIt's device narrator): free, offline, nothing leaves the phone. The best installed voice for the call's language comes first (Enhanced voices before standard), Kin and the parent get different voices (or the same voice at a lower pitch), and with no voice for that language it reads the English. `expo-audio` sets `playsInSilentMode`, so it is heard with the silent switch on. Works in Expo Go; an installed dev or store build needs a new build (new native modules).
- **Push notifications** (`src/lib/push.ts`): after the family loads, the phone asks for permission and registers its Expo push token (`POST /me/push-tokens`; removed on sign-out). A push reloads the family; tapping one opens the call, the alert or the call screen. iOS works in Expo Go; Android needs the APK with FCM credentials set up in EAS (`npx eas-cli credentials`).
- **Daily-call status** on Today (from `daily` in `GET /me/family`): next call, calling, retrying at…, spoke with them, didn't answer after 3 tries.
- **Daily calls** (parent settings): a switch, off by default. On, the API's scheduler rings the parent every evening at their call time and retries twice after no answer; Today, Calls, the call screen and settings say whether it's on.
- **Ask Kin to call now** (Today, and the call screen): pick the parent or any family member with a phone (a list when there is more than one), confirm, and `POST /me/family/parents/{phone}/call` or `POST /me/family/members/{id}/call` places a real Sarvam call (a member called this way gets their own Kin profile, so their calls never mix into the parent's); the app polls `GET /me/attempts/{id}` (calling → connected → done) and opens the new call when it ends. The API allows one call per number every 10 min (and none while one is under way) and 5 per family per day. Sample mode offers sign-in instead. The live state is in `src/lib/kin.tsx`, the UI in `src/components/kin-call.tsx`.

`src/lib/api.ts` turns those rows into the screens' `Family` shape. A new account with no family goes to `setup`, which creates one with the user as owner.

An account can join an existing family through an invite. A family member adds someone with an email, from the app or from the admin `/families` routes. The first time that email signs in, the member row is linked to the account. The API refuses to attach a parent number that already has calls or belongs to another family, because that would expose their call summaries.

"Look around with a sample family" uses `sampleFamily` in `src/lib/data.ts`. In that mode, edits stay in memory.

## Not built yet

- One parent per family in the app (the API supports several; the app shows the first).
- Sleep is the agent's 1–5 score (no hours) and speech rate isn't measured yet, so the real Trends tab shows medicine, sleep and answered calls only.
- Recorded voice notes for the family.
- Store builds. Profiles are in `eas.json`: `npx eas-cli@latest build -p android --profile preview` gives an installable APK for testers, and `--profile production` gives the store build. There are no `ios/` or `android/` folders, because Expo generates them.
