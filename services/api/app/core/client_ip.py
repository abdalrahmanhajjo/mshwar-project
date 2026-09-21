from __future__ import annotations

from fastapi import Request

from app.core.config import settings

_MAX_IP_LENGTH = 128


def client_ip(request: Request) -> str:
    """Best-known client address for rate limiting and audit logs.

    X-Forwarded-For is client-controlled except for the entries appended by our
    own proxies, so only the entry added by the outermost trusted proxy is used.
    """
    hops = settings.trusted_proxy_count
    if hops > 0:
        forwarded = [part.strip() for part in request.headers.get("x-forwarded-for", "").split(",") if part.strip()]
        if len(forwarded) >= hops:
            return forwarded[-hops][:_MAX_IP_LENGTH]
    if request.client and request.client.host:
        return request.client.host
    return "unknown"
