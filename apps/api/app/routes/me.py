"""The Kin app's API: everything the signed-in user sees and changes.

Every route needs a SuperTokens session (header tokens from the Expo app).
A user only reaches their own family; see app.me for how users join one.

    GET    /me                       who is signed in, and their family (or null)
    POST   /me/family                create a family with yourself as owner and a first parent
    GET    /me/family                family + members + parents (with open threads and alert)
    PATCH  /me/family                {name?, context?}
    PUT    /me/family/parents/{phone}   add or update a parent
    POST   /me/family/members        add someone (an email makes it an invite)
    PATCH  /me/family/members/{id}
    DELETE /me/family/members/{id}
    GET    /me/calls?phone=&days=    recent calls, newest first
    GET    /me/calls/{id}            one call (summary and results; transcripts are never kept)
    POST   /me/family/parents/{phone}/call   {confirm: true}: Kin rings the parent now
    POST   /me/family/members/{id}/call      {confirm: true}: Kin checks in on a family member now
                                     (they become someone Kin calls, with their own calls and memory)
    GET    /me/attempts/{attempt_id} that call: calling / connected / done (+ call_id) / timeout
    GET    /me/messages              "tell my family": messages from and to the parents, newest first
    POST   /me/messages              {text, reply_to?, phone?}: Kin passes it on during the next call
    POST   /me/messages/{id}/done    someone dealt with the parent's message
    POST   /me/urgent/{id}/handled   an emergency Kin flagged during a call was dealt with
    POST   /me/push-tokens           {token, platform}: this phone gets the family's pushes
    POST   /me/push-test             send a sample evening-card push to the caller's own phones
    DELETE /me/push-tokens           {token}: stop (on sign-out)

"Call now" places a real Sarvam call that costs wallet credit, so it needs an
explicit confirm, waits APP_CALL_COOLDOWN_S after any call Kin placed to that
number (and while one is still under way), and allows APP_CALLS_PER_DAY per
family per day (India time).
"""

import os
import threading
import time
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from psycopg.errors import UniqueViolation
from pydantic import BaseModel, Field, field_validator
from supertokens_python.asyncio import delete_user, get_user
from supertokens_python.recipe.session import SessionContainer
from supertokens_python.recipe.session.framework.fastapi import verify_session

from app import me as db
from app import groceries, insights, messages, reminders, stock, urgent
from app.greetings import GREETINGS
from app.live import connected_since
from app.parents import ProfileError, normalize_phone
from app.sarvam_outbound import OutboundError, missing_config, place_outbound

router = APIRouter(prefix="/me")

APP_SOURCE = "app"  # call_attempts.source / webhook metadata for calls asked for in the app
CALL_COOLDOWN_S = int(os.getenv("APP_CALL_COOLDOWN_S", "600"))
CALLS_PER_DAY = int(os.getenv("APP_CALLS_PER_DAY", "5"))
# A call with no result after this long is over (Sarvam caps calls just under 5 min).
CALL_TIMEOUT_S = 8 * 60
# Routes run checks and the Sarvam request in a thread; one at a time, so a double tap can't place two calls.
_call_lock = threading.Lock()

Language = Literal[tuple(GREETINGS)]
EMAIL = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
AVATAR = r"^[a-z]{1,20}$"  # a built-in picture key from the app (apps/mobile/assets/avatars)


class _In(BaseModel):
    """Trims text (blank -> None) and normalises phone fields to E.164."""

    @field_validator("*", mode="before")
    @classmethod
    def _strip(cls, v):
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v

    @field_validator("phone", "emergency_number", "chemist_phone", "kirana_phone", check_fields=False)
    @classmethod
    def _e164(cls, v: str | None) -> str | None:
        if v is None:
            return None
        phone = normalize_phone(v)
        if not phone:
            raise ValueError("use international format, e.g. +919876543210")
        return phone


