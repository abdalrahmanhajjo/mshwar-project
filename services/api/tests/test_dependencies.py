from __future__ import annotations

import pytest

from app.dependencies import get_auth_db


@pytest.mark.asyncio
async def test_get_auth_db_yields_a_session() -> None:
    agen = get_auth_db()
    session = await agen.__anext__()
    assert session is not None
    await agen.aclose()
