"""Families, their members, and the context Kin brings into each call.

A family groups the people who look after one or more parents:

    families ─┬─ members  (children and relatives, each with their own number)
              └─ parents  (the people Kin calls; parents.family_id)

Two kinds of context reach the agent:
- family_context: family-wide, the same for every parent in the family: who the
  members are (name, relation, city), their news, and the family's notes.
- about_parent: this one parent: routine, likes, how they like to be spoken to.
Plus topics_avoid per parent. Numbers never go into the prompt.

Reads used during a call are best effort (ProfileError, like app.parents);
the /families routes turn ProfileError into a 503.
"""

from app.db import DatabaseNotConfigured, pool
from app.parents import ProfileError

FAMILY_FIELDS = ("name", "context")
# email: an invite to the Kin app (claimed on first sign-in, see app.me).
MEMBER_FIELDS = ("name", "relation", "phone", "city", "notes", "is_emergency", "email")
PARENT_FIELDS = (
    "parent_name", "family_name", "language", "medicines", "health_notes",
    "emergency_number", "about", "topics_avoid",
)
CONTEXT_LIMIT = 700


def _query(sql: str, params: dict | None = None) -> list[dict]:
    try:
        with pool().connection() as conn:
            cur = conn.execute(sql, params or {})
            if cur.description is None:
                return []
            cols = [c.name for c in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
    except DatabaseNotConfigured as e:
        raise ProfileError(str(e)) from e
    except Exception as e:  # connection or query failure
        raise ProfileError(f"{type(e).__name__}: {e}") from e


def _one(sql: str, params: dict | None = None) -> dict | None:
    rows = _query(sql, params)
    return rows[0] if rows else None


def _set_clause(fields: dict) -> str:
    # Keys come from the *_FIELDS whitelists above, never from the request.
    return ", ".join(f"{k} = %({k})s" for k in fields)


# ---- families -------------------------------------------------------------

def create_family(name: str, context: str | None = None) -> dict:
    return _one(
        "INSERT INTO families (name, context) VALUES (%(name)s, %(context)s) RETURNING id, name, context",
        {"name": name, "context": context},
    )


def update_family(family_id: int, fields: dict) -> dict | None:
    fields = {k: v for k, v in fields.items() if k in FAMILY_FIELDS}
    if not fields:
        return _one("SELECT id, name, context FROM families WHERE id = %(id)s", {"id": family_id})
    return _one(
        f"UPDATE families SET {_set_clause(fields)}, updated_at = now() WHERE id = %(id)s RETURNING id, name, context",
        {**fields, "id": family_id},
    )


def delete_family(family_id: int) -> bool:
    """Members go with the family; parents stay (with their call history) but are detached."""
    return bool(_query("DELETE FROM families WHERE id = %(id)s RETURNING id", {"id": family_id}))


def get_family(family_id: int) -> dict | None:
    family = _one("SELECT id, name, context, created_at FROM families WHERE id = %(id)s", {"id": family_id})
    if not family:
        return None
    family["members"] = _query(
        "SELECT id, name, relation, phone, city, notes, is_emergency, email, role, user_id IS NOT NULL AS linked "
        "FROM members WHERE family_id = %(id)s ORDER BY id",
        {"id": family_id},
    )
    family["parents"] = _query(
        "SELECT phone, parent_name, family_name, language, medicines, health_notes, emergency_number, "
        "about, topics_avoid, consent_at, last_call_summary, last_call_at FROM parents "
        "WHERE family_id = %(id)s ORDER BY created_at",
        {"id": family_id},
    )
    return family


# ---- members --------------------------------------------------------------

MEMBER_COLS = "id, family_id, name, relation, phone, city, notes, is_emergency, email"


def add_member(family_id: int, fields: dict) -> dict:
    fields = {k: fields.get(k) for k in MEMBER_FIELDS}
    fields["is_emergency"] = bool(fields["is_emergency"])
    return _one(
        "INSERT INTO members (family_id, name, relation, phone, city, notes, is_emergency, email) "
        "VALUES (%(family_id)s, %(name)s, %(relation)s, %(phone)s, %(city)s, %(notes)s, %(is_emergency)s, %(email)s) "
        f"RETURNING {MEMBER_COLS}",
        {**fields, "family_id": family_id},
    )


def update_member(family_id: int, member_id: int, fields: dict) -> dict | None:
    fields = {k: v for k, v in fields.items() if k in MEMBER_FIELDS}
    if not fields:
        return _one(f"SELECT {MEMBER_COLS} FROM members WHERE id = %(m)s AND family_id = %(f)s",
                    {"m": member_id, "f": family_id})
    return _one(
        f"UPDATE members SET {_set_clause(fields)}, updated_at = now() "
        f"WHERE id = %(m)s AND family_id = %(f)s RETURNING {MEMBER_COLS}",
        {**fields, "m": member_id, "f": family_id},
    )


def delete_member(family_id: int, member_id: int) -> bool:
    return bool(_query("DELETE FROM members WHERE id = %(m)s AND family_id = %(f)s RETURNING id",
                       {"m": member_id, "f": family_id}))


# ---- parents in a family ----------------------------------------------------

def put_parent(family_id: int, phone: str, fields: dict) -> dict:
    """Create the parent or update the given fields, and attach them to the family.

    A parent belongs to one family; putting them into another family moves them.
    Fields left out keep their current value.
    """
    fields = {k: v for k, v in fields.items() if k in PARENT_FIELDS}
    cols = ["phone", "family_id", *fields]
    updates = ", ".join(["family_id = EXCLUDED.family_id", *(f"{k} = EXCLUDED.{k}" for k in fields), "updated_at = now()"])
    return _one(
        f"INSERT INTO parents ({', '.join(cols)}) VALUES ({', '.join(f'%({c})s' for c in cols)}) "
        f"ON CONFLICT (phone) DO UPDATE SET {updates} "
        "RETURNING phone, family_id, parent_name, family_name, language, medicines, health_notes, "
        "emergency_number, about, topics_avoid",
        {**fields, "phone": phone, "family_id": family_id},
    )


def detach_parent(family_id: int, phone: str) -> bool:
    return bool(_query(
        "UPDATE parents SET family_id = NULL, updated_at = now() "
        "WHERE phone = %(p)s AND family_id = %(f)s RETURNING phone",
        {"p": phone, "f": family_id},
    ))


# ---- context for calls ------------------------------------------------------

def _member_line(m: dict) -> str:
    details = ", ".join(x for x in (m.get("relation"), f"lives in {m['city']}" if m.get("city") else None) if x)
    line = f"{m['name']} ({details})" if details else m["name"]
    return f"{line}: {m['notes']}" if m.get("notes") else line


def format_family_context(name: str | None, members: list[dict], others: list[str], context: str | None) -> str:
    parts = [f"{name}."] if name else []
    if members:
        parts.append("Family members: " + "; ".join(_member_line(m) for m in members) + ".")
    if others:
        parts.append("Kin also calls: " + ", ".join(others) + ".")
    if context:
        parts.append(f"Family news: {context}")
    return " ".join(parts)[:CONTEXT_LIMIT]


def family_variables(phone: str) -> dict[str, str]:
    """Agent variables from the parent's own profile and their family.

    Only returns keys that have a value, so callers can merge with setdefault.
    family_name and emergency_number are fallbacks from the members, used
    when the parent's profile has none of its own.
    """
    parent = _one(
        "SELECT p.parent_name, p.about, p.topics_avoid, p.family_name, p.emergency_number, "
        "f.id AS family_id, f.name AS family, f.context "
        "FROM parents p LEFT JOIN families f ON f.id = p.family_id WHERE p.phone = %(p)s",
        {"p": phone},
    )
    if not parent:
        return {}
    out: dict[str, str] = {}
    if parent["about"]:
        out["about_parent"] = parent["about"][:CONTEXT_LIMIT]
    if parent["topics_avoid"]:
        out["topics_avoid"] = parent["topics_avoid"][:300]
    if not parent["family_id"]:
        return out

    members = _query(
        "SELECT name, relation, city, notes, phone, is_emergency FROM members "
        "WHERE family_id = %(f)s ORDER BY is_emergency DESC, id",
        {"f": parent["family_id"]},
    )
    others = _query(
        "SELECT parent_name FROM parents WHERE family_id = %(f)s AND phone <> %(p)s ORDER BY created_at",
        {"f": parent["family_id"], "p": phone},
    )
    out["family_context"] = format_family_context(
        parent["family"], members, [o["parent_name"] for o in others], parent["context"]
    )
    # "Tell my family" replies and notes waiting for the parent (app/messages.py).
    from app.messages import to_pass_on  # noqa: PLC0415 (app.messages imports this module)

    if note := to_pass_on(phone):
        out["family_context"] = f"{out['family_context']}\n{note}"

    if not parent["family_name"] and members:
        out["family_name"] = members[0]["name"]
    if not parent["emergency_number"]:
        contact = next((m for m in members if m["is_emergency"] and m["phone"]), None)
        if contact:
            out["emergency_number"] = contact["phone"]
    return out


def member_by_phone(phone: str) -> dict | None:
    """The family member calling from this number, with their family's parent.

    Returns {member_name, relation, parent_phone} only when the family has
    exactly one parent, so Kin never has to guess whom an introduction is for.
    """
    rows = _query(
        "SELECT m.name, m.relation, p.phone AS parent_phone FROM members m "
        "JOIN parents p ON p.family_id = m.family_id WHERE m.phone = %(p)s",
        {"p": phone},
    )
    if len(rows) != 1:
        return None
    r = rows[0]
    return {"member_name": r["name"], "relation": r["relation"], "parent_phone": r["parent_phone"]}


def mark_consent(phone: str) -> None:
    _query("UPDATE parents SET consent_at = COALESCE(consent_at, now()), updated_at = now() WHERE phone = %(p)s",
           {"p": phone})


def stop_daily_calls(phone: str) -> None:
    """The parent told Kin they don't want the calls: daily calls off (and medicine reminders),
    consent withdrawn, today's planned retries dropped. The family can switch them back on after talking to them."""
    _query("UPDATE parents SET daily_calls = false, consent_at = NULL, updated_at = now() WHERE phone = %(p)s",
           {"p": phone})
    _query("UPDATE call_jobs SET status = 'skipped', note = 'the parent asked Kin to stop calling', updated_at = now() "
           "WHERE phone = %(p)s AND status = 'pending'", {"p": phone})
    from app.reminders import switch_off  # reminders imports this module

    switch_off(phone)


def save_own_family(phone: str, parent_name: str, family: dict) -> bool:
    """Try-it: keep the family a visitor typed in for this one number.

    Each number gets a family of its own (never matched to another number's
    family by name); a later call to the same number replaces its members.
    Families created through /families (source 'app') are never touched:
    for those parents this returns False and the details only reach the
    one call. One transaction, so a failure leaves the old family as it was.
    """
    try:
        with pool().connection() as conn, conn.transaction():
            row = conn.execute(
                "SELECT p.family_id, f.source FROM parents p LEFT JOIN families f ON f.id = p.family_id "
                "WHERE p.phone = %(p)s FOR UPDATE OF p",
                {"p": phone},
            ).fetchone()
            family_id = row[0] if row and row[0] else None
            if family_id and row[1] != "demo":
                return False
            name, context = family.get("name") or f"{parent_name}'s family", family.get("context")
            if family_id:
                conn.execute("UPDATE families SET name = %(n)s, context = %(c)s, updated_at = now() WHERE id = %(f)s",
                             {"n": name, "c": context, "f": family_id})
                conn.execute("DELETE FROM members WHERE family_id = %(f)s", {"f": family_id})
            else:
                family_id = conn.execute(
                    "INSERT INTO families (name, context, source) VALUES (%(n)s, %(c)s, 'demo') RETURNING id",
                    {"n": name, "c": context},
                ).fetchone()[0]
            for m in family.get("members") or []:
                conn.execute(
                    "INSERT INTO members (family_id, name, relation, city, notes) "
                    "VALUES (%(f)s, %(name)s, %(relation)s, %(city)s, %(notes)s)",
                    {"f": family_id, **{k: m.get(k) for k in ("name", "relation", "city", "notes")}},
                )
            conn.execute(
                """
                INSERT INTO parents (phone, parent_name, family_id, about, topics_avoid)
                VALUES (%(p)s, %(n)s, %(f)s, %(a)s, %(t)s)
                ON CONFLICT (phone) DO UPDATE SET family_id = EXCLUDED.family_id, about = EXCLUDED.about,
                    topics_avoid = EXCLUDED.topics_avoid, updated_at = now()
                """,
                {"p": phone, "n": parent_name, "f": family_id, "a": family.get("about"), "t": family.get("topics_avoid")},
            )
        return True
    except DatabaseNotConfigured as e:
        raise ProfileError(str(e)) from e
    except Exception as e:
        raise ProfileError(f"{type(e).__name__}: {e}") from e
