"""Rate limiting and abuse controls (MSHWAR-110).

Sliding-window limits keyed by client IP or account. Two stores share one
contract:

* ``RedisRateLimiter`` - the shared store used whenever ``RATE_LIMIT_STORE=redis``
  (required in staging and production), so every API worker sees the same counts.
* ``MemoryRateLimiter`` - process-local; local development, tests, and the
  fallback while Redis is unreachable (a Redis outage degrades to per-process
  limits instead of switching limits off or failing every request).

Limits are named rules (``RULES``); each has one allowance for anonymous callers
and one for signed-in callers. See docs/security/rate-limits.md.
"""

from __future__ import annotations

import hashlib
import logging
import math
import time
import uuid
from collections import Counter, deque
from dataclasses import dataclass
from typing import Any, Protocol

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_session import optional_session
from app.core.client_ip import client_ip
from app.core.config import settings
from app.core.sessions import COOKIE_NAME
from app.dependencies import get_auth_db

logger = logging.getLogger("mshwar.rate_limit")

_SWEEP_EVERY = 1024
RATE_LIMITED_DETAIL = "Too many requests. Please wait and try again."


@dataclass(frozen=True)
class Decision:
    allowed: bool
    limit: int
    remaining: int
    retry_after: int  # whole seconds until the next hit would be allowed (0 when allowed)


class RateLimitStore(Protocol):
    async def hit(self, key: str, limit: int, window_seconds: int) -> Decision: ...

    def reset(self) -> None: ...


class MemoryRateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = {}
        self._windows: dict[str, int] = {}
        self._calls = 0

    def check(self, key: str, limit: int, window_seconds: int, now: float | None = None) -> Decision:
        current = now if now is not None else time.monotonic()
        self._calls += 1
        if self._calls % _SWEEP_EVERY == 0:
            self._sweep(current)
        hits = self._hits.setdefault(key, deque())
        self._windows[key] = window_seconds
        cutoff = current - window_seconds
        while hits and hits[0] <= cutoff:
            hits.popleft()
        if len(hits) >= limit:
            retry = max(1, math.ceil(hits[0] + window_seconds - current))
            return Decision(False, limit, 0, retry)
        hits.append(current)
        return Decision(True, limit, limit - len(hits), 0)

    def allow(self, key: str, limit: int, window_seconds: int, now: float | None = None) -> bool:
        return self.check(key, limit, window_seconds, now).allowed

    async def hit(self, key: str, limit: int, window_seconds: int) -> Decision:
        return self.check(key, limit, window_seconds)

    def _sweep(self, current: float) -> None:
        """Forget keys with no hits inside their window, so memory stays bounded."""
        stale = [key for key, hits in self._hits.items() if not hits or hits[-1] <= current - self._windows[key]]
        for key in stale:
            del self._hits[key]
            del self._windows[key]

    def reset(self) -> None:
        self._hits.clear()
        self._windows.clear()
        self._calls = 0

    def __len__(self) -> int:
        return len(self._hits)


# KEYS[1] = bucket; ARGV = now_ms, window_ms, limit, member
_SLIDING_WINDOW = """
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - window)
local count = redis.call('ZCARD', KEYS[1])
if count >= limit then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  return {0, count, tonumber(oldest[2])}
end
redis.call('ZADD', KEYS[1], now, ARGV[4])
redis.call('PEXPIRE', KEYS[1], window)
return {1, count + 1, now}
"""