class ParentIn(_In):
    parent_name: str = Field(min_length=1, max_length=40)
    family_name: str | None = Field(default=None, max_length=40)
    language: Language | None = None
    medicines: str | None = Field(default=None, max_length=300)
    health_notes: str | None = Field(default=None, max_length=300)
    emergency_number: str | None = None
    about: str | None = Field(default=None, max_length=500)
    topics_avoid: str | None = Field(default=None, max_length=200)
    city: str | None = Field(default=None, max_length=60)
    call_time: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    call_length_minutes: Literal[1, 3, 5] | None = None
    daily_calls: bool | None = None  # Kin calls every day at call_time (app/scheduler.py)
    avatar: str | None = Field(default=None, pattern=AVATAR)
    chemist_phone: str | None = None  # the local chemist's WhatsApp, for Reorder
    kirana_phone: str | None = None  # the local grocery shop's WhatsApp, for groceries


class MeIn(_In):
    name: str = Field(min_length=1, max_length=40)
    relation: str | None = Field(default=None, max_length=40)
    phone: str | None = None
    city: str | None = Field(default=None, max_length=60)


class FamilyCreate(_In):
    name: str = Field(min_length=1, max_length=60)
    me: MeIn
    parent_phone: str
    parent: ParentIn

    @field_validator("parent_phone")
    @classmethod
    def _parent_e164(cls, v: str) -> str:
        phone = normalize_phone(v)
        if not phone:
            raise ValueError("use international format, e.g. +919876543210")
        return phone


class FamilyPatch(_In):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    context: str | None = Field(default=None, max_length=500)


class MemberIn(_In):
    name: str = Field(min_length=1, max_length=40)
    relation: str | None = Field(default=None, max_length=40)
    phone: str | None = None
    city: str | None = Field(default=None, max_length=60)
    notes: str | None = Field(default=None, max_length=300)
    is_emergency: bool = False
    email: str | None = Field(default=None, max_length=120, pattern=EMAIL)
    avatar: str | None = Field(default=None, pattern=AVATAR)


class MemberPatch(_In):
    name: str | None = Field(default=None, min_length=1, max_length=40)
    relation: str | None = Field(default=None, max_length=40)
    phone: str | None = None
    city: str | None = Field(default=None, max_length=60)
    notes: str | None = Field(default=None, max_length=300)
    is_emergency: bool | None = None
    email: str | None = Field(default=None, max_length=120, pattern=EMAIL)
    avatar: str | None = Field(default=None, pattern=AVATAR)


async def _db(fn, *args):
    """psycopg is sync: run in a thread, and turn database errors into HTTP errors."""
    try:
        return await run_in_threadpool(fn, *args)
    except db.NotAllowed as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ProfileError as e:
        if isinstance(e.__cause__, UniqueViolation):
            raise HTTPException(status_code=409, detail="That number is already in this family")
        print(f"me: {e}")
        raise HTTPException(status_code=503, detail="Database unavailable")


async def _email(user_id: str) -> str | None:
    user = await get_user(user_id)
    return user.emails[0] if user and user.emails else None


async def _member(s: SessionContainer) -> dict:
    """The signed-in user's member row; 404 until they create or join a family."""
    user_id = s.get_user_id()
    row = await _db(db.membership, user_id, await _email(user_id))
    if not row:
        raise HTTPException(status_code=404, detail="No family yet")
    return row


@router.get("")
async def me(s: SessionContainer = Depends(verify_session())) -> dict:
    user_id = s.get_user_id()
    email = await _email(user_id)
    member = await _db(db.membership, user_id, email)
    return {
        "user_id": user_id,
        "email": email,
        "family_id": member["family_id"] if member else None,
        "member": db.member_out(member) if member else None,
    }


