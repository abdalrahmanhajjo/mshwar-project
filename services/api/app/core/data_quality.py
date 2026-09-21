"""Data-quality check runner.

Scheduled execution is opt-in via DATA_QUALITY_SCHEDULER_ENABLED. The
default is off so API processes (and pytest) do not start a background
loop. Operators can cron POST /api/v1/admin/quality/run.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.sql import fetch_json


def scheduler_enabled() -> bool:
    return bool(settings.data_quality_scheduler_enabled)


async def run_checks(db: AsyncSession, admin_id: str, *, notify: bool = True) -> Any:
    return await fetch_json(
        db,
        "SELECT app.run_data_quality_checks(:admin_id, :notify)",
        {"admin_id": admin_id, "notify": notify},
    )


def scheduler_status() -> dict[str, Any]:
    return {
        "enabled": scheduler_enabled(),
        "stale_days": settings.data_quality_stale_days,
        "trigger": "POST /api/v1/admin/quality/run",
        "provider": "sql-rules",
    }
