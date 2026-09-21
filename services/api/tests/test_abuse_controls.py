"""Rate limits, AI cost ceilings (MSHWAR-110) and upload hardening (MSHWAR-112)."""

from __future__ import annotations

import struct
from collections.abc import AsyncGenerator, Iterator
from pathlib import Path
from typing import Any
from uuid import uuid4

import httpx
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core import imagekit, rate_limit
from app.core.config import settings
from app.core.media_inspect import UnsafeUpload, inspect_upload
from app.core.rate_limit import Allowance, MemoryRateLimiter, RedisRateLimiter, Rule
from app.main import app
from app.schemas.catalogue import public_image
from tests.conftest import TestingSessionLocal
from tests.media_fixtures import b64, tiny_jpeg, tiny_pdf, tiny_png

JOB = "j" * 40


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _register(client: AsyncClient, prefix: str = "abuse") -> dict[str, Any]:
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "accept_terms": True,
            "email": f"{prefix}-{uuid4().hex[:10]}@example.com",
            "password": "long-enough-secret",
            "display_name": "Nour",
            "locale": "en",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
async def anonymous() -> AsyncGenerator[AsyncClient, None]:
    async with _client() as client:
        yield client


def _override_rules(monkeypatch: pytest.MonkeyPatch, **rules: Rule) -> None:
    original = rate_limit._rules
    monkeypatch.setattr(rate_limit, "_rules", lambda: {**original(), **rules})


# ---- rate limiting -----------------------------------------------------------------


@pytest.mark.asyncio
async def test_search_allowance_depends_on_sign_in_state(
    anonymous: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _override_rules(monkeypatch, search=Rule("search", Allowance(2, 60), Allowance(4, 60), "test"))
    statuses = [(await anonymous.get("/api/v1/catalogue/search", params={"q": "byblos"})).status_code for _ in range(3)]
    assert statuses == [200, 200, 429]
    blocked = await anonymous.get("/api/v1/catalogue/search", params={"q": "byblos"})
    assert blocked.json()["code"] == "rate_limited"
    assert 0 < int(blocked.headers["retry-after"]) <= 60
    assert blocked.headers["ratelimit-limit"] == "2"

    async with _client() as member:
        await _register(member)
        member_statuses = [
            (await member.get("/api/v1/catalogue/search", params={"q": "byblos"})).status_code for _ in range(5)
        ]
    assert member_statuses == [200, 200, 200, 200, 429]


@pytest.mark.asyncio
async def test_ai_routes_are_limited(monkeypatch: pytest.MonkeyPatch) -> None:
    _override_rules(
        monkeypatch,
        **{
            "ai-generate": Rule("ai-generate", None, Allowance(1, 600), "test"),
        },
    )
    async with _client() as member:
        await _register(member)
        first = await member.post("/api/v1/planner/sessions", json={"text": "a slow day in Byblos", "locale": "en"})
        assert first.status_code == 200, first.text
        second = await member.post("/api/v1/planner/sessions", json={"text": "a slow day in Byblos", "locale": "en"})
        assert second.status_code == 429


@pytest.mark.asyncio
async def test_signin_limit_response_does_not_reveal_the_account(
    anonymous: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "signin_email_limit", 1)
    known = await _register(anonymous)
    for email in (known["email"], f"nobody-{uuid4().hex[:6]}@example.com"):
        await anonymous.post("/api/v1/auth/signin", json={"email": email, "password": "wrong-password-1"})
        blocked = await anonymous.post("/api/v1/auth/signin", json={"email": email, "password": "wrong-password-1"})
        assert blocked.status_code == 429
        assert blocked.json()["detail"] == rate_limit.RATE_LIMITED_DETAIL


def test_memory_limiter_reports_retry_after() -> None:
    limiter = MemoryRateLimiter()
    assert limiter.check("k", 1, 30, now=100.0).allowed
    blocked = limiter.check("k", 1, 30, now=110.0)
    assert not blocked.allowed
    assert blocked.retry_after == 20


@pytest.fixture
def redis_url() -> Iterator[str]:
    import redis

    url = "redis://localhost:6379/15"
    try:
        redis.Redis.from_url(url, socket_connect_timeout=0.5).ping()
    except redis.exceptions.RedisError:
        pytest.skip("Redis is not available")
    yield url
    redis.Redis.from_url(url).flushdb()


@pytest.mark.asyncio
async def test_redis_store_is_shared_between_workers(redis_url: str) -> None:
    worker_a = RedisRateLimiter(redis_url, MemoryRateLimiter(), prefix=f"test:{uuid4().hex}:")
    worker_b = RedisRateLimiter(redis_url, MemoryRateLimiter(), prefix=worker_a._prefix)
    assert (await worker_a.hit("signin", 2, 60)).allowed
    assert (await worker_b.hit("signin", 2, 60)).allowed
    blocked = await worker_a.hit("signin", 2, 60)
    assert not blocked.allowed
    assert 0 < blocked.retry_after <= 60


@pytest.mark.asyncio
async def test_redis_outage_falls_back_to_process_limits() -> None:
    fallback = MemoryRateLimiter()
    store = RedisRateLimiter("redis://localhost:1/0", fallback)
    failures = rate_limit.metrics.store_failures
    assert (await store.hit("k", 1, 60)).allowed
    assert not (await store.hit("k", 1, 60)).allowed  # the fallback still counts
    assert rate_limit.metrics.store_failures == failures + 1  # retried only after a back-off


def test_rate_limit_store_follows_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "rate_limit_store", "redis")
    assert isinstance(rate_limit.build_store(), RedisRateLimiter)
    monkeypatch.setattr(settings, "rate_limit_store", "memory")
    assert isinstance(rate_limit.build_store(), MemoryRateLimiter)