@router.delete("")
async def delete_me(s: SessionContainer = Depends(verify_session())) -> dict:
    """Delete my account (app Settings). The owner's deletes the whole family and its data (db.delete_account)."""
    user_id = s.get_user_id()
    result = await _db(db.delete_account, user_id)
    try:
        await delete_user(user_id)  # the sign-in and every session
    except Exception as e:  # the data is gone either way; a leftover login sees "no family yet"
        print(f"me: data deleted but sign-in not removed ({type(e).__name__}: {e})")
    return result


@router.post("/family")
async def create_family(req: FamilyCreate, s: SessionContainer = Depends(verify_session())) -> dict:
    user_id = s.get_user_id()
    family_id = await _db(
        db.create_family, user_id, await _email(user_id), req.name, req.me.model_dump(),
        req.parent_phone, req.parent.model_dump(exclude_unset=True),
    )
    return await _db(db.family_view, family_id)


@router.get("/family")
async def get_family(s: SessionContainer = Depends(verify_session())) -> dict:
    m = await _member(s)
    view = await _db(db.family_view, m["family_id"])
    return {**view, "me": db.member_out(m)}


@router.patch("/family")
async def update_family(req: FamilyPatch, s: SessionContainer = Depends(verify_session())) -> dict:
    m = await _member(s)
    await _db(db.update_family, m["family_id"], req.model_dump(exclude_unset=True))
    return {"ok": True}


@router.put("/family/parents/{phone}")
async def put_parent(phone: str, req: ParentIn, s: SessionContainer = Depends(verify_session())) -> dict:
    number = normalize_phone(phone)
    if not number:
        raise HTTPException(status_code=422, detail="use international format, e.g. +919876543210")
    m = await _member(s)
    await _db(db.put_parent, m["family_id"], number, req.model_dump(exclude_unset=True))
    return {"ok": True, "phone": number}


class PhoneChange(_In):
    phone: str


@router.put("/family/parents/{phone}/phone")
async def change_parent_phone(phone: str, req: PhoneChange, s: SessionContainer = Depends(verify_session())) -> dict:
    """The parent has a new number: their calls, memory and settings move with them."""
    number = normalize_phone(phone)
    if not number:
        raise HTTPException(status_code=422, detail="use international format, e.g. +919876543210")
    m = await _member(s)
    await _db(db.change_parent_phone, m["family_id"], number, req.phone)
    return {"ok": True, "phone": req.phone}


@router.post("/family/members")
async def add_member(req: MemberIn, s: SessionContainer = Depends(verify_session())) -> dict:
    m = await _member(s)
    return await _db(db.save_member, m["family_id"], None, req.model_dump())


@router.patch("/family/members/{member_id}")
async def update_member(member_id: int, req: MemberPatch, s: SessionContainer = Depends(verify_session())) -> dict:
    m = await _member(s)
    fields = req.model_dump(exclude_unset=True)
    if fields.get("is_emergency") is None:
        fields.pop("is_emergency", None)
    row = await _db(db.save_member, m["family_id"], member_id, fields)
    if not row:
        raise HTTPException(status_code=404, detail="Member not found")
    return row


@router.delete("/family/members/{member_id}")
async def delete_member(member_id: int, s: SessionContainer = Depends(verify_session())) -> dict:
    m = await _member(s)
    if not await _db(db.delete_member, m["family_id"], member_id, m["id"]):
        raise HTTPException(status_code=404, detail="Member not found")
    return {"ok": True}


@router.get("/calls")
async def calls(
    phone: str | None = None,
    days: int = Query(90, ge=1, le=365),
    s: SessionContainer = Depends(verify_session()),
) -> list[dict]:
    m = await _member(s)
    number = normalize_phone(phone) if phone else None
    if phone and not number:
        raise HTTPException(status_code=422, detail="bad phone")
    return await _db(db.recent_calls, m["family_id"], number, days, 400)


@router.get("/calls/{call_id}")
async def call(call_id: int, s: SessionContainer = Depends(verify_session())) -> dict:
    m = await _member(s)
    row = await _db(db.call_detail, m["family_id"], call_id)
    if not row:
        raise HTTPException(status_code=404, detail="Call not found")
    return row


