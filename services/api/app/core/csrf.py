"""Cross-site request guard (MSHWAR-114 review finding SR-03).

The API authenticates browsers with cookies, so a page on another site could try to
make a signed-in visitor's browser send a state-changing request. SameSite=Lax
cookies already stop most of that; this guard is the second layer:

* safe methods (GET, HEAD, OPTIONS) are never blocked;
* requests without a Mshwar cookie carry no ambient authority and pass;
* otherwise the browser's ``Origin`` must be the web app or an allowed origin, and
  when ``Origin`` is missing, ``Sec-Fetch-Site: cross-site`` is refused.

Server-to-server callers (payment webhooks, jobs) send no cookie and are unaffected.
"""

from __future__ import annotations

import json
from urllib.parse import urlsplit

from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.config import settings
from app.core.guests import GUEST_COOKIE
from app.core.request_context import current_request_id

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
BLOCKED_DETAIL = "This request came from another site and was blocked."


def _origin(value: str) -> str:
    parts = urlsplit(value.strip())
    if not parts.scheme or not parts.netloc:
        return ""
    return f"{parts.scheme.lower()}://{parts.netloc.lower()}"


def trusted_origins() -> frozenset[str]:
    candidates = [*settings.allowed_origins, settings.public_web_origin]
    return frozenset(origin for origin in (_origin(value) for value in candidates) if origin)


def _has_auth_cookie(cookie_header: str) -> bool:
    names = {settings.session_cookie_name, GUEST_COOKIE}
    for part in cookie_header.split(";"):
        name = part.split("=", 1)[0].strip()
        if name in names:
            return True
    return False


def is_cross_site(method: str, headers: dict[str, str]) -> bool:
    if method.upper() in SAFE_METHODS or not _has_auth_cookie(headers.get("cookie", "")):
        return False
    origin = headers.get("origin")
    if origin is not None:
        # "null" (sandboxed frames, some redirects) is never trusted.
        return _origin(origin) not in trusted_origins()
    return headers.get("sec-fetch-site", "").lower() == "cross-site"


class CrossSiteRequestGuard:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = {name.decode("latin-1").lower(): value.decode("latin-1") for name, value in scope["headers"]}
        if not is_cross_site(scope["method"], headers):
            await self.app(scope, receive, send)
            return
        body = {"detail": BLOCKED_DETAIL, "code": "forbidden"}
        request_id = current_request_id()
        if request_id:
            body["request_id"] = request_id
        payload = json.dumps(body).encode()
        await send(
            {
                "type": "http.response.start",
                "status": 403,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(payload)).encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": payload})
