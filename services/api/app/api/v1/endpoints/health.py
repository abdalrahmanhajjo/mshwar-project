from fastapi import APIRouter, Depends, Response, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import access
from app.core.rate_limit import prometheus_text
from app.dependencies import get_auth_db

router = APIRouter()


@router.get("", dependencies=[access.PUBLIC])
async def health(
    response: Response,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, str]:
    """Readiness: reports whether the database answers."""
    try:
        await db.execute(text("SELECT 1"))
    except (SQLAlchemyError, OSError):
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "degraded", "database": "unavailable"}
    return {"status": "ok", "database": "ok"}


@router.get("/metrics", response_class=PlainTextResponse, dependencies=[access.JOB])
async def metrics() -> str:
    """Prometheus text for the scraper (job token): rate-limit checks, rejections, store failures."""
    return prometheus_text()