@router.get("/trends")
async def trends(phone: str | None = None, s: SessionContainer = Depends(verify_session())) -> dict:
    """The Trends screen's note on the last 30 days (app/insights.py); note is null with under 3 answered calls."""
    m = await _member(s)
    number = normalize_phone(phone) if phone else await _db(messages.first_parent, m["family_id"])
    if not number or not await _db(db.call_target, m["family_id"], number):
        raise HTTPException(status_code=404, detail="Parent not found")
    return {"note": await _db(insights.trend_note, number)}


class CallNow(BaseModel):
    confirm: bool = False


def _minutes(seconds: float) -> int:
    return max(1, round(seconds / 60))


def _place_call(family_id: int, phone: str) -> dict:
    """Checks the limits and asks Sarvam to ring the parent. Sync: runs in a thread."""
    with _call_lock:
        parent = db.call_target(family_id, phone)
        if not parent:
            raise HTTPException(status_code=404, detail="That number is not a parent in your family")
        name = parent["parent_name"]
        last = db.last_attempt(phone)
        if last:
            age = time.time() - last["created_at"].timestamp()
            if not last["finished"] and age < CALL_TIMEOUT_S:
                raise HTTPException(status_code=409, detail=f"Kin is already calling {name}.")
            if age < CALL_COOLDOWN_S:
                wait = _minutes(CALL_COOLDOWN_S - age)
                raise HTTPException(
                    status_code=429,
                    detail=f"Kin called {name} {_minutes(age)} min ago. Try again in {wait} min.",
                )
        if db.app_calls_today(family_id, APP_SOURCE) >= CALLS_PER_DAY:
            raise HTTPException(status_code=429, detail=f"Your family has used today's {CALLS_PER_DAY} calls. Try again tomorrow.")
        if missing_config():
            print(f"me: call now not possible, missing {missing_config()}")
            raise HTTPException(status_code=503, detail="Kin can't place calls right now.")

        try:
            attempt_id = place_outbound(phone, db.call_variables(parent), source=APP_SOURCE)
        except OutboundError as e:
            print(f"me: call now failed: {e}")
            raise HTTPException(status_code=502, detail="Kin could not place the call. Please try again.")
        print(f"me: call now placed: attempt={attempt_id}")
        return {"attempt_id": attempt_id, "parent_name": name}


@router.post("/family/parents/{phone}/call")
async def call_now(phone: str, req: CallNow, s: SessionContainer = Depends(verify_session())) -> dict:
    number = normalize_phone(phone)
    if not number:
        raise HTTPException(status_code=422, detail="use international format, e.g. +919876543210")
    if not req.confirm:
        raise HTTPException(status_code=422, detail="Confirm that your parent expects Kin's call.")
    m = await _member(s)
    return await _db(_place_call, m["family_id"], number)


@router.post("/family/members/{member_id}/call")
async def call_member(member_id: int, req: CallNow, s: SessionContainer = Depends(verify_session())) -> dict:
    """Kin checks in on a family member: same limits as calling the parent."""
    if not req.confirm:
        raise HTTPException(status_code=422, detail="Confirm that they expect Kin's call.")
    m = await _member(s)
    target = await _db(db.member_callee, m["family_id"], member_id)
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")
    number = normalize_phone(target["phone"])
    if not number:
        raise HTTPException(status_code=422, detail=f"Add a phone number for {target['name']} first.")
    await _db(db.ensure_callee, m["family_id"], number, target["name"])
    return await _db(_place_call, m["family_id"], number)


class MessageIn(_In):
    text: str = Field(min_length=1, max_length=300)
    reply_to: int | None = None  # answering one of the parent's messages
    phone: str | None = None  # which parent; default: the reply's, else the family's first


MAX_WAITING = 10  # notes waiting for one parent's next call


