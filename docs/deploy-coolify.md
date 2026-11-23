# Deploy Kin on Coolify

Two separate Coolify applications from the same GitHub repo (`KILLERTIAN/kin`), each built from its own Dockerfile, plus one Postgres database and the SuperTokens auth core.

| Resource | Build context | Dockerfile | Port | Domain (example) |
| --- | --- | --- | --- | --- |
| `kin-web` (Next.js) | repo root `/` | `/apps/web/Dockerfile` | 3000 | `https://kin.example.com` |
| `kin-api` (FastAPI) | `/apps/api` | `/Dockerfile` | 8000 | `https://api.kin.example.com` |
| `kin-postgres` | Coolify database | — | 5432 (internal) | none (private) |
| `kin-supertokens` | Docker image `supertokens/supertokens-postgresql:12.2` | — | 3567 (internal) | none (private) |

The web image needs the repo root as context because pnpm installs from the root `pnpm-lock.yaml`.

## 0. Before you start

1. Push the repo to GitHub (`git push origin main`).
2. In your DNS, add two **A records** pointing at the VPS IP: `kin` and `api.kin` (or whatever names you use).
3. In Coolify: **Sources** → connect GitHub (GitHub App) so Coolify can pull the private repo and auto-deploy on push.

## 1. Postgres

1. Project → **+ New** → **Database** → **PostgreSQL**.
2. Name `kin-postgres`, user `kin`, keep the generated password. Coolify may create only the `postgres` database; the next section creates `kin` and `supertokens`.
3. Leave **Make it publicly available** off.
4. Start it. Copy the **Postgres URL (internal)**, used as `DATABASE_URL` for the API.
5. **Backups** tab → turn on scheduled backups (daily).

## 2. Auth core: `kin-supertokens`

SuperTokens core stores users and sessions; the FastAPI SDK talks to it. Browsers and the app never call it directly.

1. On `kin-postgres` create a separate database for it (Coolify → `kin-postgres` → **Terminal**):

   ```bash
   psql -U kin -d postgres -c "CREATE DATABASE kin;"
   psql -U kin -d postgres -c "CREATE DATABASE supertokens;"
   ```

2. Project → **+ New** → **Docker Image** → `supertokens/supertokens-postgresql:12.2`. Name `kin-supertokens`.
3. **Ports Exposes**: `3567`. **No domain**: delete the pre-filled sslip.io domain (keep it private). **Network aliases**: `supertokens` (General → Networking), so the hostname survives redeploys.
4. **Environment Variables**:

   | Key | Value |
   | --- | --- |
   | `POSTGRESQL_CONNECTION_URI` | internal Postgres URL with `postgresql://` scheme and `/supertokens` as the database, e.g. `postgresql://kin:PASSWORD@<postgres-host>:5432/supertokens` |
   | `API_KEYS` | long random string (`openssl rand -hex 32`); the API uses the same value |

5. **Health Check**: path `/hello`, port `3567` (returns `Hello`).
6. Deploy (the alias only applies on a new deploy). Logs end with `Started SuperTokens on 0.0.0.0:3567`. Check from the `kin-postgres` Terminal: `wget -qO- http://supertokens:3567/hello` → `Hello`. Don't use the timestamped container name; it changes every deploy.

All resources must be in the same Coolify project/environment and server so they share the internal Docker network. If the API can't reach the core, enable **Connect to Predefined Network** on both.

The SDK (`supertokens-python==0.31.3`) and core 12.2 are compatible (driver interface 5.4). Upgrade them together.

## 3. Backend: `kin-api`

