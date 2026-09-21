"""Daily AI generation ceilings (MSHWAR-110).

Every generation request (new plan, clarify, refine, regenerate) is charged
AI_REQUEST_COST_USD before the model runs, against the traveller's day and the
platform's day (Asia/Beirut calendar). The charge commits in its own short
transaction so concurrent generations never wait on each other, and it stands
even if the generation later fails - retries are not free.
"""

from __future__ import annotations

import math
from datetime import UTC, datetime
from typing import Any

from fastapi import Depends, Request, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_session import require_session
from app.core.config import settings
from app.core.errors import ApiError
from app.core.rate_limit import metrics
from app.dependencies import async_session, get_auth_db

USER_LIMIT_DETAIL = "You've reached today's AI planning limit. It resets at midnight Beirut time."
PLATFORM_LIMIT_DETAIL = "AI planning is busy right now. Please try again later."


def _micros(usd: float) -> int:
    return max(int(round(usd * 1_000_000)), 0)


def _retry_after(resets_at: object) -> int:
    try:
        reset = datetime.fromisoformat(str(resets_at))
    except ValueError:
        return 3600
    return max(1, math.ceil((reset - datetime.now(UTC)).total_seconds()))


async def charge_generation(user_id: str) -> dict[str, Any]:
    async with async_session() as session:
        result = (
            await session.execute(
                text("SELECT app.consume_ai_budget(:user_id, :cost, :user_limit, :global_limit)"),
                {
                    "user_id": user_id,
                    "cost": _micros(settings.ai_request_cost_usd),
                    "user_limit": _micros(settings.ai_user_daily_budget_usd),
                    "global_limit": _micros(settings.ai_global_daily_budget_usd),
                },
            )
        ).scalar_one()
        await session.commit()
    decision: dict[str, Any] = dict(result)
    if decision.get("allowed"):
        return decision
    scope = decision.get("scope")
    metrics.rejections[f"ai-budget-{scope}"] += 1
    retry_after = str(_retry_after(decision.get("resets_at")))
    if scope == "platform":
        raise ApiError(
            status.HTTP_429_TOO_MANY_REQUESTS,
            PLATFORM_LIMIT_DETAIL,
            "ai_capacity_reached",
            headers={"Retry-After": retry_after},
        )
    raise ApiError(
        status.HTTP_429_TOO_MANY_REQUESTS,
        USER_LIMIT_DETAIL,
        "ai_quota_exceeded",
        headers={"Retry-After": retry_after},
    )


async def _ai_budget(request: Request, db: AsyncSession = Depends(get_auth_db)) -> None:  # noqa: B008
    session = await require_session(request, db)
    await charge_generation(str(session["user_id"]))


AI_BUDGET = Depends(_ai_budget)


async def budget_status(db: AsyncSession, user_id: str) -> dict[str, Any]:
    row = (
        await db.execute(
            text("SELECT app.ai_budget_status(:user_id, :limit)"),
            {"user_id": user_id, "limit": _micros(settings.ai_user_daily_budget_usd)},
        )
    ).scalar_one()
    status_row: dict[str, Any] = dict(row)
    cost = _micros(settings.ai_request_cost_usd)
    limit = int(status_row.get("limit_micros") or 0)
    used = int(status_row.get("used_micros") or 0)
    return {
        "requests_today": int(status_row.get("requests") or 0),
        "remaining_requests": None if limit <= 0 or cost <= 0 else max((limit - used) // cost, 0),
        "resets_at": status_row.get("resets_at"),
    }
