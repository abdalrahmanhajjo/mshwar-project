"""Mailer abstraction. Console in development; notification service later.

The notification worker is not wired yet. ``NotificationMailer`` is the
plug-in surface that will enqueue ``app.notifications`` / ``app.outbox``.
Never log reset tokens or plaintext passwords.
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage
from typing import Protocol

from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger("mshwar.mailer")


class MailMessage(BaseModel):
    to: str
    subject: str
    text_body: str
    purpose: str
    html_body: str | None = None
    token: str | None = Field(default=None, repr=False)


class Mailer(Protocol):
    async def send(self, message: MailMessage) -> None: ...


class ConsoleMailer:
    """Dev backend: records intent without printing secrets."""

    async def send(self, message: MailMessage) -> None:
        logger.info(
            "console mailer dispatched purpose=%s to_domain=%s",
            message.purpose,
            _email_domain(message.to),
        )


class NotificationMailer:
    """Future notification-service adapter. Safe no-op until the worker exists."""

    async def send(self, message: MailMessage) -> None:
        logger.info(
            "notification mailer queued purpose=%s to_domain=%s",
            message.purpose,
            _email_domain(message.to),
        )


class SmtpMailer:
    """Sends real email over SMTP using the smtp_* settings.

    STARTTLS on the usual submission port (587); implicit TLS on 465. The
    blocking smtplib work runs in a worker thread so ``send`` stays async.
    Delivery failures raise, so the caller can log and continue rather than
    losing the intent silently.
    """

    async def send(self, message: MailMessage) -> None:
        await asyncio.to_thread(self._send_blocking, message)

    def _send_blocking(self, message: MailMessage) -> None:
        email = EmailMessage()
        email["From"] = settings.smtp_from
        email["To"] = message.to
        email["Subject"] = message.subject
        email.set_content(message.text_body)
        if message.html_body:
            email.add_alternative(message.html_body, subtype="html")

        context = ssl.create_default_context()
        if settings.smtp_port == 465:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=context, timeout=15) as client:
                self._authenticate(client)
                client.send_message(email)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as client:
                client.starttls(context=context)
                self._authenticate(client)
                client.send_message(email)
        logger.info("smtp mailer sent purpose=%s to_domain=%s", message.purpose, _email_domain(message.to))

    @staticmethod
    def _authenticate(client: smtplib.SMTP) -> None:
        if settings.smtp_username:
            # App passwords are shown grouped ("xxxx xxxx xxxx xxxx") and are often
            # pasted with spaces -- including non-breaking ones -- which smtplib
            # cannot ASCII-encode. Strip all whitespace before login.
            username = "".join(settings.smtp_username.split())
            password = "".join(settings.smtp_password.split())
            client.login(username, password)


class RecordingMailer:
    """In-memory sink for tests. Tokens stay off logs via Field(repr=False)."""

    def __init__(self) -> None:
        self.messages: list[MailMessage] = []

    async def send(self, message: MailMessage) -> None:
        self.messages.append(message)

    def reset_tokens_for(self, email: str) -> list[str]:
        return [msg.token for msg in self.messages if msg.to == email and msg.purpose == "password_reset" and msg.token]

    def verification_tokens_for(self, email: str) -> list[str]:
        return [
            msg.token for msg in self.messages if msg.to == email and msg.purpose == "email_verification" and msg.token
        ]


def _email_domain(address: str) -> str:
    if "@" not in address:
        return "unknown"
    return address.rsplit("@", 1)[1]


_mailer: Mailer | None = None


_BACKENDS: dict[str, type[Mailer]] = {
    "smtp": SmtpMailer,
    "notification": NotificationMailer,
    "console": ConsoleMailer,
}


def get_mailer() -> Mailer:
    global _mailer
    if _mailer is None:
        _mailer = _BACKENDS.get(settings.mailer_backend, ConsoleMailer)()
    return _mailer


def set_mailer(mailer: Mailer | None) -> None:
    global _mailer
    _mailer = mailer
