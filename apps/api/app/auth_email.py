"""The sign-in code email, sent over our own SMTP server.

The code is in the subject ("123456 is your Kin sign-in code") so it can be
read straight from the phone's notification. The body is Kin-styled HTML
(tables and inline styles only, so it holds up in Gmail and Outlook) with a
plain-text part, and the Kin mark travels inside the email (cid image), so
there is nothing to load and nothing for a mail client to block.

Set SMTP_HOST, SMTP_PORT (587 = STARTTLS, 465 = SSL), SMTP_USER,
SMTP_PASSWORD and SMTP_FROM (e.g. "Kin <hello@kin.garcade.in>").
"""

import asyncio
import os
import smtplib
from email.message import EmailMessage
from email.utils import make_msgid
from html import escape
from pathlib import Path
from typing import Any

from supertokens_python.ingredients.emaildelivery.types import EmailDeliveryInterface
from supertokens_python.recipe.passwordless.types import PasswordlessLoginEmailTemplateVars

MARK_PNG = Path(__file__).parent / "assets" / "kin-mark.png"

# Kin tokens (apps/web/src/app/globals.css).
CLOUD = "#ebf0f8"
MIST = "#f4f7fb"
LINE = "#e3e8f0"
INK = "#222326"
BODY = "#747679"
FAINT = "#a3a6ab"
CHARCOAL = "#1f2025"
# Soft washes of the metric colours (lilac, blue, coral, gold), as on the landing page.
PAGE_WASH = "linear-gradient(180deg,#dfe3ff 0%,#e7ecfb 30%,#ebf0f8 55%,#f8eee9 100%)"
PAGE_END = "#f8eee9"  # the wash's last colour, below the email on tall screens
CODE_WASH = "linear-gradient(120deg,#ece6ff 0%,#e4ecff 40%,#fdeee8 80%,#fff5dc 100%)"
FONT = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"


def smtp_configured() -> bool:
    return bool(os.getenv("SMTP_HOST"))


def _minutes(code_life_time_ms: int) -> int:
    return max(1, round(code_life_time_ms / 60000))


def subject(code: str) -> str:
    return f"{code} is your Kin sign-in code"


def text_body(code: str, minutes: int) -> str:
    return (
        f"Your Kin sign-in code is {code}\n\n"
        f"Type it in the Kin app to sign in. It works for {minutes} minutes.\n\n"
        "Didn't ask for this? You can ignore this email. "
        "Nobody can sign in without the code.\n\n"
        "Kin · a call every evening for your parent\n"
    )


def html_body(code: str, minutes: int, mark_src: str) -> str:
    code = escape(code)
    # The code comes first so it is the first thing seen. Mail clients can't run a copy
    # button, so a tap selects the whole code (user-select: all) and the hint says how
    # to copy; the app's code field also takes the keyboard's "from Mail" suggestion.
    # Gradients are soft washes of the metric colours, with a flat colour behind them
    # for clients that drop background-image.
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<meta name="format-detection" content="telephone=no,date=no,address=no">
<title>{code} is your Kin sign-in code</title>
</head>
<body style="margin:0;padding:0;background-color:{PAGE_END};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:{CLOUD};">Your code is {code}. It works for {minutes} minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{CLOUD}" style="background-color:{CLOUD};background-image:{PAGE_WASH};">
<tr><td align="center" style="padding:36px 16px 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
<tr><td style="padding:0 8px 20px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle;"><img src="{mark_src}" width="40" height="40" alt="" style="display:block;border:0;border-radius:12px;"></td>
<td style="vertical-align:middle;padding-left:10px;font-family:{FONT};font-size:22px;line-height:1;font-weight:600;letter-spacing:-0.03em;color:{INK};">Kin</td>
</tr></table>
</td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:28px;padding:28px 24px 28px;">
<p style="margin:0 0 14px;text-align:center;font-family:{FONT};font-size:15px;line-height:1.4;font-weight:500;color:{BODY};">Your Kin sign-in code</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="center" bgcolor="{MIST}" style="background-color:{MIST};background-image:{CODE_WASH};border-radius:24px;padding:26px 12px 26px 22px;font-family:{FONT};font-size:46px;line-height:1;font-weight:600;letter-spacing:0.22em;color:{INK};"><span style="-webkit-user-select:all;user-select:all;">{code}</span></td>
</tr></table>
<p style="margin:12px 0 0;text-align:center;font-family:{FONT};font-size:13px;line-height:1.4;color:{FAINT};">Tap and hold the code to copy it</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;"><tr><td style="border-top:1px solid {LINE};font-size:0;line-height:0;">&nbsp;</td></tr></table>
<p style="margin:20px 0 16px;font-family:{FONT};font-size:16px;line-height:1.5;color:{BODY};">Type it in the Kin app to sign in. On your phone, the keyboard can fill it in for you.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td bgcolor="{CHARCOAL}" style="background:{CHARCOAL};border-radius:128px;padding:9px 16px;font-family:{FONT};font-size:14px;line-height:1;font-weight:500;color:{CLOUD};">Works for {minutes} minutes</td>
</tr></table>
<p style="margin:20px 0 0;font-family:{FONT};font-size:14px;line-height:1.5;color:{FAINT};">Didn't ask for this? You can ignore this email. Nobody can sign in without the code.</p>
</td></tr>
<tr><td style="padding:20px 8px 0;font-family:{FONT};font-size:13px;line-height:1.5;color:{FAINT};">Kin · a call every evening for your parent</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
"""


def build_message(to_email: str, code: str, code_life_time_ms: int, sender: str) -> EmailMessage:
    minutes = _minutes(code_life_time_ms)
    msg = EmailMessage()
    msg["Subject"] = subject(code)
    msg["From"] = sender
    msg["To"] = to_email
    msg.set_content(text_body(code, minutes))
    cid = make_msgid(domain="kin.garcade.in")
    msg.add_alternative(html_body(code, minutes, f"cid:{cid[1:-1]}"), subtype="html")
    msg.get_payload()[1].add_related(MARK_PNG.read_bytes(), "image", "png", cid=cid, filename="kin.png")
    return msg


def _send(msg: EmailMessage) -> None:
    host = os.environ["SMTP_HOST"]
    port = int(os.getenv("SMTP_PORT", "587"))
    user, password = os.getenv("SMTP_USER"), os.getenv("SMTP_PASSWORD")
    if port == 465:
        server: smtplib.SMTP = smtplib.SMTP_SSL(host, port, timeout=20)
    else:
        server = smtplib.SMTP(host, port, timeout=20)
        server.starttls()
    with server:
        if user:
            server.login(user, password or "")
        server.send_message(msg)


class KinSignInEmail(EmailDeliveryInterface[PasswordlessLoginEmailTemplateVars]):
    async def send_email(self, template_vars: PasswordlessLoginEmailTemplateVars, user_context: dict[str, Any]) -> None:
        sender = os.getenv("SMTP_FROM") or os.getenv("SMTP_USER") or "Kin <hello@kin.garcade.in>"
        msg = build_message(template_vars.email, template_vars.user_input_code or "", template_vars.code_life_time, sender)
        await asyncio.to_thread(_send, msg)
