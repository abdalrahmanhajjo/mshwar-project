"""Refuse to serve real traffic from a database role that bypasses row-level security.

Row-level security and the table grants in mshwar-database/migrations are a
second line of defence behind the access policies. They only apply when the
API connects as a plain member of ``mshwar_backend`` (see
docs/security/database-roles.md). A superuser or BYPASSRLS login silently
switches them off, so staging and production stop at start-up instead.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.config import settings

logger = logging.getLogger("mshwar.db_role")


class UnsafeDatabaseRole(RuntimeError):
    pass


def problems_with(privileges: dict[str, Any]) -> list[str]:
    problems = []
    if privileges.get("superuser"):
        problems.append("is a superuser")
    if privileges.get("bypass_rls"):
        problems.append("has BYPASSRLS")
    if not privileges.get("backend_member"):
        problems.append("is not a member of mshwar_backend")
    return problems


async def check_database_role(engine: AsyncEngine) -> dict[str, Any]:
    async with engine.connect() as connection:
        privileges = (await connection.execute(text("SELECT app.connection_privileges()"))).scalar_one()
    problems = problems_with(privileges)
    if problems:
        message = f"database role {privileges.get('role')!r} " + " and ".join(problems)
        if settings.is_deployed:
            raise UnsafeDatabaseRole(
                f"{message}; connect the API as a login role that is a plain member of mshwar_backend"
            )
        logger.warning("%s; row-level security is not enforced for this process", message)
    return dict(privileges)