@router.get("/messages")
async def list_messages(s: SessionContainer = Depends(verify_session())) -> list[dict]:
    m = await _member(s)
    return await _db(messages.for_family, m["family_id"])


@router.post("/messages")
async def send_message(req: MessageIn, s: SessionContainer = Depends(verify_session())) -> dict:
    """Kin passes this on to the parent during their next call."""
    m = await _member(s)
    fid = m["family_id"]
    if req.reply_to is not None:
        original = await _db(messages.get, fid, req.reply_to)
        if not original:
            raise HTTPException(status_code=404, detail="Message not found")
        phone = original["phone"]
    elif req.phone:
        if not await _db(db.call_target, fid, req.phone):
            raise HTTPException(status_code=404, detail="That number is not a parent in your family")
        phone = req.phone
    else:
        phone = await _db(messages.first_parent, fid)
        if not phone:
            raise HTTPException(status_code=404, detail="Add a parent first")
    if await _db(messages.waiting_for_parent, phone) >= MAX_WAITING:
        raise HTTPException(status_code=429, detail="Kin already has 10 messages to pass on. Wait for the next call.")
    row = await _db(messages.send_to_parent, fid, m["id"], phone, req.text, req.reply_to)
    return {"ok": True, "id": row["id"]}


@router.post("/messages/{message_id}/done")
async def message_done(message_id: int, s: SessionContainer = Depends(verify_session())) -> dict:
    """Someone in the family dealt with the parent's message."""
    m = await _member(s)
    if not await _db(messages.mark_done, m["family_id"], message_id, m["id"]):
        raise HTTPException(status_code=404, detail="Message not found")
    return {"ok": True}


# ---- medicine reminder calls (app/reminders.py) ----------------------------------

HHMM = r"^([01]\d|2[0-3]):[0-5]\d$"  # IST, like call_time


class ReminderIn(_In):
    phone: str
    time: str = Field(pattern=HHMM)
    medicines: str = Field(min_length=1, max_length=200)


class ReminderPatch(_In):
    time: str | None = Field(default=None, pattern=HHMM)
    medicines: str | None = Field(default=None, min_length=1, max_length=200)
    enabled: bool | None = None


async def _reminder_db(fn, *args):
    try:
        return await _db(fn, *args)
    except reminders.NotFound as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/reminders")
async def add_reminder(req: ReminderIn, s: SessionContainer = Depends(verify_session())) -> dict:
    m = await _member(s)
    return await _reminder_db(reminders.add, m["family_id"], req.phone, req.time, req.medicines)


@router.patch("/reminders/{reminder_id}")
async def update_reminder(reminder_id: int, req: ReminderPatch, s: SessionContainer = Depends(verify_session())) -> dict:
    m = await _member(s)
    return await _reminder_db(reminders.update, m["family_id"], reminder_id, req.model_dump(exclude_unset=True))


@router.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: int, s: SessionContainer = Depends(verify_session())) -> dict:
    m = await _member(s)
    await _reminder_db(reminders.delete, m["family_id"], reminder_id)
    return {"ok": True}


# ---- medicine stock (app/stock.py) ---------------------------------------------------

class StockIn(_In):
    phone: str
    name: str = Field(min_length=1, max_length=80)
    per_day: float = Field(gt=0, le=12)  # tablets a day; 0.5 for half a tablet
    pack_size: int = Field(ge=1, le=500)
    tablets: float = Field(ge=0, le=5000)  # at home now
    course_ends_on: date | None = None  # last day of a set course (e.g. 5 days of antibiotics); none = ongoing


class Restock(BaseModel):
    packs: int = Field(default=0, ge=0, le=50)
    tablets: int = Field(default=0, ge=0, le=1000)


async def _stock_db(fn, *args):
    try:
        return await _db(fn, *args)
    except stock.NotFound as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/stock")
