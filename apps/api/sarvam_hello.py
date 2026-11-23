"""One Sarvam chat completion. Run: .venv/bin/python sarvam_hello.py"""

import os
from pathlib import Path

from sarvamai import SarvamAI

# Load apps/api/.env into the environment (no extra dependency).
env = Path(__file__).with_name(".env")
if env.exists():
    for line in env.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

key = os.environ.get("SARVAM_API_KEY")
if not key:
    raise SystemExit("SARVAM_API_KEY is empty. Paste it into apps/api/.env")

client = SarvamAI(api_subscription_key=key)
res = client.chat.completions(
    model="sarvam-105b-conversations",
    messages=[{"role": "user", "content": "Say hello in Hindi in one short sentence."}],
)
print(res.choices[0].message.content)
