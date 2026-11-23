"""Families, members and parents: who Kin calls and who it calls for.

Server-to-server only for now (X-Web-Token, like /demo and /waitlist). When the
Expo app signs families in, these move behind verify_session() with a check
that the signed-in member belongs to the family.

    POST   /families                          {name, context?}
    GET    /families/{id}                     family + members + parents
    PATCH  /families/{id}                     {name?, context?}
    DELETE /families/{id}                     members go too; parents are detached
    POST   /families/{id}/members             {name, relation?, phone?, city?, notes?, is_emergency?, email?}
    PATCH  /families/{id}/members/{member_id}
    DELETE /families/{id}/members/{member_id}
    PUT    /families/{id}/parents/{phone}     {parent_name, language?, medicines?, about?, ...}
    DELETE /families/{id}/parents/{phone}     detach (profile and history stay)
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from psycopg.errors import UniqueViolation
from pydantic import BaseModel, Field, field_validator

from app import families as db
from app.greetings import GREETINGS
from app.parents import ProfileError, normalize_phone
from app.web_auth import require_web_token

router = APIRouter(prefix="/families", dependencies=[Depends(require_web_token)])

Language = Literal[tuple(GREETINGS)]  # the languages Kin has opening lines for
EMAIL = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class _In(BaseModel):
    """Trims text fields (blank -> None) and normalises phone fields to E.164."""

    @field_validator("*", mode="before")
    @classmethod
    def _strip(cls, v):
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v

    @field_validator("phone", "emergency_number", check_fields=False)
    @classmethod
    def _e164(cls, v: str | None) -> str | None:
        if v is None:
            return None
        phone = normalize_phone(v)
        if not phone:
            raise ValueError("use international format, e.g. +919876543210")
        return phone


class FamilyIn(_In):
    name: str = Field(min_length=1, max_length=60)
    context: str | None = Field(default=None, max_length=500)


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


class MemberPatch(_In):
    name: str | None = Field(default=None, min_length=1, max_length=40)
    relation: str | None = Field(default=None, max_length=40)
    phone: str | None = None
    city: str | None = Field(default=None, max_length=60)
    notes: str | None = Field(default=None, max_length=300)
    is_emergency: bool | None = None
    email: str | None = Field(default=None, max_length=120, pattern=EMAIL)


class ParentIn(_In):
    parent_name: str = Field(min_length=1, max_length=40)
    family_name: str | None = Field(default=None, max_length=40)
    language: Language | None = None
    medicines: str | None = Field(default=None, max_length=200)
    health_notes: str | None = Field(default=None, max_length=300)
    emergency_number: str | None = None
    about: str | None = Field(default=None, max_length=500)
    topics_avoid: str | None = Field(default=None, max_length=200)


def _db(fn, *args):
    try:
        return fn(*args)
    except ProfileError as e:
        if isinstance(e.__cause__, UniqueViolation):
            raise HTTPException(status_code=409, detail="That number is already in this family")
        print(f"families: {e}")
        raise HTTPException(status_code=503, detail="Database unavailable")


def _found(row, what: str = "Family"):
    if not row:
        raise HTTPException(status_code=404, detail=f"{what} not found")
    return row


@router.post("")
def create_family(req: FamilyIn) -> dict:
    return _db(db.create_family, req.name, req.context)


@router.get("/{family_id}")
def get_family(family_id: int) -> dict:
    return _found(_db(db.get_family, family_id))


@router.patch("/{family_id}")
def update_family(family_id: int, req: FamilyPatch) -> dict:
    return _found(_db(db.update_family, family_id, req.model_dump(exclude_unset=True)))


@router.delete("/{family_id}")
def delete_family(family_id: int) -> dict:
    _found(_db(db.delete_family, family_id))
    return {"ok": True}


@router.post("/{family_id}/members")
def add_member(family_id: int, req: MemberIn) -> dict:
    _found(_db(db.update_family, family_id, {}))
    return _db(db.add_member, family_id, req.model_dump())


@router.patch("/{family_id}/members/{member_id}")
def update_member(family_id: int, member_id: int, req: MemberPatch) -> dict:
    fields = req.model_dump(exclude_unset=True)
    if fields.get("is_emergency") is None:
        fields.pop("is_emergency", None)
    return _found(_db(db.update_member, family_id, member_id, fields), "Member")


@router.delete("/{family_id}/members/{member_id}")
def delete_member(family_id: int, member_id: int) -> dict:
    _found(_db(db.delete_member, family_id, member_id), "Member")
    return {"ok": True}


@router.put("/{family_id}/parents/{phone}")
def put_parent(family_id: int, phone: str, req: ParentIn) -> dict:
    number = normalize_phone(phone)
    if not number:
        raise HTTPException(status_code=422, detail="use international format, e.g. +919876543210")
    _found(_db(db.update_family, family_id, {}))
    return _db(db.put_parent, family_id, number, req.model_dump(exclude_unset=True))


@router.delete("/{family_id}/parents/{phone}")
def detach_parent(family_id: int, phone: str) -> dict:
    number = normalize_phone(phone)
    _found(number and _db(db.detach_parent, family_id, number), "Parent")
    return {"ok": True}
