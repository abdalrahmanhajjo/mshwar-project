"""Calling the PostgreSQL function layer and mapping its errors to HTTP.

Business rules live in SECURITY DEFINER functions (see mshwar-database/migrations).
Those functions raise with explicit SQLSTATEs; anything else is an internal error
and must not leak database details to clients.
"""

from __future__ import annotations

import logging
from typing import Any, NoReturn

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.http_status import HTTP_413_CONTENT_TOO_LARGE, HTTP_422_UNPROCESSABLE
from app.core.observability import report_exception

FORBIDDEN = "You don't have permission to do that."
INTERNAL = "Something went wrong. Please try again."

logger = logging.getLogger("mshwar.sql")

# SQLSTATEs raised on purpose by the function layer, with client-safe messages.
_DOMAIN_STATUS = {
    "42501": status.HTTP_403_FORBIDDEN,  # capability / ownership denied
    "P0002": status.HTTP_404_NOT_FOUND,  # record not found (or not visible)
    "22023": HTTP_422_UNPROCESSABLE,  # invalid parameter
    "P0001": HTTP_422_UNPROCESSABLE,  # plain RAISE EXCEPTION: business rule
    "53400": HTTP_413_CONTENT_TOO_LARGE,  # quota or count limit reached
}
# 42501 messages that are authorisation decisions (as opposed to business rules
# such as "trip is locked"). Their text names internal capabilities, so the
# client gets one fixed message instead. tests/test_access_policies.py checks
# that every 42501 message in the migrations is classified.
AUTHZ_DENIAL_PREFIXES = (
    "capability denied",
    "not a member",
    "admin role required",
    "elevated admin permission required",
    "group permission denied",
    "not authenticated",
    "permission denied",
)
_CONFLICT_STATES = frozenset({"23505", "23P01"})
_UNAVAILABLE_STATES = frozenset({"57014", "40001", "40P01", "55P03"})  # timeout, serialization, deadlock, lock
_RAW_CONSTRAINT_PREFIXES = ("duplicate key value", "conflicting key value", "new row for relation", "null value in")


def db_error_parts(exc: object) -> tuple[str | None, str]:
    """Return (sqlstate, message) for SQLAlchemy-wrapped psycopg or asyncpg errors."""
    orig = getattr(exc, "orig", None) or exc
    cause = getattr(orig, "__cause__", None)
    sqlstate = getattr(orig, "sqlstate", None) or getattr(orig, "pgcode", None) or getattr(cause, "sqlstate", None)
    message = (
        getattr(getattr(orig, "diag", None), "message_primary", None)
        or getattr(cause, "message", None)
        or getattr(orig, "message", None)
    )
    if not message:
        rendered = str(orig)
        # asyncpg adapter renders "<class 'asyncpg.exceptions.X'>: message"
        message = rendered.split(": ", 1)[1] if rendered.startswith("<class ") and ": " in rendered else rendered
    return (str(sqlstate) if sqlstate else None), str(message)


def raise_from_db(exc: object) -> NoReturn:
    sqlstate, message = db_error_parts(exc)
    cause = exc if isinstance(exc, BaseException) else None
    raw_constraint = message.lower().startswith(_RAW_CONSTRAINT_PREFIXES)
    if sqlstate == "42501" and message.lower().startswith(AUTHZ_DENIAL_PREFIXES):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=FORBIDDEN) from cause
    if sqlstate in _DOMAIN_STATUS:
        raise HTTPException(status_code=_DOMAIN_STATUS[sqlstate], detail=message) from cause
    if sqlstate in _CONFLICT_STATES:
        detail = "Conflicts with an existing record" if raw_constraint else message
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from cause
    if sqlstate and sqlstate.startswith(("22", "23")):
        detail = "Invalid data" if raw_constraint or sqlstate.startswith("22") else message
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail=detail) from cause
    if sqlstate in _UNAVAILABLE_STATES:
        logger.warning("database busy sqlstate=%s", sqlstate)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Please try again") from cause
    logger.error("unexpected database error sqlstate=%s", sqlstate, exc_info=cause)
    if cause is not None:
        report_exception(cause)
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=INTERNAL) from cause


async def fetch_json(db: AsyncSession, sql: str, params: dict[str, Any]) -> Any:
    """Run a single-value query (usually a jsonb-returning function) and return the value."""
    try:
        result = await db.execute(text(sql), params)
        return result.scalar_one_or_none()
    except DBAPIError as exc:
        raise_from_db(exc)
