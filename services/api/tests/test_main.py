from collections.abc import AsyncGenerator, Generator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_auth_db
from app.main import app


class _EmptyResult:
    def scalar_one_or_none(self) -> Any:
        return None


class _EmptySession:
    async def execute(self, *_args: Any, **_kwargs: Any) -> _EmptyResult:
        return _EmptyResult()


async def _empty_auth_db() -> AsyncGenerator[Any, None]:
    yield _EmptySession()


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    app.dependency_overrides[get_auth_db] = _empty_auth_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_auth_db, None)


def test_health_check(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_api_v1_prefix(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_identity_headers_do_not_authenticate(client: TestClient) -> None:
    response = client.get(
        "/api/v1/trips",
        headers={
            "x-user-id": "22222222-2222-2222-2222-222222222222",
            "x-organization-id": "00000000-0000-0000-0000-000000000001",
        },
    )
    assert response.status_code == 401


def test_list_and_create_trips(client: TestClient) -> None:
    listed = client.get("/api/v1/trips")
    assert listed.status_code == 401
    created = client.post("/api/v1/trips", json={"name": "Weekend"})
    assert created.status_code == 401
