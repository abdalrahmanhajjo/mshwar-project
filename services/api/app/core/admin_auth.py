from __future__ import annotations

from typing import Any

from fastapi import Request
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_session import require_session
from app.core.client_ip import client_ip
from app.core.sql import raise_from_db


async def lookup_admin_tier(db: AsyncSession, user_id: object) -> str | None:
    result = await db.execute(text("SELECT app.admin_tier(:user_id)"), {"user_id": str(user_id)})
    return result.scalar_one_or_none()


async def touch_admin_session(request: Request, db: AsyncSession, session: dict[str, Any]) -> Any:
    try:
        result = await db.execute(
            text("SELECT app.touch_admin_session(:user_id, :session_id, :ip, :user_agent)"),
            {
                "user_id": str(session["user_id"]),
                "session_id": str(session.get("session_id")) if session.get("session_id") else None,
                "ip": client_ip(request),
                "user_agent": (request.headers.get("user-agent") or "")[:300],
            },
        )
        return result.scalar_one_or_none()
    except DBAPIError as exc:
        raise_from_db(exc)
        raise


async def require_admin(
    request: Request,
    db: AsyncSession,
    *,
    elevated: bool = False,
) -> dict[str, Any]:
    checked: dict[str, Any] | None = getattr(request.state, "admin_session", None)
    if checked is not None and (not elevated or checked.get("admin_elevated")):
        return dict(checked)
    session = await require_session(request, db)
    try:
        result = await db.execute(
            text("SELECT app.require_admin(:user_id, :elevated)"),
            {"user_id": str(session["user_id"]), "elevated": elevated},
        )
        session["admin_tier"] = result.scalar_one()
    except DBAPIError as exc:
        raise_from_db(exc)
        raise
    session["admin_elevated"] = elevated
    if checked is None:
        await touch_admin_session(request, db, session)
    request.state.admin_session = dict(session)
    return session


async def close_admin_sessions(db: AsyncSession, user_id: object) -> None:
    await db.execute(text("SELECT app.close_admin_sessions(:user_id)"), {"user_id": str(user_id)})
