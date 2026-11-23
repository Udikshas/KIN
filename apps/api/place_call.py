"""Place one Sarvam Instant Outbound call.

Usage:
    .venv/bin/python place_call.py +91XXXXXXXXXX [--name Amma] [--family Neha]
        [--medicines "BP tablet after dinner, sugar tablet in the morning"]
        [--emergency +91XXXXXXXXXX] [--language Hindi] [--minutes 1|3|5]

Anything not passed falls back to the agent's defaults.

The result arrives later at PUBLIC_API_URL/webhooks/sarvam (if set).
"""

import argparse
import os
import sys
from pathlib import Path

# Load apps/api/.env into the environment (no extra dependency).
env = Path(__file__).with_name(".env")
if env.exists():
    for line in env.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

from app.sarvam_outbound import OutboundError, missing_config, place_outbound  # noqa: E402

if missing := missing_config():
    sys.exit("Missing in apps/api/.env: " + ", ".join(missing))
if not (os.environ.get("PUBLIC_API_URL") and os.environ.get("SARVAM_WEBHOOK_TOKEN")):
    print("PUBLIC_API_URL not set: placing the call without a result webhook.")

parser = argparse.ArgumentParser()
parser.add_argument("phone", help="Number to call, E.164 (e.g. +919876543210)")
parser.add_argument("--name", default="Amma", help="How Kin addresses the parent")
parser.add_argument("--family", help="Who set up Kin, e.g. Neha")
parser.add_argument("--medicines", help="Tonight's medicines in plain words")
parser.add_argument("--health-notes", help="Conditions or recent events to keep in mind")
parser.add_argument("--emergency", help="Family emergency number (E.164) for red-alert transfer")
parser.add_argument("--language", default="Hindi")
parser.add_argument("--minutes", choices=["1", "3", "5"], default="3", help="Target call length")
args = parser.parse_args()

agent_variables = {
    "parent_name": args.name,
    "language": args.language,
    "call_mode": "daily",
    "call_length_minutes": args.minutes,
}
optional = {
    "family_name": args.family,
    "medicines": args.medicines,
    "health_notes": args.health_notes,
    "emergency_number": args.emergency,
}
agent_variables.update({k: v for k, v in optional.items() if v})

try:
    attempt_id = place_outbound(args.phone, agent_variables, source="place_call.py")
except OutboundError as e:
    sys.exit(str(e))
print("Call placed. attempt_id:", attempt_id)
