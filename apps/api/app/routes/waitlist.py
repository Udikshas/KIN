"""Waitlist sign-ups from the landing page, stored in Postgres.

Only kin-web's server action calls this (X-Web-Token). Signing up again with
the same email and role updates the existing row instead of adding a new one.
"""

import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.db import DatabaseNotConfigured, pool
from app.web_auth import require_web_token

router = APIRouter(dependencies=[Depends(require_web_token)])

EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PHONE = re.compile(r"^\+?[\d\s()-]{7,20}$")


class SignUp(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    email: str = Field(max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    city: str | None = Field(default=None, max_length=200)
    role: Literal["family", "centre", "insurer"]
    language: Literal["Hindi", "Tamil", "Malayalam", "Bengali", "English", "Other"] | None = None

    @field_validator("name", "email", "phone", "city", "language", mode="before")
    @classmethod
    def strip(cls, v: object) -> object:
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v

    @field_validator("email")
    @classmethod
    def email_ok(cls, v: str) -> str:
        if not EMAIL.match(v):
            raise ValueError("invalid email")
        return v.lower()

    @field_validator("phone")
    @classmethod
    def phone_ok(cls, v: str | None) -> str | None:
        if v is not None and not PHONE.match(v):
            raise ValueError("invalid phone")
        return v


UPSERT = """
INSERT INTO waitlist (name, email, phone, city, role, language)
VALUES (%(name)s, %(email)s, %(phone)s, %(city)s, %(role)s, %(language)s)
ON CONFLICT (lower(email), role) DO UPDATE SET
    name = EXCLUDED.name,
    phone = COALESCE(EXCLUDED.phone, waitlist.phone),
    city = COALESCE(EXCLUDED.city, waitlist.city),
    language = COALESCE(EXCLUDED.language, waitlist.language),
    updated_at = now()
RETURNING id, (xmax = 0) AS inserted
"""


def save(sign_up: SignUp) -> tuple[int, bool]:
    with pool().connection() as conn:
        row = conn.execute(UPSERT, sign_up.model_dump()).fetchone()
    return row[0], row[1]


@router.post("/waitlist")
def join(sign_up: SignUp) -> dict[str, object]:
    try:
        row_id, inserted = save(sign_up)
    except DatabaseNotConfigured:
        raise HTTPException(status_code=503, detail="Database not configured")
    except Exception as e:  # connection or query failure; the web falls back to its file
        print(f"waitlist insert failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=503, detail="Database unavailable")
    print(f"waitlist: id={row_id} role={sign_up.role} {'new' if inserted else 'updated'}")
    return {"ok": True, "id": row_id, "new": inserted}
