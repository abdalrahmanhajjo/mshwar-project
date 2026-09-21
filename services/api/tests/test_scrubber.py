"""Secrets and personal data never reach logs or error reports (MSHWAR-111)."""

from __future__ import annotations

import io
import json
import logging
from collections.abc import Iterator
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.logging import JsonFormatter, ScrubbingFilter, configure_logging
from app.core.observability import scrub_breadcrumb, scrub_event
from app.core.request_context import _request_id
from app.core.scrubber import REDACTED, SENSITIVE_FIELDS, field_class, mask_email, scrub, scrub_text
from app.main import app

EMAIL = "layla.haddad@gmail.com"
CARD = "4242 4242 4242 4242"
SECRETS_IN_TEXT = {
    "email": (f"welcome {EMAIL}", EMAIL),
    "card": (f"charged card {CARD} ok", CARD),
    "stripe secret": ("key sk_live_51Habcdefghijklmn used", "sk_live_51Habcdefghijklmn"),
    "webhook secret": ("whsec_abcdefghijklmnop", "whsec_abcdefghijklmnop"),
    "payment client secret": ("pi_3Nabc_secret_XYZ123abc", "pi_3Nabc_secret_XYZ123abc"),
    "bearer token": ("Authorization: Bearer abc123def456ghi789", "abc123def456ghi789"),
    "jwt": (
        "token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N",
        "eyJzdWIiOiIxMjM0NTY3ODkwIn0",
    ),
    "password pair": ("password=hunter2-secret", "hunter2-secret"),
    "query token": ("GET /reset-password?token=abcdef123456&next=/", "abcdef123456"),
    "unsubscribe path": (
        "POST /api/v1/notifications/unsubscribe/0f3c9a5e7b1d2c4a6e8f0a1b2c3d4e5f HTTP/1.1",
        "0f3c9a5e7b1d2c4a6e8f0a1b2c3d4e5f",
    ),
    "share link path": ("GET /api/v1/groups/join/Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5", "Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5"),
    "signed file path": ("GET /api/v1/portal/files/aGVsbG8td29ybGQtc2lnbmVk.abc", "aGVsbG8td29ybGQtc2lnbmVk"),
    "international phone": ("call +961 3 123 456 today", "3 123 456"),
    "lebanese mobile": ("whatsapp 71 234 567", "71 234 567"),
}


@pytest.mark.parametrize("case", sorted(SECRETS_IN_TEXT))
def test_free_text_is_scrubbed(case: str) -> None:
    raw, secret = SECRETS_IN_TEXT[case]
    assert secret not in scrub_text(raw)


def test_ordinary_text_is_left_alone() -> None:
    for text in (
        "booking 3f2b9c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e confirmed",
        "processed 1712345678901 events in 250 ms",
        "party of 4, total_minor=9000",
        "GET /api/v1/catalogue/experiences?page=2 200",
    ):
        assert scrub_text(text) == text


def test_emails_keep_only_the_domain() -> None:
    assert mask_email(EMAIL) == "***@gmail.com"


@pytest.mark.parametrize(("label", "fields"), sorted(SENSITIVE_FIELDS.items()))
def test_every_registered_field_class_is_removed(label: str, fields: frozenset[str]) -> None:
    payload = dict.fromkeys(fields, "value-that-must-not-leak")
    cleaned = scrub(payload)
    assert all(value == REDACTED for value in cleaned.values()), label
    assert all(field_class(name) == label for name in fields)


def test_nested_structures_and_header_pairs_are_scrubbed() -> None:
    event = {
        "request": {"headers": [["Cookie", "mshwar_session=abc"], ["Accept", "json"]], "query": "token=abc123456"},
        "extra": {"user": {"email": EMAIL, "id": "u1"}, "items": [{"card_number": CARD}]},
        "token_count": 12,
    }
    cleaned = scrub(event)
    assert cleaned["request"]["headers"] == [["Cookie", REDACTED], ["Accept", "json"]]
    assert cleaned["extra"]["user"] == {"email": REDACTED, "id": "u1"}
    assert cleaned["extra"]["items"] == [{"card_number": REDACTED}]
    assert cleaned["token_count"] == 12
    assert "abc123456" not in json.dumps(cleaned)


@pytest.fixture
def captured() -> Iterator[io.StringIO]:
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.addFilter(ScrubbingFilter())
    handler.setFormatter(JsonFormatter())
    logger = logging.getLogger("mshwar.test-scrubber")
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False
    yield stream
    logger.removeHandler(handler)


