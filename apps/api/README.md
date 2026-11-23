# Kin API

FastAPI backend (Python), deployed to the VPS with Coolify. The call scheduler
runs inside it (`app/scheduler.py`, on with `SCHEDULER_ENABLED=1`); Postgres is
a separate Coolify database. See `docs/deploy-coolify.md` for settings and
`CLAUDE.md` for how calls, the app routes and push notifications fit together.

## Tests

```bash
cd apps/api
pip install -r requirements-dev.txt
pytest
```

Every test gets a new, empty Postgres database. `pgserver` (installed by
`requirements-dev.txt`) runs one locally, so nothing else needs installing; set
`TEST_DATABASE_URL` to use your own server (its user must be allowed to
`CREATE DATABASE`). Sarvam, Expo push and SuperTokens are always faked
(`tests/conftest.py`), so tests never ring a phone or send a push.

GitHub Actions (`.github/workflows/ci.yml`) runs these tests, the web lint and
the mobile typecheck on every push to `main` and `app-dev` and on pull requests.