async def set_stock(req: StockIn, s: SessionContainer = Depends(verify_session())) -> dict:
    m = await _member(s)
    return await _stock_db(stock.set_stock, m["family_id"], req.phone, req.name, req.per_day, req.pack_size, req.tablets,
                           req.course_ends_on)


class RestockItem(BaseModel):
    id: int
    packs: int = Field(ge=0, le=50)


class RestockAll(BaseModel):
    items: list[RestockItem] = Field(min_length=1, max_length=20)


@router.post("/stock/restock")
async def restock_all(req: RestockAll, s: SessionContainer = Depends(verify_session())) -> list[dict]:
    """Bought several medicines at once: add each one's strips to what's left."""
    m = await _member(s)
    return await _stock_db(stock.restock_many, m["family_id"], [i.model_dump() for i in req.items])


@router.post("/stock/{stock_id}/restock")
async def restock(stock_id: int, req: Restock, s: SessionContainer = Depends(verify_session())) -> dict:
    if not req.packs and not req.tablets:
        raise HTTPException(status_code=422, detail="Add at least one pack or tablet")
    m = await _member(s)
    return await _stock_db(stock.restock, m["family_id"], stock_id, req.packs, req.tablets)


class ProductIn(_In):
    phone: str
    name: str = Field(min_length=1, max_length=80)
    link: str | None = Field(default=None, max_length=1000)  # an Amazon product or share link; none = forget


@router.put("/medicine-products")
async def set_product(req: ProductIn, s: SessionContainer = Depends(verify_session())) -> dict:
    m = await _member(s)
    try:
        saved = await _stock_db(stock.set_product, m["family_id"], req.phone, req.name, req.link)
    except stock.BadLink as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"product": saved}


@router.delete("/stock/{stock_id}")
async def delete_stock(stock_id: int, s: SessionContainer = Depends(verify_session())) -> dict:
    m = await _member(s)
    await _stock_db(stock.delete, m["family_id"], stock_id)
    return {"ok": True}


# ---- monthly groceries (app/groceries.py) ------------------------------------------------

EVERY = Literal[7, 14, 21, 30, 60]  # weekly ... every two months


class GroceryItem(_In):
    name: str = Field(min_length=1, max_length=60)
    qty: str | None = Field(default=None, max_length=30)
    every_days: EVERY = 30


class GroceriesIn(_In):
    phone: str
    items: list[GroceryItem] = Field(min_length=1, max_length=30)


class GroceryPatch(_In):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    qty: str | None = Field(default=None, max_length=30)
    every_days: EVERY | None = None


class Bought(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=60)


async def _grocery_db(fn, *args):
    try:
        return await _db(fn, *args)
    except groceries.NotFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/groceries")
async def add_groceries(req: GroceriesIn, s: SessionContainer = Depends(verify_session())) -> list[dict]:
    m = await _member(s)
    return await _grocery_db(groceries.add, m["family_id"], req.phone, [i.model_dump() for i in req.items])


@router.patch("/groceries/{item_id}")
async def update_grocery(item_id: int, req: GroceryPatch, s: SessionContainer = Depends(verify_session())) -> list[dict]:
    m = await _member(s)
    fields = {k: v for k, v in req.model_dump(exclude_unset=True).items() if v is not None or k == "qty"}
    return await _grocery_db(groceries.update, m["family_id"], item_id, fields)


class AmazonLink(_In):
    link: str | None = Field(default=None, max_length=1000)  # an Amazon product or share link; none = forget


@router.put("/groceries/{item_id}/amazon")
async def grocery_amazon(item_id: int, req: AmazonLink, s: SessionContainer = Depends(verify_session())) -> list[dict]:
    m = await _member(s)
    try:
        return await _grocery_db(groceries.set_amazon, m["family_id"], item_id, req.link)
    except stock.BadLink as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.delete("/groceries/{item_id}")
async def delete_grocery(item_id: int, s: SessionContainer = Depends(verify_session())) -> list[dict]:
    m = await _member(s)
    return await _grocery_db(groceries.delete, m["family_id"], item_id)