def test_log_records_are_scrubbed_and_carry_the_request_id(captured: io.StringIO) -> None:
    token = _request_id.set("req-abcdef12")
    try:
        logger = logging.getLogger("mshwar.test-scrubber")
        logger.info("signin for %s", EMAIL, extra={"password": "hunter2", "payment_method": "pm_123", "rule": "x"})
        try:
            raise ValueError(f"card {CARD} declined for {EMAIL}")
        except ValueError:
            logger.exception("payment failed")
    finally:
        _request_id.reset(token)
    lines = [json.loads(line) for line in captured.getvalue().splitlines()]
    assert lines[0]["message"] == "signin for ***@gmail.com"
    assert lines[0]["password"] == REDACTED
    assert lines[0]["payment_method"] == REDACTED
    assert lines[0]["rule"] == "x"
    assert lines[0]["request_id"] == "req-abcdef12"
    assert CARD not in lines[1]["exc_info"]
    assert EMAIL not in captured.getvalue()


def test_uvicorn_access_emit_does_not_raise_after_config() -> None:
    # Regression: the scrubbing filter cleared record.args, and uvicorn's own
    # AccessFormatter unpacked args to rebuild the line, raising on every request.
    # After configure_logging routes uvicorn.access through our handler, a full
    # emit must succeed.
    configure_logging("INFO", "json")
    access = logging.getLogger("uvicorn.access")
    access.info(
        '%s - "%s %s HTTP/%s" %d',
        "10.0.0.1:1",
        "GET",
        "/health",
        "1.1",
        200,
    )  # must not raise


def test_uvicorn_access_log_lines_are_scrubbed() -> None:
    configure_logging("INFO", "json")
    access = logging.getLogger("uvicorn.access")
    assert any(isinstance(item, ScrubbingFilter) for item in access.filters)
    record = logging.LogRecord(
        "uvicorn.access",
        logging.INFO,
        __file__,
        1,
        '%s - "%s %s HTTP/%s" %d',
        ("10.0.0.1:1", "GET", "/api/v1/notifications/unsubscribe/0f3c9a5e7b1d2c4a6e8f0a1b", "1.1", 200),
        None,
    )
    for item in access.filters:
        item.filter(record)  # type: ignore[union-attr]
    assert "0f3c9a5e7b1d2c4a6e8f0a1b" not in record.getMessage()


def test_sentry_events_are_scrubbed() -> None:
    token = _request_id.set("req-sentry-1")
    try:
        event: dict[str, Any] = {
            "request": {
                "url": "https://api.mshwar.lb/api/v1/groups/join/Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5",
                "cookies": {"mshwar_session": "abc"},
                "data": {"password": "hunter2"},
                "headers": {"Authorization": "Bearer abcdefghijklmnop", "User-Agent": "Mozilla"},
                "query_string": "token=abcdefgh123",
            },
            "user": {"id": "u-1", "email": EMAIL, "ip_address": "1.2.3.4"},
            "exception": {"values": [{"value": f"no account for {EMAIL}"}]},
            "breadcrumbs": {"values": [{"message": f"card {CARD}"}]},
        }
        cleaned = scrub_event(event)
    finally:
        _request_id.reset(token)
    dumped = json.dumps(cleaned)
    for secret in (
        "hunter2",
        EMAIL,
        "abcdefghijklmnop",
        "abcdefgh123",
        "1.2.3.4",
        "Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5",
        CARD,
    ):
        assert secret not in dumped
    assert "cookies" not in cleaned["request"]
    assert cleaned["user"] == {"id": "u-1"}
    assert cleaned["tags"]["request_id"] == "req-sentry-1"


def test_init_sentry_survives_a_malformed_dsn(monkeypatch: pytest.MonkeyPatch) -> None:
    # A bad SENTRY_DSN must not crash the service: init returns False, no raise.
    from app.core import observability

    monkeypatch.setattr(observability.settings, "sentry_dsn", "https://not-a-real-dsn")
    assert observability.init_sentry() is False


def test_sentry_breadcrumbs_drop_query_strings() -> None:
    crumb = scrub_breadcrumb({"category": "httplib", "data": {"url": "https://x/y", "http.query": "token=abc"}})
    assert crumb is not None
    assert "http.query" not in crumb["data"]


@pytest.mark.asyncio
async def test_unhandled_errors_return_the_request_id_and_no_details(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.api.v1.endpoints import health

    def explode() -> str:
        raise RuntimeError(f"db password=hunter2 for {EMAIL}")

    monkeypatch.setattr(health, "prometheus_text", explode)
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        from app.core.config import settings

        monkeypatch.setattr(settings, "internal_job_token", "j" * 40)
        response = await client.get(
            "/api/v1/health/metrics", headers={"X-Job-Token": "j" * 40, "X-Request-ID": "trace-12345678"}
        )
    assert response.status_code == 500
    assert response.json() == {
        "detail": "Something went wrong. Please try again.",
        "code": "internal",
        "request_id": "trace-12345678",
    }
