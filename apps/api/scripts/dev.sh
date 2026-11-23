#!/usr/bin/env bash
# Run the API locally against the dev stack (docker-compose.dev.yml).
# Loads .env (Sarvam keys etc.), then .env.local, whose values win.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a
[ -f .env ] && . ./.env
[ -f .env.local ] && . ./.env.local
set +a
exec .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port "${PORT:-8000}"