class RedisRateLimiter:
    """Shared sliding window in a Redis sorted set, updated atomically by a Lua script."""

    def __init__(self, url: str, fallback: MemoryRateLimiter, prefix: str = "mshwar:rl:") -> None:
        self._url = url
        self._fallback = fallback
        self._prefix = prefix
        self._client: Any = None
        self._script: Any = None
        self._down_until = 0.0

    def _connect(self) -> Any:
        if self._client is None:
            import redis.asyncio as redis_asyncio  # imported lazily: optional in dev and tests

            self._client = redis_asyncio.from_url(
                self._url, socket_timeout=0.25, socket_connect_timeout=0.25, health_check_interval=30
            )
            self._script = self._client.register_script(_SLIDING_WINDOW)
        return self._script

    async def hit(self, key: str, limit: int, window_seconds: int) -> Decision:
        if time.monotonic() < self._down_until:
            return await self._fallback.hit(key, limit, window_seconds)
        now_ms = int(time.time() * 1000)
        window_ms = window_seconds * 1000
        try:
            script = self._connect()
            allowed, count, oldest = await script(
                keys=[self._prefix + key], args=[now_ms, window_ms, limit, f"{now_ms}-{uuid.uuid4().hex[:8]}"]
            )
        except Exception:  # noqa: BLE001 - any store failure degrades to per-process limits
            logger.warning("rate limit store unavailable; using in-process limits")
            metrics.store_failures += 1
            self._down_until = time.monotonic() + 30
            return await self._fallback.hit(key, limit, window_seconds)
        if int(allowed):
            return Decision(True, limit, max(limit - int(count), 0), 0)
        retry = max(1, math.ceil((int(oldest) + window_ms - now_ms) / 1000))
        return Decision(False, limit, 0, retry)

    def reset(self) -> None:
        self._fallback.reset()


class RateLimitMetrics:
    """In-process counters, exported by GET /api/v1/health/metrics (job token)."""

    def __init__(self) -> None:
        self.rejections: Counter[str] = Counter()
        self.checks: Counter[str] = Counter()
        self.store_failures = 0

    def reset(self) -> None:
        self.rejections.clear()
        self.checks.clear()
        self.store_failures = 0


metrics = RateLimitMetrics()
_memory = MemoryRateLimiter()


def build_store() -> RateLimitStore:
    if settings.rate_limit_store == "redis":
        return RedisRateLimiter(settings.redis_url, _memory)
    return _memory


limiter: RateLimitStore = build_store()


@dataclass(frozen=True)
class Allowance:
    limit: int
    window_seconds: int


@dataclass(frozen=True)
class Rule:
    """A named limit. ``anonymous`` applies per client IP; ``signed_in`` per account."""

    name: str
    anonymous: Allowance | None
    signed_in: Allowance | None
    description: str


def _rules() -> dict[str, Rule]:
    minute, hour = 60, 3600
    window = settings.rate_limit_window_seconds
    signin_window = settings.signin_window_seconds
    items = [
        Rule("auth-register", Allowance(settings.register_ip_limit, window), None, "Account creation per IP"),
        Rule("auth-signin-ip", Allowance(settings.signin_ip_limit, signin_window), None, "Sign-in attempts per IP"),
        Rule(
            "auth-signin-email",
            Allowance(settings.signin_email_limit, signin_window),
            None,
            "Sign-in attempts per email address",
        ),
        Rule("auth-reset-ip", Allowance(settings.forgot_ip_limit, window), None, "Password reset requests per IP"),
        Rule(
            "auth-reset-email",
            Allowance(settings.forgot_email_limit, window),
            None,
            "Password reset requests per email address",
        ),
        Rule("auth-verify-ip", Allowance(settings.verify_ip_limit, window), None, "Email verification per IP"),
        Rule(
            "auth-verify-email",
            Allowance(settings.verify_email_limit, window),
            None,
            "Verification emails per address",
        ),
        Rule("search", Allowance(60, minute), Allowance(120, minute), "Catalogue browse and search"),
        Rule("ai-generate", None, Allowance(20, 10 * minute), "AI trip generation, clarify, refine, regenerate"),
        Rule("maps", None, Allowance(90, 10 * minute), "Routing, weather and place lookups (paid providers)"),
        Rule("booking", None, Allowance(30, 10 * minute), "Checkout drafts, commits, payments, cancellations"),
        Rule("booking-ip", Allowance(120, 10 * minute), None, "All booking writes from one IP"),
        Rule("token-link", Allowance(30, 10 * minute), None, "Share, unsubscribe and signed-file links"),
        Rule("community-write", None, Allowance(30, hour), "Reviews, reports, group suggestions and votes"),
        Rule("upload-org", None, Allowance(settings.upload_org_hourly_limit, hour), "File uploads per organisation"),
    ]
    return {rule.name: rule for rule in items}


