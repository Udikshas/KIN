import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from supertokens_python import get_all_cors_headers
from supertokens_python.framework.fastapi import get_middleware

from app import insights, scheduler, stock
from app.auth import init_auth
from app.log_redact import redact_access_log
from app.routes import demo, families, hooks, impact, ivr, me, sarvam, waitlist

# Must run before the app is created.
init_auth()
redact_access_log()

app = FastAPI(title="Kin API")
app.add_middleware(get_middleware())
app.include_router(sarvam.router)
app.include_router(demo.router)
app.include_router(waitlist.router)
app.include_router(hooks.router)
app.include_router(families.router)
app.include_router(me.router)
app.include_router(impact.router)
app.include_router(ivr.router)

# Comma-separated list, e.g. "https://kin.example.com,http://localhost:3000"
origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
if origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["Content-Type", *get_all_cors_headers()],
    )


@app.get("/health")
def health() -> dict:
    """Used by the Coolify health check. `scheduler` shows whether daily calls are switched on here."""
    return {"status": "ok", "scheduler": scheduler.enabled()}


# Daily calls (app/scheduler.py): a background thread, only with SCHEDULER_ENABLED=1.
scheduler.start_in_background()
# "What changed" cards for calls from before they existed (app/insights.py).
insights.backfill_in_background()
# Refill alerts when a medicine is running low (app/stock.py); never places a call.
stock.start_in_background()
