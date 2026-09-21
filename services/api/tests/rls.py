"""Helpers for tests that exercise PostgreSQL row-level security policies."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def set_local_gucs(db: AsyncSession, *, user_id: str, organization_id: str, request_id: str = "") -> None:
    """Set the transaction-local GUCs the RLS policies read. SET LOCAL cannot take bind parameters."""
    await db.execute(text("SELECT set_config('app.user_id', :value, true)"), {"value": user_id})
    await db.execute(text("SELECT set_config('app.organization_id', :value, true)"), {"value": organization_id})
    if request_id:
        await db.execute(text("SELECT set_config('app.request_id', :value, true)"), {"value": request_id})
