import os
from collections.abc import AsyncGenerator, Iterator

# Test-session defaults. Must be set before app.core.config builds the settings singleton.
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("ENABLE_DEV_ENDPOINTS", "true")

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.rate_limit import reset_all as reset_rate_limits

# The API connects with DATABASE_URL: in CI that is mshwar_api, a plain member of
# mshwar_backend, so row-level security and grants apply exactly as in production.
# Fixtures that seed or inspect tables directly use TEST_ADMIN_DATABASE_URL (the
# migration owner) instead; it falls back to DATABASE_URL for a single-role setup.
ADMIN_DATABASE_URL = os.environ.get("TEST_ADMIN_DATABASE_URL") or settings.database_url

test_engine = create_async_engine(
    ADMIN_DATABASE_URL,
    echo=settings.sql_echo,
    pool_size=5,
    max_overflow=10,
    pool_recycle=1800,
    pool_pre_ping=True,
)
TestingSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(autouse=True)
def _fresh_rate_limits() -> Iterator[None]:
    reset_rate_limits()
    yield
    reset_rate_limits()


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with TestingSessionLocal() as session:
        yield session
        await session.rollback()
