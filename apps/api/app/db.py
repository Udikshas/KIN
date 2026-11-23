"""Postgres access (psycopg 3 + a small connection pool).

DATABASE_URL is the internal Coolify URL, e.g. postgres://kin:...@<host>:5432/kin.
Tables are created on first use with CREATE TABLE IF NOT EXISTS (new columns
with ADD COLUMN IF NOT EXISTS); move to Alembic migrations once the schema
settles.
"""

import os
import threading

from psycopg_pool import ConnectionPool

SCHEMA = """
CREATE TABLE IF NOT EXISTS waitlist (
    id          bigserial PRIMARY KEY,
    name        text        NOT NULL,
    email       text        NOT NULL,
    phone       text,
    city        text,
    role        text        NOT NULL,
    language    text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
-- One row per person and role; signing up again updates the details.
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_role ON waitlist (lower(email), role);

-- A family: the people who look after one or more parents. `context` is
-- family-wide background Kin may bring up warmly (a wedding coming up, a
-- grandchild's exams), shared by every parent in the family.
CREATE TABLE IF NOT EXISTS families (
    id          bigserial PRIMARY KEY,
    name        text        NOT NULL,
    context     text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Children and other relatives, each with their own number. Kin mentions them
-- by name and relation, never by number. is_emergency marks who a red alert
-- is transferred to when the parent has no emergency_number of their own.
CREATE TABLE IF NOT EXISTS members (
    id            bigserial PRIMARY KEY,
    family_id     bigint      NOT NULL REFERENCES families (id) ON DELETE CASCADE,
    name          text        NOT NULL,
    relation      text,
    phone         text,
    city          text,
    notes         text,
    is_emergency  boolean     NOT NULL DEFAULT false,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
-- One number per family (the same person may belong to two families, e.g. in-laws).
CREATE UNIQUE INDEX IF NOT EXISTS members_family_phone ON members (family_id, phone);
CREATE INDEX IF NOT EXISTS members_phone ON members (phone);
-- 'demo' for families typed into Try-it; Try-it may only ever change those.
ALTER TABLE families ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app';

-- Who Kin talks to, keyed by E.164 phone. Filled whenever Kin places a call,
-- read by the on-start hook so inbound callers are greeted by name.
CREATE TABLE IF NOT EXISTS parents (
    phone             text PRIMARY KEY,
    parent_name       text NOT NULL,
    family_name       text,
    language          text,
    medicines         text,
    health_notes      text,
    emergency_number  text,
    last_call_summary text,
    last_call_at      timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);
-- Added with families; ADD COLUMN IF NOT EXISTS upgrades older databases in place.
-- about: per-person context (routine, likes, how they like to be spoken to).
ALTER TABLE parents ADD COLUMN IF NOT EXISTS family_id bigint REFERENCES families (id) ON DELETE SET NULL;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS about text;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS topics_avoid text;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS consent_at timestamptz;
CREATE INDEX IF NOT EXISTS parents_family ON parents (family_id);

-- Every finished call (outbound or inbound), so the next call has real context.
CREATE TABLE IF NOT EXISTS calls (
    id              bigserial PRIMARY KEY,
    phone           text NOT NULL,
    direction       text NOT NULL,
    attempt_id      text,
    interaction_id  text,
    status          text,
    duration_s      integer,
    summary         text,
    outputs         jsonb NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS calls_phone_created ON calls (phone, created_at DESC);
-- Sarvam retries webhook deliveries; one row per interaction (or attempt, if never connected).
CREATE UNIQUE INDEX IF NOT EXISTS calls_dedupe ON calls ((coalesce(interaction_id, attempt_id)));

-- Added later: how the call ended. caller_known is false for calls from
-- numbers Kin doesn't know: kept, but never used as memory.
ALTER TABLE calls ADD COLUMN IF NOT EXISTS failure_reason text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS caller_known boolean NOT NULL DEFAULT true;

-- Every call Kin places: number, who placed it and the exact variables sent.
-- Outbound webhooks carry the attempt_id but not the number; this maps them back.
CREATE TABLE IF NOT EXISTS call_attempts (
    attempt_id  text PRIMARY KEY,
    phone       text NOT NULL,
    source      text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE call_attempts ADD COLUMN IF NOT EXISTS agent_variables jsonb;

-- Every webhook delivery from Sarvam, as received (the secret token removed),
-- including unknown callers and calls that never connected. The raw record
-- behind `calls`, and what Try-it reads results from.
CREATE TABLE IF NOT EXISTS webhook_events (
    id              bigserial PRIMARY KEY,
    received_at     timestamptz NOT NULL DEFAULT now(),
    kind            text NOT NULL,
    source          text,
    attempt_id      text,
    interaction_id  text,
    phone           text,
    status          text,
    payload         jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS webhook_events_attempt ON webhook_events (attempt_id);
CREATE INDEX IF NOT EXISTS webhook_events_phone ON webhook_events (phone, received_at DESC);

-- Kin keeps the summary and results, never the conversation word for word:
-- remove transcripts stored before that (calls.transcript, raw webhook payloads).
ALTER TABLE calls DROP COLUMN IF EXISTS transcript;
UPDATE webhook_events SET payload = payload - 'interaction_transcript' WHERE payload ? 'interaction_transcript';

-- The Kin app: a signed-in SuperTokens user is a member of a family.
-- user_id is set when they create the family, or when they first sign in with
-- the email a family member added for them (an invite). role 'owner' = created it.
ALTER TABLE members ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS role text;
CREATE INDEX IF NOT EXISTS members_user ON members (user_id);
CREATE INDEX IF NOT EXISTS members_email ON members (lower(email)) WHERE user_id IS NULL;

-- App settings per parent. The scheduler (app/scheduler.py) calls a parent
-- every day at call_time (IST, "HH:MM") for call_length_minutes, but only once
-- the family has switched daily_calls on.
ALTER TABLE parents ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS call_time text;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS call_length_minutes integer;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS daily_calls boolean NOT NULL DEFAULT false;

-- Picture the family chose in the app (a built-in avatar key, e.g. "nani").
ALTER TABLE parents ADD COLUMN IF NOT EXISTS avatar text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar text;

-- One row per call the scheduler means to place: the evening call (try 0) and
-- up to two retries after no answer. Unique per number, IST day and try, so two
-- workers (or two containers during a deploy) can never place the same call twice.
CREATE TABLE IF NOT EXISTS call_jobs (
    id          bigserial PRIMARY KEY,
    phone       text NOT NULL,
    day         date NOT NULL,
    try         integer NOT NULL DEFAULT 0,
    due_at      timestamptz NOT NULL,
    status      text NOT NULL DEFAULT 'pending',  -- pending, placing, placed, skipped, failed
    attempt_id  text,
    note        text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (phone, day, try)
);
CREATE INDEX IF NOT EXISTS call_jobs_due ON call_jobs (status, due_at);

-- Expo push tokens of signed-in family members' phones (app/push.py sends the
-- evening card and alerts to every token of the parent's family).
CREATE TABLE IF NOT EXISTS push_tokens (
    token       text PRIMARY KEY,
    user_id     text NOT NULL,
    family_id   bigint REFERENCES families (id) ON DELETE CASCADE,
    platform    text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_tokens_family ON push_tokens (family_id);
-- When the family was told about this call; Sarvam retries webhooks, a call is pushed once.
ALTER TABLE calls ADD COLUMN IF NOT EXISTS notified_at timestamptz;

-- "Tell my family": messages between a parent and the family (app/messages.py).
-- from_parent: said on a call (one per call); done_at = someone in the family dealt with it.
-- to_parent: written in the app; Kin passes it on during the next call (delivered_at).
CREATE TABLE IF NOT EXISTS family_messages (
    id              bigserial PRIMARY KEY,
    family_id       bigint NOT NULL REFERENCES families (id) ON DELETE CASCADE,
    phone           text NOT NULL,
    direction       text NOT NULL,
    text            text NOT NULL,
    to_name         text,
    from_member_id  bigint REFERENCES members (id) ON DELETE SET NULL,
    call_id         bigint,
    reply_to        bigint REFERENCES family_messages (id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    done_at         timestamptz,
    done_by         bigint REFERENCES members (id) ON DELETE SET NULL,
    delivered_at    timestamptz
);
CREATE INDEX IF NOT EXISTS family_messages_family ON family_messages (family_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS family_messages_call ON family_messages (call_id) WHERE direction = 'from_parent';

-- Emergencies Kin heard during a call (the agent's flag_urgent tool -> POST /hooks/urgent).
-- The family is pushed at once; handled_at = someone in the family dealt with it.
CREATE TABLE IF NOT EXISTS urgent_events (
    id          bigserial PRIMARY KEY,
    phone       text NOT NULL,
    family_id   bigint REFERENCES families (id) ON DELETE CASCADE,
    reason      text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    handled_at  timestamptz,
    handled_by  bigint REFERENCES members (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS urgent_events_phone ON urgent_events (phone, created_at DESC);
-- 'urgent' (flag_urgent: a fall, chest pain) or 'scam' (flag_scam: the parent describes a
-- caller asking for an OTP, PIN, money or remote access). Same banner, different colour.
ALTER TABLE urgent_events ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'urgent';

-- What changed on this call against the parent's own usual (app/insights.py):
-- {"headline", "changes": [...], "suggestion"}, written when the webhook lands.
ALTER TABLE calls ADD COLUMN IF NOT EXISTS insight jsonb;

-- Medicine reminder calls (app/reminders.py): a short call at tablet time. One row
-- per reminder ("HH:MM" IST, which medicines); med_jobs holds each day's call and
-- one retry, with what came of it (taken / not_taken / unclear / no_answer).
CREATE TABLE IF NOT EXISTS med_reminders (
    id          bigserial PRIMARY KEY,
    phone       text NOT NULL REFERENCES parents (phone) ON DELETE CASCADE,
    time        text NOT NULL,
    medicines   text NOT NULL,
    enabled     boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS med_reminders_phone ON med_reminders (phone);
CREATE TABLE IF NOT EXISTS med_jobs (
    id           bigserial PRIMARY KEY,
    reminder_id  bigint NOT NULL REFERENCES med_reminders (id) ON DELETE CASCADE,
    phone        text NOT NULL,
    day          date NOT NULL,
    try          integer NOT NULL DEFAULT 0,
    due_at       timestamptz NOT NULL,
    status       text NOT NULL DEFAULT 'pending',  -- pending, placing, placed, skipped, failed
    attempt_id   text,
    outcome      text,                             -- taken, not_taken, unclear, no_answer
    note         text,
    notified_at  timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (reminder_id, day, try)
);
CREATE INDEX IF NOT EXISTS med_jobs_due ON med_jobs (status, due_at);
CREATE INDEX IF NOT EXISTS med_jobs_attempt ON med_jobs (attempt_id);

-- Medicine stock (app/stock.py): per medicine of a parent, how many tablets were at
-- home at stock_at and how many a day they take; what is left is worked out from
-- that. refill_alert_at = the family was told it is running low (cleared on restock).
-- chemist_phone: the local chemist's WhatsApp, for the app's Reorder sheet.
CREATE TABLE IF NOT EXISTS medicine_stock (
    id               bigserial PRIMARY KEY,
    phone            text NOT NULL REFERENCES parents (phone) ON DELETE CASCADE,
    name             text NOT NULL,
    per_day          real NOT NULL DEFAULT 1,
    pack_size        integer NOT NULL DEFAULT 10,
    stock            real NOT NULL DEFAULT 0,
    stock_at         timestamptz NOT NULL DEFAULT now(),
    refill_alert_at  timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS medicine_stock_name ON medicine_stock (phone, lower(name));
ALTER TABLE parents ADD COLUMN IF NOT EXISTS chemist_phone text;
-- A medicine prescribed for a set time (an antibiotic for 5 days): the last IST day of
-- the course. NULL = ongoing. Refill alerts and reorder amounts never go past it.
ALTER TABLE medicine_stock ADD COLUMN IF NOT EXISTS course_ends_on date;

-- Monthly groceries (app/groceries.py): what the parent's home needs, how often
-- (every_days, 30 = monthly) and when it was last bought. kirana_phone = the local
-- shop's WhatsApp for one order; groceries_alerted_on = last "groceries due" push.
CREATE TABLE IF NOT EXISTS grocery_items (
    id              bigserial PRIMARY KEY,
    phone           text NOT NULL REFERENCES parents (phone) ON DELETE CASCADE,
    name            text NOT NULL,
    qty             text,
    every_days      integer NOT NULL DEFAULT 30,
    last_bought_on  date,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS grocery_items_name ON grocery_items (phone, lower(name));
ALTER TABLE parents ADD COLUMN IF NOT EXISTS kirana_phone text;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS groceries_alerted_on date;
-- The item's product on Amazon (ASIN), saved once, for one "add all to cart" link.
ALTER TABLE grocery_items ADD COLUMN IF NOT EXISTS amazon_asin text;
-- Each medicine's product on Amazon (its ASIN), saved once by the family, so the app's
-- Reorder can put every medicine that is running low into one Amazon cart in one tap.
CREATE TABLE IF NOT EXISTS medicine_products (
    id           bigserial PRIMARY KEY,
    phone        text NOT NULL REFERENCES parents (phone) ON DELETE CASCADE,
    name         text NOT NULL,
    amazon_asin  text NOT NULL,
    updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS medicine_products_name ON medicine_products (phone, lower(name));

-- Reminder calls without the AI (app/ivr.py, Vobiz): the spoken clips, made once
-- with Sarvam text-to-speech and served to Vobiz, and one row per call placed
-- (token = the secret in its callback URLs, digits = what the parent pressed).
CREATE TABLE IF NOT EXISTS ivr_audio (
    key         text PRIMARY KEY,
    language    text NOT NULL,
    text        text NOT NULL,
    audio       bytea NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ivr_calls (
    token        text PRIMARY KEY,
    job_id       bigint REFERENCES med_jobs (id) ON DELETE CASCADE,
    phone        text NOT NULL,
    attempt_id   text,
    clips        jsonb NOT NULL,
    digits       text,
    prompts      integer NOT NULL DEFAULT 0,
    finished_at  timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ivr_calls_attempt ON ivr_calls (attempt_id);
"""

_pool: ConnectionPool | None = None
_lock = threading.Lock()
_schema_ready = False


class DatabaseNotConfigured(RuntimeError):
    pass


def pool() -> ConnectionPool:
    """Opens the pool on first use, so the API still starts if Postgres is down."""
    global _pool, _schema_ready
    with _lock:
        if _pool is None:
            url = os.getenv("DATABASE_URL", "")
            if not url:
                raise DatabaseNotConfigured("DATABASE_URL is not set")
            _pool = ConnectionPool(url, min_size=0, max_size=4, timeout=10, open=True)
        if not _schema_ready:
            with _pool.connection() as conn:
                conn.execute(SCHEMA)
            _schema_ready = True
    return _pool
