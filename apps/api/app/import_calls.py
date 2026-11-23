"""Load webhook payloads from the JSON-lines file into Postgres.

The file (SARVAM_CALLS_FILE, default data/sarvam_calls.jsonl) held every call
before Postgres stored them, and still catches payloads while Postgres is
unreachable. Run inside the kin-api container (Coolify → kin-api → Terminal):

    python -m app.import_calls            # reads SARVAM_CALLS_FILE
    python -m app.import_calls other.jsonl

Safe to run more than once: a payload already stored (same call, status and
time received) is skipped. Lines are applied oldest first, so the newest call
ends up as each parent's last_call_summary.
"""

import json
import sys
from pathlib import Path

from app.db import pool
from app.parents import ProfileError, normalize_phone, payload_source, phone_for_attempt
from app.routes.sarvam import CALLS_FILE, _update_memory, drop_transcript


def _already_stored(conn, payload: dict, received_at: str | None) -> bool:
    key = payload.get("interaction_id") or payload.get("attempt_id")
    row = conn.execute(
        "SELECT 1 FROM webhook_events WHERE coalesce(interaction_id, attempt_id) IS NOT DISTINCT FROM %(k)s "
        "AND status IS NOT DISTINCT FROM %(s)s AND received_at = coalesce(%(r)s::timestamptz, received_at) LIMIT 1",
        {"k": key, "s": payload.get("status"), "r": received_at},
    ).fetchone()
    return row is not None


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else CALLS_FILE
    if not path.exists():
        sys.exit(f"{path} does not exist")
    added = skipped = bad = 0
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
        except ValueError:
            bad += 1
            print(f"line {n}: not JSON, skipped", file=sys.stderr)
            continue
        received_at = payload.pop("received_at", None)
        if payload.get("status") == "probe":  # health-check requests, not calls
            skipped += 1
            continue
        # Leftovers from older code that stored the token in the file.
        for meta in ((payload.get("webhook_config") or {}).get("metadata"), payload.get("metadata")):
            if isinstance(meta, dict):
                meta.pop("token", None)
        drop_transcript(payload)  # transcripts are never stored

        phone = normalize_phone(payload.get("user_phone_number"))
        if not phone and payload.get("attempt_id"):
            try:
                phone = phone_for_attempt(payload["attempt_id"])
            except ProfileError:
                phone = None
        with pool().connection() as conn:
            if _already_stored(conn, payload, received_at):
                skipped += 1
                continue
            conn.execute(
                "INSERT INTO webhook_events (received_at, kind, source, attempt_id, interaction_id, phone, status, payload) "
                "VALUES (coalesce(%(r)s::timestamptz, now()), %(kind)s, %(source)s, %(a)s, %(i)s, %(p)s, %(s)s, %(payload)s)",
                {
                    "r": received_at,
                    "kind": "inbound" if payload.get("deployment_id") else "outbound",
                    "source": payload_source(payload),
                    "a": payload.get("attempt_id"),
                    "i": payload.get("interaction_id"),
                    "p": phone,
                    "s": payload.get("status"),
                    "payload": json.dumps(payload, ensure_ascii=False),
                },
            )
        if phone:
            try:
                _update_memory(phone, payload, received_at)
            except ProfileError as e:
                print(f"line {n}: event stored, call row not ({e})", file=sys.stderr)
        added += 1
    print(f"imported: {added} new, {skipped} skipped (already stored or probes), {bad} unreadable")


if __name__ == "__main__":
    main()