@pytest.mark.asyncio
async def test_rate_limit_metrics_are_exported(anonymous: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "internal_job_token", JOB)
    monkeypatch.setattr(settings, "enable_dev_endpoints", False)
    _override_rules(monkeypatch, search=Rule("search", Allowance(1, 60), Allowance(1, 60), "test"))
    for _ in range(2):
        await anonymous.get("/api/v1/catalogue/search", params={"q": "tyre"})
    assert (await anonymous.get("/api/v1/health/metrics")).status_code == 401
    exported = await anonymous.get("/api/v1/health/metrics", headers={"X-Job-Token": JOB})
    assert exported.status_code == 200
    assert 'mshwar_rate_limit_rejections_total{rule="search"} 1' in exported.text
    assert 'mshwar_rate_limit_checks_total{rule="search"} 2' in exported.text


def test_every_rule_has_a_documented_allowance() -> None:
    doc = (Path(__file__).resolve().parents[3] / "docs" / "security" / "rate-limits.md").read_text()
    for name, rule in rate_limit.RULES.items():
        assert rule.anonymous or rule.signed_in
        assert f"`{name}`" in doc, f"document the {name} rule in docs/security/rate-limits.md"


# ---- AI cost ceiling ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_ai_generation_stops_at_the_daily_ceiling(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ai_request_cost_usd", 0.01)
    monkeypatch.setattr(settings, "ai_user_daily_budget_usd", 0.02)
    async with _client() as member:
        await _register(member, "ceiling")
        quota = (await member.get("/api/v1/planner/quota")).json()
        assert quota["remaining_requests"] == 2
        for _ in range(2):
            ok = await member.post("/api/v1/planner/sessions", json={"text": "coast day in Batroun", "locale": "en"})
            assert ok.status_code == 200, ok.text
        over = await member.post("/api/v1/planner/sessions", json={"text": "coast day in Batroun", "locale": "en"})
        assert over.status_code == 429
        assert over.json()["code"] == "ai_quota_exceeded"
        assert "midnight" in over.json()["detail"]
        assert 0 < int(over.headers["retry-after"]) <= 24 * 3600
        quota = (await member.get("/api/v1/planner/quota")).json()
        assert quota == {**quota, "remaining_requests": 0, "requests_today": 2}
        # Other planner reads keep working.
        assert (await member.get("/api/v1/planner/thresholds")).status_code == 200


@pytest.mark.asyncio
async def test_platform_ceiling_protects_total_spend(monkeypatch: pytest.MonkeyPatch) -> None:
    async with TestingSessionLocal() as session:
        spent = (
            await session.execute(
                text(
                    "SELECT coalesce(max(cost_micros), 0) FROM app.ai_usage_global WHERE usage_date = app.ai_budget_day()"
                )
            )
        ).scalar_one()
    monkeypatch.setattr(settings, "ai_request_cost_usd", 0.01)
    monkeypatch.setattr(settings, "ai_user_daily_budget_usd", 0)
    monkeypatch.setattr(settings, "ai_global_daily_budget_usd", (spent + 10_000) / 1_000_000)
    async with _client() as first, _client() as second:
        await _register(first, "global-a")
        await _register(second, "global-b")
        assert (await first.post("/api/v1/planner/sessions", json={"text": "Jbeil", "locale": "en"})).status_code == 200
        blocked = await second.post("/api/v1/planner/sessions", json={"text": "Jbeil", "locale": "en"})
    assert blocked.status_code == 429
    assert blocked.json()["code"] == "ai_capacity_reached"