@router.post("/groceries/bought")
async def groceries_bought(req: Bought, s: SessionContainer = Depends(verify_session())) -> list[dict]:
    """Marks items bought today: each starts its next cycle."""
    m = await _member(s)
    return await _grocery_db(groceries.bought, m["family_id"], req.ids)


@router.post("/urgent/{event_id}/handled")
async def urgent_handled(event_id: int, s: SessionContainer = Depends(verify_session())) -> dict:
    """Someone in the family dealt with an emergency Kin flagged; the red banner goes away."""
    m = await _member(s)
    if not await _db(urgent.mark_handled, m["family_id"], event_id, m["id"]):
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


class PushToken(BaseModel):
    token: str = Field(pattern=r"^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$")
    platform: Literal["ios", "android"] | None = None


@router.post("/push-tokens")
async def add_push_token(req: PushToken, s: SessionContainer = Depends(verify_session())) -> dict:
    """This phone gets the family's pushes: the evening card, no-answer and alerts (app/push.py)."""
    m = await _member(s)
    await _db(db.save_push_token, s.get_user_id(), m["family_id"], req.token, req.platform)
    return {"ok": True}


class PushTest(BaseModel):
    kind: Literal["green", "amber", "red", "missed"] = "green"


@router.post("/push-test")
async def push_test(req: PushTest, s: SessionContainer = Depends(verify_session())) -> dict:
    """Settings → "Send a test notification": a sample push to this user's own phones only."""
    from app import push  # push imports me, so load it here

    m = await _member(s)
    rows = await _db(db._query, "SELECT token FROM push_tokens WHERE user_id = %(u)s", {"u": s.get_user_id()})
    tokens = [r["token"] for r in rows]
    if not tokens:
        raise HTTPException(status_code=409, detail="This phone isn't registered for notifications yet. Allow them in iOS Settings, then reopen Kin.")
    name = (await _db(db._query, "SELECT parent_name FROM parents WHERE family_id = %(f)s ORDER BY created_at LIMIT 1", {"f": m["family_id"]}) or [{}])[0].get("parent_name") or "Amma"
    title, body, data = {
        "green": (f"{name}'s call card is ready", "A steady evening: slept well, took all medicines, in good spirits.", {"screen": "today"}),
        "amber": (f"{name}'s call card: something to watch", "Knee pain again for the 3rd day. Worth a call this weekend.", {"screen": "today"}),
        "red": (f"{name} needs attention", "This is a test of a red alert. Nothing is wrong.", {"screen": "alert"}),
        "missed": (f"{name} didn't answer tonight", "This is a test. Kin tried 3 times.", {"screen": "call"}),
    }[req.kind]
    sent = await run_in_threadpool(push.send, tokens, title, "Test: " + body if req.kind in ("green", "amber") else body, data)
    return {"ok": True, "sent": sent, "phones": len(tokens)}


@router.delete("/push-tokens")
async def remove_push_token(req: PushToken, s: SessionContainer = Depends(verify_session())) -> dict:
    """On sign-out: stop pushes to this phone."""
    await _db(db.delete_push_token, s.get_user_id(), req.token)
    return {"ok": True}


@router.get("/attempts/{attempt_id}")
async def attempt(attempt_id: str, s: SessionContainer = Depends(verify_session())) -> dict:
    m = await _member(s)
    row = await _db(db.attempt_view, m["family_id"], attempt_id, APP_SOURCE)
    if not row:
        raise HTTPException(status_code=404, detail="Call not found")
    placed = row["created_at"].timestamp()
    elapsed = int(time.time() - placed)
    if row["finished"]:
        state = "done"
    elif elapsed > CALL_TIMEOUT_S:
        state = "timeout"
    else:
        state = "connected" if connected_since(row["phone"], placed) else "calling"
    return {"state": state, "elapsed_s": elapsed, "call_id": row["call_id"], "status": row["status"]}
