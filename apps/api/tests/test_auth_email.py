"""The sign-in code email: code in the subject, Kin HTML + plain text, sent over SMTP."""

import asyncio

from supertokens_python.recipe.passwordless.types import PasswordlessLoginEmailTemplateVars

from app import auth, auth_email


def template_vars(code="496667"):
    return PasswordlessLoginEmailTemplateVars(
        email="neha@example.com",
        code_life_time=15 * 60 * 1000,
        pre_auth_session_id="pre",
        tenant_id="public",
        is_first_factor=True,
        user_input_code=code,
    )


def test_message_has_code_in_subject_and_both_parts():
    msg = auth_email.build_message("neha@example.com", "496667", 15 * 60 * 1000, "Kin <hello@kin.garcade.in>")
    assert msg["Subject"] == "496667 is your Kin sign-in code"
    assert msg["To"] == "neha@example.com"
    text = msg.get_body(("plain",)).get_content()
    html = msg.get_body(("html",)).get_content()
    assert "496667" in text and "15 minutes" in text
    assert "496667" in html and "15 minutes" in html
    # The Kin mark travels inside the email, referenced by cid.
    images = [p for p in msg.walk() if p.get_content_type() == "image/png"]
    assert len(images) == 1
    assert f"cid:{images[0]['Content-ID'][1:-1]}" in html


def test_sends_over_smtp(monkeypatch):
    sent = []

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            sent.append(("connect", host, port))

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def starttls(self):
            sent.append(("starttls",))

        def login(self, user, password):
            sent.append(("login", user, password))

        def send_message(self, msg):
            sent.append(("send", msg["Subject"], msg["From"]))

    monkeypatch.setattr(auth_email.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USER", "kin")
    monkeypatch.setenv("SMTP_PASSWORD", "secret")
    monkeypatch.setenv("SMTP_FROM", "Kin <hello@kin.garcade.in>")

    asyncio.run(auth_email.KinSignInEmail().send_email(template_vars(), {}))

    assert sent == [
        ("connect", "smtp.example.com", 587),
        ("starttls",),
        ("login", "kin", "secret"),
        ("send", "496667 is your Kin sign-in code", "Kin <hello@kin.garcade.in>"),
    ]


def test_service_choice(monkeypatch, capsys):
    monkeypatch.delenv("AUTH_LOG_CODES", raising=False)
    monkeypatch.delenv("SMTP_HOST", raising=False)
    assert auth.email_service() is None  # SuperTokens' default email

    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    assert isinstance(auth.email_service(), auth_email.KinSignInEmail)

    # Local dev still prints the code, even with SMTP set.
    monkeypatch.setenv("AUTH_LOG_CODES", "1")
    service = auth.email_service()
    asyncio.run(service.send_email(template_vars("123456"), {}))
    assert "123456" in capsys.readouterr().out