1. Project → **+ New** → **Application** → your GitHub repo, branch `main`.
2. **Build Pack**: `Dockerfile`.
3. **Base Directory**: `/apps/api` — **Dockerfile Location**: `/Dockerfile`.
4. **Ports Exposes**: `8000`.
5. **Domains**: `https://api.kin.example.com` (Coolify issues the Let's Encrypt cert).
6. **Environment Variables** (runtime):

   | Key | Value |
   | --- | --- |
   | `DATABASE_URL` | internal Postgres URL from step 1, ending in `/kin` (waitlist table is created automatically) |
   | `CORS_ORIGINS` | `https://kin.example.com` |
   | `SUPERTOKENS_CONNECTION_URI` | `http://supertokens:3567` |
   | `SUPERTOKENS_API_KEY` | same value as `API_KEYS` on the core |
   | `API_DOMAIN` | `https://api.kin.example.com` |
   | `WEBSITE_DOMAIN` | `https://kin.example.com` |
   | `SARVAM_API_KEY`, `ANTHROPIC_API_KEY` | your keys (when the code needs them) |
   | `SARVAM_WEBHOOK_TOKEN` | long random string (`openssl rand -hex 32`) |
   | `SARVAM_APPS_API_KEY`, `SARVAM_ORG_ID`, `SARVAM_WORKSPACE_ID`, `SARVAM_APP_ID`, `SARVAM_CONNECTION_ID`, `SARVAM_AGENT_PHONE` | from apps.sarvam.ai (see `apps/api/.env.example`). The agent version is pinned in code (`AGENT_VERSION` in `apps/api/app/sarvam_outbound.py`); add `SARVAM_APP_VERSION` only to override it for a rollback. |
   | `PUBLIC_API_URL` | `https://api.kin.example.com` |
| `SARVAM_HOOK_TOKEN` | Secret Sarvam sends in `X-Hook-Token` to `/hooks/on-start` (inbound caller lookup). Same value as in the agent's on-start hook header. |
| `WEB_API_TOKEN` | `openssl rand -hex 32`; same value on `kin-web`. Lets the web server call `/waitlist` and `/demo/calls`. Optional: `DEMO_MAX_CALLS_PER_HOUR` (default 10), `DEMO_NUMBER_COOLDOWN_S` (default 180) |
| `EXPO_ACCESS_TOKEN` | Optional. Only if "enhanced push security" is on in the Expo dashboard (push notifications, `app/push.py`). |
| `SCHEDULER_ENABLED` | `1` to place daily calls (a background thread in kin-api, `app/scheduler.py`). Only parents whose family turned **Daily calls** on in the app are called. Leave unset to stop all scheduled calls. |
| `APP_CALL_COOLDOWN_S`, `APP_CALLS_PER_DAY` | Optional. The app's "Ask Kin to call now": seconds before a number can be called again (default 600) and calls per family per day (default 5). |
| `DEMO_RATE_PER_MIN`, `DEMO_CREDITS`, `DEMO_CREDITS_SINCE` | Try-it credit: rupees per started minute (default 5), rupees available for demo calls (e.g. `70`; empty = no limit), and when that amount was loaded (ISO time, e.g. `2026-10-30T00:00:00+05:30`; earlier calls don't count). Raise `DEMO_CREDITS` or move `DEMO_CREDITS_SINCE` after a wallet top-up. |

7. **Health Check**: path `/health`, port `8000`.
   **Persistent Storage**: volume `kin-api-data` → `/app/data` (Sarvam webhook payloads, until Postgres is used).
8. **Watch Paths** (optional, avoids rebuilding API on web-only commits): `apps/api/**`.
9. Deploy. Check:
   - `https://api.kin.example.com/health` → `{"status":"ok"}`
   - `https://api.kin.example.com/me` → `401 unauthorised` (auth is wired)
   - `https://api.kin.example.com/auth/dashboard` → SuperTokens user dashboard (sign in with the API key)

The call scheduler runs inside kin-api when `SCHEDULER_ENABLED=1`. To run it as its own Coolify app instead, use the same Dockerfile with the start command `python -m app.scheduler` (and leave `SCHEDULER_ENABLED` unset on kin-api so only one worker plans; two are still safe, jobs are claimed with row locks).

## 4. Frontend: `kin-web`

1. Project → **+ New** → **Application** → same repo, branch `main`.
2. **Build Pack**: `Dockerfile`.
3. **Base Directory**: `/` — **Dockerfile Location**: `/apps/web/Dockerfile`.
4. **Ports Exposes**: `3000`.
5. **Domains**: `https://kin.example.com`.
6. **Environment Variables**:

   | Key | Value | Build variable? |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SITE_URL` | `https://kin.example.com` | **Yes** (tick "Build Variable"; it is inlined at build time) |
   | `WAITLIST_FILE` | `/data/waitlist.jsonl` (already the image default) | No |

7. **Persistent Storage** → **+ Add** → Volume: name `kin-waitlist`, destination path `/data`. Without this, sign-ups are lost on every redeploy.
   **API link** (waitlist → Postgres, and the Try-it demo): add runtime variables `WEB_API_TOKEN` (same value as on `kin-api`) and `KIN_API_URL=https://api.kin.garcade.in`. Without them, sign-ups fall back to `/data/waitlist.jsonl`.
   **Try-it demo** (`/try`, optional): also add `DEMO_PASSWORD` (what visitors type). Leave it empty to switch the demo off.
8. **Watch Paths** (optional): `apps/web/**` and `pnpm-lock.yaml` (dependency bumps change the lockfile at the root).
9. Deploy and open the domain.

## 5. How login works

- Auth routes live on the API under `/auth` (passwordless email OTP for now): `POST /auth/signinup/code` sends the code, `POST /auth/signinup/code/consume` verifies it and creates a session.
- Protect any route with `Depends(verify_session())` (see `/me` in `apps/api/app/main.py`).
- Expo app: use `supertokens-react-native` with `apiDomain` = the API domain; it uses header-based tokens.
- Phone OTP later: switch to `ContactEmailOrPhoneConfig` in `apps/api/app/auth.py` and add an SMS provider (MSG91 / Twilio) after India DLT registration.
- OTP emails go through SuperTokens' default email service. For production, configure your own SMTP in `email_delivery`.

## 6. After deploy

- Remove or hide the `/screens` design route before sharing the link.
- Read waitlist sign-ups: Coolify → `kin-postgres` → **Terminal** → `psql -U kin -d kin -c "select name, email, phone, city, role, language, created_at from waitlist order by created_at desc;"`
- Sign-ups saved to the fallback file (API was down, or before the API link was set): copy `cat /data/waitlist.jsonl` from `kin-web`, then in `kin-api` → **Terminal** run `python -m app.import_waitlist`, paste, Ctrl-D. Safe to re-run.
- Sarvam webhook URL: `https://api.kin.example.com/webhooks/sarvam`. Send `SARVAM_WEBHOOK_TOKEN` in `webhook_config.metadata.token` (Sarvam echoes it back); never put it in the URL, it would land in logs.

## Test the images locally

```bash
docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_SITE_URL=http://localhost:3000 -t kin-web .
docker run --rm -p 3000:3000 -v kin-waitlist:/data kin-web
docker run -d --name supertokens -p 3567:3567 supertokens/supertokens-postgresql:12.2
docker build -t kin-api apps/api
docker run --rm -p 8000:8000 -e SUPERTOKENS_CONNECTION_URI=http://host.docker.internal:3567 kin-api
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `ERR_PNPM_OUTDATED_LOCKFILE` | Run `pnpm install` locally and commit `pnpm-lock.yaml`. |
| Web returns 502 / Bad Gateway | Ports Exposes must be `3000`; the server listens on `0.0.0.0` (set in the Dockerfile). |
| Share previews point at localhost | `NEXT_PUBLIC_SITE_URL` was not marked as a build variable; redeploy after ticking it. |
| Waitlist write fails (`EACCES`) | Volume mounted somewhere other than `/data`, or `WAITLIST_FILE` changed to a non-writable path. |
| `No SuperTokens core available to query` | `SUPERTOKENS_CONNECTION_URI` wrong or the core is not on the same network; check the internal hostname and port 3567. |
| `Invalid API key` from the core | `SUPERTOKENS_API_KEY` on the API must equal `API_KEYS` on the core. |
| Browser CORS error calling the API | Add the exact web origin (scheme + host, no trailing slash) to `CORS_ORIGINS`. |
