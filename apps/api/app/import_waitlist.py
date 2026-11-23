"""Import waitlist sign-ups from the old JSON-lines file into Postgres.

Run inside the kin-api container (Coolify → kin-api → Terminal), pasting the
lines from kin-web's /data/waitlist.jsonl, then Ctrl-D:

    python -m app.import_waitlist

Safe to run more than once: existing (email, role) rows are updated, not duplicated.
"""

import json
import sys

from pydantic import ValidationError

from app.routes.waitlist import SignUp, save


def main() -> None:
    added = updated = skipped = 0
    for n, line in enumerate(sys.stdin, 1):
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
            sign_up = SignUp(**{k: row.get(k) for k in SignUp.model_fields})
        except (ValueError, ValidationError) as e:
            skipped += 1
            print(f"line {n}: skipped ({str(e).splitlines()[0]})", file=sys.stderr)
            continue
        _, inserted = save(sign_up)
        added += inserted
        updated += not inserted
    print(f"imported: {added} new, {updated} updated, {skipped} skipped")


if __name__ == "__main__":
    main()
