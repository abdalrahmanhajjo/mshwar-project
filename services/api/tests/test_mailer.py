from __future__ import annotations

import pytest

from app.core.mailer import (
    ConsoleMailer,
    MailMessage,
    NotificationMailer,
    RecordingMailer,
    SmtpMailer,
    get_mailer,
    set_mailer,
)


def test_mail_message_hides_token_from_repr() -> None:
    message = MailMessage(
        to="ada@example.com",
        subject="Reset your Mshwar password",
        text_body="Use this link",
        purpose="password_reset",
        token="super-secret-reset-token",
    )
    assert "super-secret-reset-token" not in repr(message)
    assert message.token == "super-secret-reset-token"


@pytest.mark.asyncio
async def test_recording_mailer_returns_only_issued_reset_tokens() -> None:
    mailer = RecordingMailer()
    await mailer.send(
        MailMessage(
            to="known@example.com",
            subject="Reset",
            text_body="link",
            purpose="password_reset",
            token="issued-token",
        )
    )
    await mailer.send(
        MailMessage(
            to="unknown@example.com",
            subject="Reset",
            text_body="suppressed",
            purpose="password_reset_suppressed",
        )
    )
    assert mailer.reset_tokens_for("known@example.com") == ["issued-token"]
    assert mailer.reset_tokens_for("unknown@example.com") == []


def test_console_and_notification_mailers_exist() -> None:
    assert hasattr(ConsoleMailer, "send")
    assert hasattr(NotificationMailer, "send")


@pytest.mark.asyncio
async def test_smtp_mailer_sends_over_starttls(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import mailer as mailer_module

    sent: dict[str, object] = {}

    class FakeSMTP:
        def __init__(self, host: str, port: int, timeout: int = 0) -> None:
            sent["host"], sent["port"] = host, port

        def __enter__(self) -> FakeSMTP:
            return self

        def __exit__(self, *exc: object) -> None:
            return None

        def starttls(self, context: object) -> None:
            sent["starttls"] = True

        def login(self, user: str, password: str) -> None:
            sent["login"] = (user, password)

        def send_message(self, email: object) -> None:
            sent["from"] = email["From"]
            sent["to"] = email["To"]
            sent["subject"] = email["Subject"]

    monkeypatch.setattr(mailer_module.settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(mailer_module.settings, "smtp_port", 587)
    monkeypatch.setattr(mailer_module.settings, "smtp_username", "apikey")
    monkeypatch.setattr(mailer_module.settings, "smtp_password", "secret")
    monkeypatch.setattr(mailer_module.settings, "smtp_from", "noreply@mshwar.lb")
    monkeypatch.setattr(mailer_module.smtplib, "SMTP", FakeSMTP)

    await SmtpMailer().send(
        MailMessage(
            to="traveller@example.com", subject="Verify your email", text_body="link", purpose="email_verification"
        )
    )

    assert sent["host"] == "smtp.example.com"
    assert sent["starttls"] is True
    assert sent["login"] == ("apikey", "secret")
    assert sent["from"] == "noreply@mshwar.lb"
    assert sent["to"] == "traveller@example.com"


@pytest.mark.asyncio
async def test_smtp_mailer_strips_whitespace_from_app_password(monkeypatch: pytest.MonkeyPatch) -> None:
    # Gmail app passwords are pasted grouped, often with a non-breaking space,
    # which smtplib cannot ASCII-encode. Login must receive the stripped value.
    from app.core import mailer as mailer_module

    captured: dict[str, str] = {}

    class FakeSMTP:
        def __init__(self, host: str, port: int, timeout: int = 0) -> None:
            pass

        def __enter__(self) -> FakeSMTP:
            return self

        def __exit__(self, *exc: object) -> None:
            return None

        def starttls(self, context: object) -> None:
            pass

        def login(self, user: str, password: str) -> None:
            captured["user"], captured["password"] = user, password

        def send_message(self, email: object) -> None:
            pass

    monkeypatch.setattr(mailer_module.settings, "smtp_host", "smtp.gmail.com")
    monkeypatch.setattr(mailer_module.settings, "smtp_port", 587)
    monkeypatch.setattr(mailer_module.settings, "smtp_username", "user@gmail.com")
    monkeypatch.setattr(mailer_module.settings, "smtp_password", "abcd\xa0efgh ijkl mnop")
    monkeypatch.setattr(mailer_module.settings, "smtp_from", "user@gmail.com")
    monkeypatch.setattr(mailer_module.smtplib, "SMTP", FakeSMTP)

    await SmtpMailer().send(MailMessage(to="x@example.com", subject="s", text_body="b", purpose="email_verification"))
    assert captured["password"] == "abcdefghijklmnop"


def test_get_mailer_selects_smtp_backend(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import mailer as mailer_module

    set_mailer(None)
    monkeypatch.setattr(mailer_module.settings, "mailer_backend", "smtp")
    try:
        assert isinstance(get_mailer(), SmtpMailer)
    finally:
        set_mailer(None)
