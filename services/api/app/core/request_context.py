"""Correlation IDs (MSHWAR-111).

Every request carries one id from the browser edge to the database:

* the web proxy (apps/web/src/proxy.ts) stamps ``X-Request-ID`` on each request;
* this middleware accepts it when well formed, otherwise mints one, and echoes it
  on the response;
* logs (``app.core.logging``), error bodies (``app.core.errors``), Sentry events
  (``app.core.observability``) and audit rows (``app.request_id``, set per
  transaction in ``app.dependencies``) all read it from here.
"""

from __future__ import annotations

import re
import uuid
from contextvars import ContextVar

from starlette.types import ASGIApp, Message, Receive, Scope, Send

REQUEST_ID_HEADER = "x-request-id"
_VALID = re.compile(r"^[A-Za-z0-9._:-]{8,64}$")
_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)


def current_request_id() -> str | None:
    return _request_id.get()


def new_request_id() -> str:
    return uuid.uuid4().hex


def accept_request_id(value: str | None) -> str:
    if value and _VALID.fullmatch(value):
        return value
    return new_request_id()


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        incoming = None
        for name, value in scope.get("headers", ()):
            if name == b"x-request-id":
                incoming = value.decode("latin-1")
                break
        request_id = accept_request_id(incoming)
        # Also on the scope: the outermost error middleware runs after this context is reset.
        scope.setdefault("state", {})["request_id"] = request_id
        token = _request_id.set(request_id)
        _tag_sentry(request_id)

        async def send_with_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = [(k, v) for k, v in message.get("headers", []) if k.lower() != b"x-request-id"]
                headers.append((b"x-request-id", request_id.encode("latin-1")))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        finally:
            _request_id.reset(token)


def _tag_sentry(request_id: str) -> None:
    try:
        import sentry_sdk
    except ImportError:  # pragma: no cover - sentry-sdk is a runtime dependency
        return
    sentry_sdk.get_isolation_scope().set_tag("request_id", request_id)
