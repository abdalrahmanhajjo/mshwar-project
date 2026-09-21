from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api_router import router as api_router
from app.core import access
from app.core.config import settings
from app.core.csrf import CrossSiteRequestGuard
from app.core.db_role import check_database_role
from app.core.errors import install_error_handlers
from app.core.logging import configure_logging
from app.core.observability import init_sentry
from app.core.request_context import RequestContextMiddleware
from app.dependencies import engine

configure_logging(settings.log_level, settings.log_format)
init_sentry()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    if settings.is_deployed:
        await check_database_role(engine)
    yield


app = FastAPI(
    title=settings.project_name,
    version=settings.version,
    description="Mshwar AI-Powered Lebanon Trip & Experience Platform API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "Retry-After"],
)
# Refuses cookie-carrying writes from other sites (inside the request-id middleware).
app.add_middleware(CrossSiteRequestGuard)
# Outermost, so the id exists for CORS rejections and error handlers too.
app.add_middleware(RequestContextMiddleware)
install_error_handlers(app)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health", dependencies=[access.PUBLIC])
async def health_check() -> dict[str, str]:
    """Liveness: the process is up. Readiness (database) is /api/v1/health."""
    return {"status": "healthy", "service": "mshwar-api"}


# Refuse to start if any route lacks an access policy (MSHWAR-108).
access.verify_route_policies(app)