# ---- upload content checks ----------------------------------------------------------


def _webp_vp8x(width: int, height: int) -> bytes:
    payload = b"\x00\x00\x00\x00" + (width - 1).to_bytes(3, "little") + (height - 1).to_bytes(3, "little")
    return b"RIFF" + struct.pack("<I", 4 + 8 + len(payload)) + b"WEBP" + b"VP8X" + struct.pack("<I", 10) + payload


@pytest.mark.parametrize(
    ("data", "content_type", "size"),
    [
        (tiny_png(640, 480), "image/png", (640, 480)),
        (tiny_jpeg(1200, 800), "image/jpeg", (1200, 800)),
        (_webp_vp8x(300, 200), "image/webp", (300, 200)),
    ],
)
def test_images_are_measured_from_their_headers(data: bytes, content_type: str, size: tuple[int, int]) -> None:
    inspected = inspect_upload(data, content_type, 40_000_000)
    assert (inspected.width, inspected.height) == size


@pytest.mark.parametrize(
    ("data", "content_type", "reason"),
    [
        (tiny_png(12_000, 12_000), "image/png", "dimensions"),  # decompression bomb
        (tiny_png(0, 10), "image/png", "dimensions"),
        (b"\x89PNG\r\n\x1a\n" + b"\x00" * 30, "image/png", "not a PNG"),
        (b"\xff\xd8\xff\xe0<html>", "image/jpeg", "JPEG"),
        (tiny_jpeg() + b"<script>alert(1)</script>", "image/jpeg", "markup"),
        (tiny_pdf(b"<< /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>"), "application/pdf", "active content"),
        (tiny_pdf(b"<< /Type /EmbeddedFile >>"), "application/pdf", "active content"),
        (b"%PDF-1.4 no end", "application/pdf", "truncated"),
        (b"%PDX-1.4\n%%EOF", "application/pdf", "not a PDF"),
    ],
)
def test_unsafe_files_are_rejected(data: bytes, content_type: str, reason: str) -> None:
    with pytest.raises(UnsafeUpload, match=reason):
        inspect_upload(data, content_type, 40_000_000)


# ---- upload flow ---------------------------------------------------------------------


class FakeImageKit(imagekit.ImageKitClient):
    def __init__(self, fail: bool = False) -> None:
        self.requests: list[httpx.Request] = []
        self.deleted: list[str] = []
        self.paths: list[str] = []

        def handler(request: httpx.Request) -> httpx.Response:
            self.requests.append(request)
            if request.method == "DELETE":
                self.deleted.append(request.url.path.rsplit("/", 1)[-1])
                return httpx.Response(204)
            if fail:
                return httpx.Response(500, json={"message": "boom"})
            name = f"{uuid4().hex}.jpg"
            self.paths.append(f"listings/org/exp/{name}")
            return httpx.Response(
                200,
                json={
                    "fileId": "file_123",
                    "filePath": f"/listings/org/exp/{name}",
                    "url": f"https://ik.imagekit.io/mshwar/listings/org/exp/{name}",
                    "width": 2,
                    "height": 2,
                },
            )

        super().__init__(transport=httpx.MockTransport(handler))


def _image_upload(business: dict[str, Any], data: bytes | None = None) -> dict[str, Any]:
    return {
        "filename": "hero.jpg",
        "content_type": "image/jpeg",
        "content_base64": b64(data or tiny_jpeg()),
        "purpose": "listing",
        "experience_id": business["experience"],
        "alt_text": "Table by the window",
    }


def _files(root: Path) -> list[Path]:
    return [path for path in root.rglob("*") if path.is_file()]


def test_catalogue_images_resolve_to_imagekit(monkeypatch: pytest.MonkeyPatch) -> None:
    assert public_image("experiences/x/image-1.jpg") == "experiences/x/image-1.jpg"
    monkeypatch.setattr(settings, "imagekit_api_key", "k")
    monkeypatch.setattr(settings, "imagekit_url", "https://ik.imagekit.io/mshwar/")
    assert public_image("experiences/x/image 1.jpg") == "https://ik.imagekit.io/mshwar/experiences/x/image%201.jpg"
    assert public_image("https://images.unsplash.com/p.jpg") == "https://images.unsplash.com/p.jpg"
    assert public_image(None) is None
