from collections.abc import AsyncGenerator

from sqlalchemy import Connection, event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.request_context import current_request_id

engine = create_async_engine(
    settings.database_url,
    echo=settings.sql_echo,
    pool_size=settings.pool_size,
    max_overflow=settings.max_overflow,
    pool_recycle=settings.pool_recycle,
    pool_pre_ping=settings.pool_pre_ping,
    connect_args={
        "timeout": settings.connect_timeout,
        "server_settings": {"statement_timeout": str(settings.statement_timeout_ms)},
    },
)


class AppSession(Session):
    """Sync session class behind every request's AsyncSession (carries the event hooks below)."""


async_session = async_sessionmaker(engine, class_=AsyncSession, sync_session_class=AppSession, expire_on_commit=False)


async def get_auth_db() -> AsyncGenerator[AsyncSession, None]:
    """One transaction per request, committed when the handler returns normally.

    Authorization is enforced by the SECURITY DEFINER functions the routers call,
    which receive the signed-in user id explicitly.
    """
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@event.listens_for(AppSession, "after_begin")
def bind_request_id(session: Session, transaction: object, connection: Connection) -> None:
    """Expose the correlation id to the function layer (audit rows read app.request_id).

    Runs on the transaction's own connection as it begins, so it costs nothing
    for requests that never touch the database.
    """
    request_id = current_request_id()
    if request_id:
        connection.execute(text("SELECT set_config('app.request_id', :rid, true)"), {"rid": request_id})


async def bind_actor(session: AsyncSession, user_id: object) -> None:
    """Expose the signed-in account to the function layer (audit trigger reads app.actor_id)."""
    await session.execute(text("SELECT set_config('app.actor_id', :uid, true)"), {"uid": str(user_id)})