RULES = _rules()


def _signed_in_user(request: Request) -> str | None:
    session = getattr(request.state, "auth_session", None)
    if session:
        return str(session["user_id"])
    return None


async def enforce_rate_limit(request: Request, rule_name: str, *, subject: str | None = None) -> None:
    """Count one hit against ``rule_name`` and raise 429 when the allowance is spent.

    ``subject`` overrides the key (an email address, an organisation id). Without
    it, signed-in callers are keyed by account and anonymous callers by IP.
    """
    rule = _rules()[rule_name]  # rebuilt per call so allowances follow the live settings
    user_id = _signed_in_user(request)
    allowance = rule.signed_in if user_id and rule.signed_in else rule.anonymous
    if allowance is None:
        allowance = rule.signed_in
    if allowance is None:  # pragma: no cover - every rule defines at least one allowance
        return
    if subject is not None:
        # Hashed: store keys and metrics never hold the email address itself.
        key = f"{rule.name}:s:{hashlib.sha256(subject.strip().lower().encode()).hexdigest()[:32]}"
    elif user_id and rule.signed_in:
        key = f"{rule.name}:u:{user_id}"
    else:
        key = f"{rule.name}:ip:{client_ip(request)}"
    metrics.checks[rule.name] += 1
    decision = await limiter.hit(key, allowance.limit, allowance.window_seconds)
    if decision.allowed:
        return
    metrics.rejections[rule.name] += 1
    # The key can hold an email address; log the rule only.
    logger.warning("rate limit exceeded", extra={"rule": rule.name, "retry_after": decision.retry_after})
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=RATE_LIMITED_DETAIL,
        headers={
            "Retry-After": str(decision.retry_after),
            "RateLimit-Limit": str(decision.limit),
            "RateLimit-Remaining": "0",
            "RateLimit-Reset": str(decision.retry_after),
        },
    )


def limit(rule_name: str) -> Any:
    """Route dependency: ``dependencies=[access.PUBLIC, limit("search")]``.

    List it after the access policy, so signed-in callers are already known and
    get their own (larger) allowance.
    """
    if rule_name not in RULES:
        raise KeyError(rule_name)

    async def _dependency(request: Request, db: AsyncSession = Depends(get_auth_db)) -> None:  # noqa: B008
        if not hasattr(request.state, "auth_session") and request.cookies.get(COOKIE_NAME):
            await optional_session(request, db)
        await enforce_rate_limit(request, rule_name)

    _dependency.__name__ = f"rate_limit_{rule_name.replace('-', '_')}"
    return Depends(_dependency)


def reset_all() -> None:
    limiter.reset()
    _memory.reset()
    metrics.reset()


def prometheus_text() -> str:
    lines = [
        "# HELP mshwar_rate_limit_checks_total Requests counted against a rate-limit rule.",
        "# TYPE mshwar_rate_limit_checks_total counter",
    ]
    lines += [
        f'mshwar_rate_limit_checks_total{{rule="{name}"}} {count}' for name, count in sorted(metrics.checks.items())
    ]
    lines += [
        "# HELP mshwar_rate_limit_rejections_total Requests rejected with 429.",
        "# TYPE mshwar_rate_limit_rejections_total counter",
    ]
    lines += [
        f'mshwar_rate_limit_rejections_total{{rule="{name}"}} {count}'
        for name, count in sorted(metrics.rejections.items())
    ]
    lines += [
        "# HELP mshwar_rate_limit_store_failures_total Redis errors that fell back to in-process limits.",
        "# TYPE mshwar_rate_limit_store_failures_total counter",
        f"mshwar_rate_limit_store_failures_total {metrics.store_failures}",
    ]
    return "\n".join(lines) + "\n"
