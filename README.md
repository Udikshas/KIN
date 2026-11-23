# Kin

**A daily call that keeps parents who live alone safe.**

Kin phones an elderly parent every evening in the language they speak at home. It asks how they slept, checks they took their medicine, remembers what they said last week, and sends the family one short card about what changed. The parent needs nothing but the phone they already have, landline included.

Built for the Singapore India Hackathon 2026 (Social Innovation and Inclusive Development) by team Rocket.

## Why

- Singapore becomes a super-aged society in 2026, and about 83,000 seniors are expected to live alone by 2030.
- India's population aged 60+ grows from 149 million (2022) to about 347 million by 2050.
- Children living far away hear "I am fine" on every call. Missed medicine and slow declines are noticed only at the hospital.
- Voice AI works well in English and poorly in Indian languages. Kin starts where that gap is largest.

## How it works

1. The family installs the Kin app, adds a parent (language, call time, medicines, health notes) and introduces Kin on a merged phone call.
2. Every evening Kin calls the parent for 2–4 minutes: wellbeing, medicine, and one thing from earlier calls.
3. After the call, Kin compares the answers with the parent's own last 30 days.
4. The family gets an evening card. Trends over several days raise an amber alert; an emergency or three days with no answer raises red, and Kin connects the parent to a family member.

## Architecture

```
Kin app (Expo) ──► FastAPI backend (VPS, Coolify) ◄──► Claude API
                     │  scheduler · webhooks · Postgres
                     ▼
              Sarvam Voice Agents ──► parent's phone
              (speech-to-text, LLM, voice, phone number)
```

| Part | Technology |
| --- | --- |
| Live call | Sarvam Voice Agents: Saaras v4 speech-to-text, Sarvam-105B LLM, Bulbul voice, Sarvam-rented Indian number |
| Starting calls | Sarvam Instant Outbound API, triggered by Kin's scheduler |
| After the call | Claude API: evening card, memory, 30-day trends |
| Backend | FastAPI, Postgres, self-hosted with Coolify |
| Family app | Expo (React Native), Firebase phone sign-in, Expo push |
| Landing page | Next.js 16, Tailwind CSS 4 |

Languages at launch: Hindi, then Tamil, Malayalam, Bengali and English.

## Repository

| Path | What | Status |
| --- | --- | --- |
| `apps/web` | Landing page | Built |
| `apps/api` | FastAPI backend | Live |
| `apps/mobile` | Family app (Expo) | Built, sample data |
| `packages/` | Shared code | Later |
| `docs/prototypes/` | Original HTML landing prototype | Reference |

## Run locally

Requires Node 22+ and pnpm 10.

```bash
pnpm install
pnpm dev:web
```

The landing page runs at http://localhost:3000.

## Project documents

- [Final project spec](https://claude.ai/code/artifact/5cabbd8b-4398-4dba-8075-e719c27a90b9): locked decisions, call flow, agent spec, data model, costs, build order
- [Build plan and stack research](https://claude.ai/code/artifact/46c770cc-db01-4d77-ade7-d4f5834d6b25): earlier research; stack superseded by the spec
- [HTML landing prototype](https://claude.ai/artifact/Qb84aysPQ7jCWi6Lvj3qDK)
- [Design reference: Refero ElevenLabs style](https://styles.refero.design/style/031056ff-7af1-46db-8daa-115f731c5d26)

The project documents are private links; ask the owner for access.

## Safety

Kin is a wellbeing check-in, not a medical device or an emergency service. In an emergency call 108 in India or 995 in Singapore.
