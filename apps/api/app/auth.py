"""SuperTokens setup: passwordless email OTP + sessions.

The SuperTokens core runs as its own container on Coolify; this module points
the Python SDK at it. Login routes are served under /auth (e.g. /auth/signinup/code).
"""

import os
from typing import Any

from supertokens_python import InputAppInfo, SupertokensConfig, init
from supertokens_python.ingredients.emaildelivery.types import EmailDeliveryConfig, EmailDeliveryInterface
from supertokens_python.recipe import dashboard, passwordless, session
from supertokens_python.recipe.passwordless.types import PasswordlessLoginEmailTemplateVars

from .auth_email import KinSignInEmail, smtp_configured


class _LogCodes(EmailDeliveryInterface[PasswordlessLoginEmailTemplateVars]):
    """Local dev only (AUTH_LOG_CODES=1): print the sign-in code instead of emailing it."""

    async def send_email(self, template_vars: PasswordlessLoginEmailTemplateVars, user_context: dict[str, Any]) -> None:
        print(f"auth: sign-in code for {template_vars.email}: {template_vars.user_input_code}", flush=True)


def email_service() -> EmailDeliveryInterface[PasswordlessLoginEmailTemplateVars] | None:
    """Log codes locally, else our own Kin email when SMTP is set, else SuperTokens' default email."""
    if os.getenv("AUTH_LOG_CODES") == "1":
        return _LogCodes()
    if smtp_configured():
        return KinSignInEmail()
    return None


def init_auth() -> None:
    init(
        app_info=InputAppInfo(
            app_name="Kin",
            api_domain=os.getenv("API_DOMAIN", "http://localhost:8000"),
            website_domain=os.getenv("WEBSITE_DOMAIN", "http://localhost:3000"),
            api_base_path="/auth",
            website_base_path="/auth",
        ),
        supertokens_config=SupertokensConfig(
            connection_uri=os.getenv("SUPERTOKENS_CONNECTION_URI", "http://localhost:3567"),
            api_key=os.getenv("SUPERTOKENS_API_KEY") or None,
        ),
        framework="fastapi",
        recipe_list=[
            # Email OTP for now. Switch to ContactEmailOrPhoneConfig once an SMS
            # provider (MSG91 / Twilio) and India DLT registration are in place.
            passwordless.init(
                contact_config=passwordless.ContactEmailOnlyConfig(),
                flow_type="USER_INPUT_CODE",
                email_delivery=EmailDeliveryConfig(service=service) if (service := email_service()) else None,
            ),
            # Header-based tokens work for the Expo app; cookies for the web.
            session.init(),
            # User admin UI at /auth/dashboard (sign in with SUPERTOKENS_API_KEY).
            dashboard.init(),
        ],
        mode="asgi",
    )
