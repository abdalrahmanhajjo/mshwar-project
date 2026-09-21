"""Outbox publisher. Delivery failures never write bookings or payments."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.notifications.channels import DeliveryResult, NotificationMessage, channel_for
from app.core.sql import fetch_json


def email_is_stub() -> bool:
    return not settings.smtp_host and not settings.sendgrid_api_key


async def emit_event(
    db: AsyncSession,
    event_type: str,
    aggregate_id: str,
    user_id: str | None,
    organization_id: str | None,
    payload: dict[str, Any] | None = None,
) -> Any:
    return await fetch_json(
        db,
        "SELECT app.emit_notification_event(:event, :aggregate, :user_id, :org_id, CAST(:payload AS jsonb))",
        {
            "event": event_type,
            "aggregate": aggregate_id,
            "user_id": user_id,
            "org_id": organization_id,
            "payload": json.dumps(payload or {}),
        },
    )


async def claim_batch(db: AsyncSession) -> list[dict[str, Any]]:
    rows = await fetch_json(
        db,
        "SELECT app.claim_notification_batch(:lim)",
        {"lim": settings.notification_worker_batch_size},
    )
    return list(rows or [])


async def record_outcome(
    db: AsyncSession,
    notification_id: str,
    result: DeliveryResult,
) -> Any:
    return await fetch_json(
        db,
        "SELECT app.record_notification_delivery(:id, :outcome, :code, :message, :max)",
        {
            "id": notification_id,
            "outcome": result.outcome,
            "code": result.error_code,
            "message": result.error_message,
            "max": settings.notification_max_attempts,
        },
    )


def _message_from_row(row: dict[str, Any]) -> NotificationMessage:
    return NotificationMessage(
        notification_id=str(row["id"]),
        user_id=str(row["user_id"]),
        channel=str(row["channel"]),
        category=str(row["category"]),
        event_type=str(row.get("event_type") or ""),
        title=str(row.get("title") or ""),
        body=str(row.get("body") or ""),
        deep_link=row.get("deep_link"),
        locale=str(row.get("locale") or "en"),
        to_email=row.get("email"),
        unsubscribe_token=row.get("unsubscribe_token"),
        marketing_consent=bool(row.get("marketing_consent")),
    )


async def deliver_one(db: AsyncSession, row: dict[str, Any]) -> dict[str, Any]:
    message = _message_from_row(row)
    if message.category == "marketing" and not message.marketing_consent:
        result = DeliveryResult(outcome="suppressed", error_code="marketing_opt_out")
    else:
        result = await channel_for(message.channel).deliver(message)
    recorded = await record_outcome(db, message.notification_id, result)
    return {"notification_id": message.notification_id, "result": recorded, "outcome": result.outcome}


async def dispatch(db: AsyncSession) -> dict[str, Any]:
    claimed = await claim_batch(db)
    outcomes: list[dict[str, Any]] = []
    for row in claimed:
        outcomes.append(await deliver_one(db, row))
    return {
        "processed": len(outcomes),
        "stub": email_is_stub(),
        "max_attempts": settings.notification_max_attempts,
        "outcomes": outcomes,
    }


async def escalate(db: AsyncSession) -> Any:
    return await fetch_json(db, "SELECT app.escalate_unanswered_requests(:lim)", {"lim": 50})


async def health(db: AsyncSession, admin_id: str) -> Any:
    return await fetch_json(db, "SELECT app.admin_notification_health(:admin_id)", {"admin_id": admin_id})


async def resend(db: AsyncSession, admin_id: str, notification_id: str, reason: str) -> Any:
    return await fetch_json(
        db,
        "SELECT app.admin_resend_notification(:admin_id, :id, :reason)",
        {"admin_id": admin_id, "id": notification_id, "reason": reason},
    )


async def list_admin(db: AsyncSession, admin_id: str, status: str | None, channel: str | None) -> Any:
    return await fetch_json(
        db,
        "SELECT app.admin_list_notifications(:admin_id, :status, :channel, 50)",
        {"admin_id": admin_id, "status": status, "channel": channel},
    )
