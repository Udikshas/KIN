"""Shared fixtures for the API tests.

Postgres is real: every test gets a new, empty database. pgserver (pip) runs a
local Postgres, so nothing needs installing; set TEST_DATABASE_URL to use your
own server instead (its user must be allowed to CREATE DATABASE).

Everything outside Kin is faked for every test (autouse), so a test can never
ring a phone, send a push or need a SuperTokens core:
- sessions: the X-Test-User header is the signed-in user (no header -> 401);
- Sarvam: place_outbound records the call instead of placing it (`sarvam`);
- Expo: pushes are recorded instead of sent (`expo`).

Run from apps/api:  pip install -r requirements-dev.txt && pytest
"""

import os
import sys
import tempfile
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path

import psycopg
import pytest
from psycopg.conninfo import make_conninfo

os.environ["STOCK_ALERTS"] = "0"  # no refill-alert thread when app.main is imported

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Sessions are faked before app.routes.me builds its Depends(verify_session()).
import supertokens_python.recipe.session.framework.fastapi as st_fastapi  # noqa: E402
from fastapi import FastAPI, HTTPException, Request  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


class FakeSession:
    def __init__(self, user_id: str):
        self.user_id = user_id

    def get_user_id(self) -> str:
        return self.user_id


def fake_verify_session(*args, **kwargs):
    async def dependency(request: Request):
        user = request.headers.get("x-test-user")
        if not user:
            raise HTTPException(status_code=401)
        return FakeSession(user)

    return dependency


st_fastapi.verify_session = fake_verify_session

from app import db as app_db  # noqa: E402
from app import live, push, reminders, scheduler  # noqa: E402
from app.parents import remember_call  # noqa: E402
from app.routes import demo, hooks, impact, me  # noqa: E402
from app.sarvam_outbound import OutboundError  # noqa: E402


def as_user(user: str) -> dict:
    """Headers for a request made by this signed-in user."""
    return {"x-test-user": user}


# ---- database ------------------------------------------------------------------------------

@pytest.fixture(scope="session")
def pg_server():
    if url := os.getenv("TEST_DATABASE_URL"):
        yield url
        return
    import pgserver

    server = pgserver.get_server(tempfile.mkdtemp(prefix="kin-pg-"), cleanup_mode="stop")
    yield server.get_uri()
    server.cleanup()


def _reset_pool() -> None:
    if app_db._pool is not None:
        app_db._pool.close()
    app_db._pool = None
    app_db._schema_ready = False


@pytest.fixture(autouse=True)
def db(pg_server, monkeypatch):
    """A new database for this test; the app creates its tables on first use."""
    name = f"kin_test_{uuid.uuid4().hex[:12]}"
    with psycopg.connect(pg_server, autocommit=True) as conn:
        conn.execute(f'CREATE DATABASE "{name}"')
    url = make_conninfo(pg_server, dbname=name)
    monkeypatch.setenv("DATABASE_URL", url)
    _reset_pool()
    yield url
    _reset_pool()
    with psycopg.connect(pg_server, autocommit=True) as conn:
        conn.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')


# ---- fakes --------------------------------------------------------------------------------------

@dataclass
class Placed:
    phone: str
    variables: dict
    source: str
    attempt_id: str
    opening: str | None = None  # a custom first line (medicine reminders), as said in Hindi at night


@dataclass
class FakeSarvam:
    """Stands in for Sarvam's Instant Outbound API: records the attempt like the real call would."""

    placed: list[Placed] = field(default_factory=list)
    fail: bool = False
    delay_s: float = 0
    lock: threading.Lock = field(default_factory=threading.Lock)

    def place_outbound(self, phone: str, variables: dict, source: str, opening=None) -> str:
        if self.delay_s:
            time.sleep(self.delay_s)
        if self.fail:
            raise OutboundError("Sarvam returned 500")
        attempt_id = str(uuid.uuid4())
        remember_call(phone, variables, attempt_id, source, sent=variables)
        with self.lock:
            self.placed.append(Placed(phone, variables, source, attempt_id, opening("Hindi", "night", False) if opening else None))
        return attempt_id


@pytest.fixture(autouse=True)
def sarvam(monkeypatch) -> FakeSarvam:
    fake = FakeSarvam()
    for module in (demo, me, scheduler, reminders):
        monkeypatch.setattr(module, "place_outbound", fake.place_outbound)
    return fake


class _Response:
    def __init__(self, data):
        self._data = data

    def json(self):
        return self._data


@dataclass
class FakeExpo:
    """Stands in for the Expo Push API. Tokens in `dead` answer DeviceNotRegistered."""

    sent: list[dict] = field(default_factory=list)
    dead: set[str] = field(default_factory=set)

    def post(self, url, json, headers, timeout):
        assert url == push.EXPO_PUSH_URL
        tickets = []
        for message in json:
            self.sent.append(message)
            if message["to"] in self.dead:
                tickets.append({"status": "error", "message": "gone", "details": {"error": "DeviceNotRegistered"}})
            else:
                tickets.append({"status": "ok", "id": "receipt"})
        return _Response({"data": tickets})


@pytest.fixture(autouse=True)
def expo(monkeypatch) -> FakeExpo:
    fake = FakeExpo()
    monkeypatch.setattr(push.httpx, "post", fake.post)
    # Send inline, so a test sees the push as soon as the webhook is stored.
    monkeypatch.setattr(push, "notify_call_async", push.notify_call)
    return fake


deleted_users: list[str] = []  # SuperTokens users DELETE /me removed (faked)


@pytest.fixture(autouse=True)
def fresh_memory(monkeypatch):
    """In-memory state the API keeps between requests (single uvicorn worker)."""

    class _User:
        def __init__(self, email):
            self.emails = [email]

    async def fake_get_user(user_id, user_context=None):
        return _User(f"{user_id}@example.com")

    async def fake_delete_user(user_id, *args, **kwargs):
        deleted_users.append(user_id)

    deleted_users.clear()
    monkeypatch.setattr(me, "get_user", fake_get_user)
    monkeypatch.setattr(me, "delete_user", fake_delete_user)
    demo._placed.clear()
    demo._attempts.clear()
    demo._last_by_number.clear()
    live.forget()
    yield
    demo._placed.clear()
    demo._attempts.clear()
    demo._last_by_number.clear()
    live.forget()


@pytest.fixture
def client() -> TestClient:
    """The app's routes (/me, /demo, /hooks, /impact) without SuperTokens or the CORS setup of app.main."""
    app = FastAPI()
    app.include_router(me.router)
    app.include_router(impact.router)
    app.include_router(demo.router)
    app.include_router(hooks.router)
    return TestClient(app)
