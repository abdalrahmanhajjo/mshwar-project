from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.api.v1.hub_query import raise_hub_error


class _Orig:
    def __init__(self, sqlstate: str) -> None:
        self.sqlstate = sqlstate


class _Exc(Exception):
    def __init__(self, sqlstate: str) -> None:
        self.orig = _Orig(sqlstate)


def test_raise_hub_error_maps_missing_and_invalid() -> None:
    with pytest.raises(HTTPException) as missing:
        raise_hub_error(_Exc("P0002"), "Trip not found")  # type: ignore[arg-type]
    assert missing.value.status_code == 404
    with pytest.raises(HTTPException) as invalid:
        raise_hub_error(_Exc("22023"), "Trip not found")  # type: ignore[arg-type]
    assert invalid.value.status_code == 422
    with pytest.raises(HTTPException) as other:
        raise_hub_error(_Exc("99999"), "Trip not found")  # type: ignore[arg-type]
    assert other.value.status_code == 400
