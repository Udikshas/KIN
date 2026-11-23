"""Send a test push like the one a family gets after a call.

  python scripts/test_push.py --list                       phones registered (from the app sign-in)
  python scripts/test_push.py --phone +919876543210        every family phone of that parent
  python scripts/test_push.py --token 'ExponentPushToken[...]'   one phone, no database needed
  add --kind amber|red|missed to try the other messages; --title/--body to override

From apps/api: set -a; . ./.env; . ./.env.local; set +a; PYTHONPATH=. .venv/bin/python scripts/test_push.py ...
"""

import argparse

from app.push import send, tokens_for
from app.families import _query

KINDS = {
    "green": ("Amma's call card is ready", "A steady evening: slept well, took all medicines, in good spirits.", {"screen": "today"}),
    "amber": ("Amma's call card: something to watch", "Knee pain again for the 3rd day. Worth a call this weekend.", {"screen": "today"}),
    "red": ("Amma needs attention", "She mentioned a fall in the bathroom. Please call her now.", {"screen": "alert"}),
    "missed": ("Amma didn't answer tonight", "Kin tried 3 times. You may want to call Amma.", {"screen": "call"}),
}

ap = argparse.ArgumentParser()
ap.add_argument("--list", action="store_true")
ap.add_argument("--phone")
ap.add_argument("--token")
ap.add_argument("--kind", choices=KINDS, default="green")
ap.add_argument("--title")
ap.add_argument("--body")
a = ap.parse_args()

if a.list:
    for r in _query("SELECT p.phone, p.parent_name, t.platform, t.token FROM push_tokens t JOIN parents p ON p.family_id = t.family_id ORDER BY p.phone", {}):
        print(r["phone"], r["parent_name"], r["platform"], r["token"])
    raise SystemExit
if not (a.phone or a.token):
    ap.error("give --phone, --token or --list")

title, body, data = KINDS[a.kind]
tokens = [a.token] if a.token else tokens_for(a.phone)
if a.phone:
    data = {**data, "phone": a.phone}
if not tokens:
    raise SystemExit("no phones registered for that number: sign in on the phone first (not 'Look around'), then --list")
title, body = a.title or title, a.body or body
if a.token:  # straight to Expo: no database needed, and the ticket is shown
    import httpx

    msg = {"to": a.token, "title": title, "body": body, "data": data, "sound": "default", "channelId": "default", "priority": "high"}
    print(httpx.post("https://exp.host/--/api/v2/push/send", json=msg, timeout=15).json())
else:
    print(f"sent to {send(tokens, title, body, data)}/{len(tokens)} phones")
