"""Error reporting to Sentry (MSHWAR-111). Off unless SENTRY_DSN is set.

``before_send`` runs every event through the shared scrubber, drops cookies and
request bodies outright, keeps only the user id, and tags the correlation id,
so an error report never carries a token, a card reference or a personal record.
"""

from __future__ import annotations

import logging
from typing import Any

from app.core.config import settings
from app.core.request_context import current_request_id
from app.core.scrubber import REDACTED, scrub

logger = logging.getLogger("mshwar.observability")


def scrub_event(event: dict[str, Any], hint: dict[str, Any] | None = None) -> dict[str, Any]:
    request = event.get("request")
    if isinstance(request, dict):
        request.pop("cookies", None)
        if "data" in request:
            request["data"] = REDACTED
        request.pop("env", None)
    user = event.get("user")
    if isinstance(user, dict):
        event["user"] = {"id": user["id"]} if user.get("id") else {}
    request_id = current_request_id()
    if request_id:
        event.setdefault("tags", {})["request_id"] = request_id
    cleaned: dict[str, Any] = scrub(event)
    return cleaned


def scrub_breadcrumb(crumb: dict[str, Any], hint: dict[str, Any] | None = None) -> dict[str, Any] | None:
    if crumb.get("category") in {"httplib", "http"} and isinstance(crumb.get("data"), dict):
        crumb["data"].pop("http.query", None)
    cleaned: dict[str, Any] = scrub(crumb)
    return cleaned


def init_sentry() -> bool:
    if not settings.sentry_dsn:
        return False
    import sentry_sdk

    try:
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.environment,
            release=settings.release or None,
            send_default_pii=False,
            max_request_body_size="never",
            include_local_variables=False,
            traces_sample_rate=settings.sentry_traces_sample_rate,
            before_send=scrub_event,  # type: ignore[arg-type]
            before_send_transaction=scrub_event,  # type: ignore[arg-type]
            before_breadcrumb=scrub_breadcrumb,
        )
    except Exception:
        # A malformed SENTRY_DSN must never crash the service. Error reporting is a
        # convenience, not a dependency: log and run without it rather than
        # crash-looping the whole API on one bad environment variable.
        logger.exception("sentry initialisation failed; continuing without error reporting")
        return False
    logger.info("sentry enabled", extra={"sentry": settings.sentry_dsn_public})
    return True


def report_exception(exc: BaseException) -> None:
    """Send a handled-but-unexpected error to Sentry (no-op when Sentry is off)."""
    if not settings.sentry_dsn:
        return
    import sentry_sdk

    sentry_sdk.capture_exception(exc)
