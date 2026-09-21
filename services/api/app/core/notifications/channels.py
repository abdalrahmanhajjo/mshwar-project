"""Shared channel interface. Email stubs when SMTP/provider keys are unset."""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from typing import Protocol

from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger("mshwar.notifications")


class NotificationMessage(BaseModel):
    notification_id: str
    user_id: str
    channel: str
    category: str
    event_type: str
    title: str
    body: str
    deep_link: str | None = None
    locale: str = "en"
    to_email: str | None = None
    unsubscribe_token: str | None = Field(default=None, repr=False)
    marketing_consent: bool = False


class DeliveryResult(BaseModel):
    outcome: str
    error_code: str | None = None
    error_message: str | None = None


class NotificationChannel(Protocol):
    name: str

    async def deliver(self, message: NotificationMessage) -> DeliveryResult: ...


class InAppChannel:
    name = "in_app"

    async def deliver(self, message: NotificationMessage) -> DeliveryResult:
        # Persistence happens in SQL at enqueue time. The worker records the attempt.
        return DeliveryResult(outcome="sent")


class StubEmailChannel:
    """Used when SMTP_HOST and SENDGRID_API_KEY are both empty."""

    name = "email"

    def __init__(self) -> None:
        self.sent: list[NotificationMessage] = []

    async def deliver(self, message: NotificationMessage) -> DeliveryResult:
        self.sent.append(message)
        logger.info(
            "stub email dispatched event=%s category=%s locale=%s",
            message.event_type,
            message.category,
            message.locale,
        )
        return DeliveryResult(outcome="stubbed")


class SmtpEmailChannel:
    name = "email"

    async def deliver(self, message: NotificationMessage) -> DeliveryResult:
        if not message.to_email:
            return DeliveryResult(outcome="failed", error_code="missing_recipient", error_message="no email")
        payload = EmailMessage()
        payload["To"] = message.to_email
        payload["From"] = settings.smtp_from
        payload["Subject"] = message.title
        body = message.body
        if message.category == "marketing" and message.unsubscribe_token:
            body = f"{body}\n\nUnsubscribe: {settings.public_web_origin}/unsubscribe/{message.unsubscribe_token}"
        payload.set_content(body)
        try:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as client:
                if settings.smtp_username:
                    client.starttls()
                    client.login(settings.smtp_username, settings.smtp_password)
                client.send_message(payload)
        except (OSError, smtplib.SMTPException) as exc:
            return DeliveryResult(outcome="failed", error_code="smtp_error", error_message=str(exc)[:400])
        return DeliveryResult(outcome="sent")


def email_channel() -> NotificationChannel:
    if settings.smtp_host:
        return SmtpEmailChannel()
    return StubEmailChannel()


def channel_for(name: str) -> NotificationChannel:
    if name == "in_app":
        return InAppChannel()
    return email_channel()
