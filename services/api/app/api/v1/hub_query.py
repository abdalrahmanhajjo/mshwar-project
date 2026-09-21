from __future__ import annotations

from fastapi import HTTPException, Query, status
from sqlalchemy.exc import DBAPIError

from app.core.http_status import HTTP_422_UNPROCESSABLE


def page_args(
    page: int = Query(1, ge=1),
    page_size: int = Query(6, ge=1, le=24),
) -> tuple[int, int, int]:
    return page, page_size, (page - 1) * page_size


def raise_hub_error(exc: DBAPIError, missing: str) -> None:
    orig = getattr(exc, "orig", None)
    sqlstate = str(
        getattr(orig, "sqlstate", None) or getattr(orig, "pgcode", None) or getattr(exc, "sqlstate", "") or ""
    )
    if sqlstate == "P0002" or "not found" in str(orig or exc).lower():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=missing) from exc
    if sqlstate == "22023":
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="Invalid request") from exc
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not update record") from exc
