"""Shared secret for server-to-server calls from kin-web (server actions).

kin-web sends WEB_API_TOKEN in the X-Web-Token header; browsers never see it.
Routes that only the web server may call depend on require_web_token.
"""

import hmac
import os

from fastapi import Header, HTTPException


def require_web_token(x_web_token: str | None = Header(default=None)) -> None:
    expected = os.getenv("WEB_API_TOKEN", "")
    if not expected:
        raise HTTPException(status_code=503, detail="Not enabled")
    if not x_web_token or not hmac.compare_digest(x_web_token.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="bad token")
