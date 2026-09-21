"""Endpoint access policies (MSHWAR-108).

Every route declares exactly one policy in its decorator, for example::

    @router.get("/mine", dependencies=[access.SESSION])

``verify_route_policies`` runs at start-up and refuses to boot if any route has
none, so a new endpoint cannot ship unguarded by accident.

A policy answers *who is calling*. It runs as a FastAPI dependency, before the
request body is validated, so an anonymous caller always gets 401 rather than a
422 that confirms the payload shape. *What they may touch* (object-level
authorisation) is decided by the SECURITY DEFINER function each route calls,
which receives the caller's id and raises 42501 or P0002;
``app.core.sql.raise_from_db`` turns those into the uniform responses defined in
``app.core.errors``. Object-level denials are reported as 404, exactly like a
missing record, so a caller cannot probe for the existence of other people's
data.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from enum import StrEnum
from typing import Any

from fastapi import Depends, FastAPI, Header, Request
from fastapi.routing import APIRoute
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.admin_auth import require_admin
from app.core.auth_session import require_session, require_verified_user
from app.core.guests import actor_ids
from app.core.job_auth import require_dev_endpoints, require_job_token
from app.core.rate_limit import enforce_rate_limit
from app.dependencies import get_auth_db


class Policy(StrEnum):
    PUBLIC = "public"  # anyone; read-only catalogue and reference data, sign-in flows
    SESSION = "session"  # a signed-in, active account
    VERIFIED = "verified"  # a signed-in account with a verified email (money moves)
    ADMIN = "admin"  # a platform admin (the handler may demand the elevated tier)
    ACTOR = "actor"  # a signed-in account or a group-trip guest cookie
    TOKEN = "token"  # noqa: S105 - policy name, not a credential. A secret in the URL (share link, unsubscribe, signed file), rate limited
    JOB = "job"  # an internal scheduler presenting X-Job-Token
    DEV = "dev"  # local development only, and a signed-in account
    SIGNATURE = "signature"  # a provider webhook; the handler verifies the signature


POLICY_ATTR = "__access_policy__"


def _mark(policy: Policy, func: Callable[..., Any]) -> Any:
    setattr(func, POLICY_ATTR, policy)
    return Depends(func)


async def _public() -> None:
    return None


async def _session(request: Request, db: AsyncSession = Depends(get_auth_db)) -> dict[str, Any]:  # noqa: B008
    return await require_session(request, db)


async def _verified(request: Request, db: AsyncSession = Depends(get_auth_db)) -> dict[str, Any]:  # noqa: B008
    return await require_verified_user(request, db)


async def _admin(request: Request, db: AsyncSession = Depends(get_auth_db)) -> dict[str, Any]:  # noqa: B008
    return await require_admin(request, db)


async def _actor(request: Request, db: AsyncSession = Depends(get_auth_db)) -> tuple[str | None, str | None]:  # noqa: B008
    return await actor_ids(request, db, require_any=True)


async def _token(request: Request) -> None:
    # Secrets in URLs are long and random; the limit makes guessing pointless
    # and keeps a leaked link from being hammered.
    await enforce_rate_limit(request, "token-link")


async def _job(
    x_job_token: str | None = Header(default=None),
    x_notification_token: str | None = Header(default=None),
) -> None:
    await require_job_token(x_job_token, x_notification_token)


async def _dev(request: Request, db: AsyncSession = Depends(get_auth_db)) -> dict[str, Any]:  # noqa: B008
    require_dev_endpoints()
    return await require_session(request, db)


async def _signature() -> None:
    return None


PUBLIC = _mark(Policy.PUBLIC, _public)
SESSION = _mark(Policy.SESSION, _session)
VERIFIED = _mark(Policy.VERIFIED, _verified)
ADMIN = _mark(Policy.ADMIN, _admin)
ACTOR = _mark(Policy.ACTOR, _actor)
TOKEN = _mark(Policy.TOKEN, _token)
JOB = _mark(Policy.JOB, _job)
DEV = _mark(Policy.DEV, _dev)
SIGNATURE = _mark(Policy.SIGNATURE, _signature)


def route_policy(route: APIRoute) -> list[Policy]:
    found: list[Policy] = []
    for dependency in route.dependant.dependencies:
        policy = getattr(dependency.call, POLICY_ATTR, None)
        if policy is not None:
            found.append(policy)
    return found


def iter_api_routes(app: FastAPI) -> Iterator[tuple[str, set[str], APIRoute]]:
    """Yield (full path, methods, route) for every API route, however routers were included."""
    try:
        from fastapi.routing import iter_route_contexts  # FastAPI >= 0.140 keeps included routers nested
    except ImportError:  # pragma: no cover - older FastAPI flattens routes on include
        for route in app.routes:
            if isinstance(route, APIRoute):
                yield route.path, set(route.methods or ()), route
        return
    for context in iter_route_contexts(app.routes):
        route = context.original_route
        if isinstance(route, APIRoute):
            yield context.path or route.path, set(getattr(context, "methods", None) or route.methods or ()), route


def route_policies(app: FastAPI) -> dict[str, Policy]:
    """Map "METHOD /path" to its declared policy. Raises if any route has none or several."""
    table: dict[str, Policy] = {}
    problems: list[str] = []
    for path, methods, route in iter_api_routes(app):
        policies = route_policy(route)
        for method in sorted(methods):
            key = f"{method} {path}"
            if len(policies) != 1:
                problems.append(f"{key}: {len(policies)} access policies")
            else:
                table[key] = policies[0]
    if problems:
        raise RuntimeError("Every route needs exactly one access policy:\n" + "\n".join(sorted(problems)))
    return table


def verify_route_policies(app: FastAPI) -> None:
    route_policies(app)


def render_route_table(app: FastAPI) -> str:
    """Markdown table of every route and its policy (docs/security/route-policies.md)."""
    table = route_policies(app)
    counts: dict[str, int] = {}
    for policy in table.values():
        counts[policy.value] = counts.get(policy.value, 0) + 1
    lines = [
        "# Route access policies",
        "",
        "Generated from the running app by `python scripts/route_policies.py`; a test fails if this file is stale.",
        "The policy model is described in [authorization.md](authorization.md).",
        "",
        "| Policy | Routes |",
        "|---|---|",
        *(f"| `{name}` | {count} |" for name, count in sorted(counts.items())),
        f"| **Total** | **{len(table)}** |",
        "",
        "| Method | Path | Policy |",
        "|---|---|---|",
    ]
    for key in sorted(table, key=lambda item: (item.split(" ", 1)[1], item)):
        method, path = key.split(" ", 1)
        lines.append(f"| {method} | `{path}` | `{table[key].value}` |")
    return "\n".join(lines) + "\n"
