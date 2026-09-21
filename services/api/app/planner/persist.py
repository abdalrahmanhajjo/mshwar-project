from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.planner.ranking import weights_from_payload
from app.planner.schemas import AssembledPlan, AssumedDefault, CandidateRecord, ExtractedConstraints


def _dump(value: Any) -> str:
    if hasattr(value, "model_dump"):
        return json.dumps(value.model_dump(mode="json"), default=str)
    return json.dumps(value, default=str)


async def retrieve_candidates(
    db: AsyncSession, constraints: ExtractedConstraints, *, limit: int = 24
) -> list[CandidateRecord]:
    payload = constraints.model_dump(mode="json")
    payload["candidate_limit"] = limit
    row = (
        await db.execute(
            text("SELECT app.planner_retrieve_candidates(CAST(:constraints AS jsonb))"),
            {"constraints": json.dumps(payload, default=str)},
        )
    ).scalar()
    if isinstance(row, str):
        parsed = json.loads(row)
        items = parsed if isinstance(parsed, list) else []
    elif isinstance(row, list):
        items = row
    else:
        items = []
    return [CandidateRecord.model_validate(item) for item in items]


async def load_weights(db: AsyncSession) -> dict[str, float]:
    row = (await db.execute(text("SELECT app.planner_active_weights()"))).scalar()
    return weights_from_payload(row)


async def upsert_session(
    db: AsyncSession,
    user_id: UUID,
    session_id: UUID | None,
    *,
    locale: str,
    raw_text: str,
    status: str,
    round_number: int,
    constraints: ExtractedConstraints | dict[str, Any],
    assumed: list[AssumedDefault],
    degraded: bool,
    trip_id: UUID | None = None,
    version_id: UUID | None = None,
    pending: dict[str, Any] | None = None,
) -> UUID:
    row = (
        await db.execute(
            text(
                "SELECT app.planner_upsert_session(:user_id, :id, :locale, :raw_text, :status, :round, "
                "CAST(:constraints AS jsonb), CAST(:assumed AS jsonb), :degraded, :trip, :version, CAST(:pending AS jsonb))"
            ),
            {
                "user_id": str(user_id),
                "id": str(session_id) if session_id else None,
                "locale": locale,
                "raw_text": raw_text,
                "status": status,
                "round": round_number,
                "constraints": _dump(constraints),
                "assumed": _dump([item.model_dump(mode="json") for item in assumed]),
                "degraded": degraded,
                "trip": str(trip_id) if trip_id else None,
                "version": str(version_id) if version_id else None,
                "pending": json.dumps(pending or {}, default=str),
            },
        )
    ).scalar()
    return UUID(str(row))


async def get_session(db: AsyncSession, user_id: UUID, session_id: UUID) -> dict[str, Any]:
    row = (
        await db.execute(
            text("SELECT app.planner_get_session(:user_id, :id)"),
            {"user_id": str(user_id), "id": str(session_id)},
        )
    ).scalar()
    if not isinstance(row, dict):
        raise TypeError("session not found")
    return row


async def persist_plan(
    db: AsyncSession,
    user_id: UUID,
    constraints: ExtractedConstraints,
    plan: AssembledPlan,
    *,
    trip_id: UUID | None,
    title: str,
    origin: str,
    retrieved_ids: list[str],
    assumed: list[AssumedDefault],
    degraded: bool,
    ranked: list[dict[str, Any]],
    latency_ms: int,
    run_status: str,
) -> dict[str, Any]:
    payload = constraints.model_dump(mode="json")
    payload["retrieved_ids"] = retrieved_ids
    payload["assumed_defaults"] = [item.model_dump(mode="json") for item in assumed]
    payload["degraded"] = degraded
    validation = {
        "feasible": "true",
        "validator_version": "planner-v1",
        "degraded": degraded,
        "needs_budget_approval": plan.needs_budget_approval,
    }
    stops = []
    for stop in plan.stops:
        snapshot = dict(stop.snapshot)
        snapshot["explanation"] = stop.explanation
        snapshot["flags"] = stop.flags
        stops.append(
            {
                "experience_id": str(stop.experience_id),
                "position": stop.position,
                "starts_at": stop.starts_at.isoformat(),
                "ends_at": stop.ends_at.isoformat(),
                "estimated_minor": stop.estimated_minor,
                "price_kind": stop.price_kind,
                "locked": stop.locked,
                "snapshot": snapshot,
            }
        )
    now = datetime.now(UTC)
    legs = []
    for leg in plan.legs:
        legs.append(
            {
                "position": leg.position,
                "provider": leg.provider,
                "fetched_at": (leg.fetched_at or now).isoformat(),
                "expires_at": (leg.expires_at or now + timedelta(hours=1)).isoformat(),
                "distance_m": leg.distance_m,
                "duration_seconds": leg.duration_seconds,
                "estimated_minor": leg.estimated_minor,
                "status": leg.status,
            }
        )
    row = (
        await db.execute(
            text(
                "SELECT app.planner_persist_version(:user_id, :trip, :title, :origin, :window_start, :return_by, "
                ":lng, :lat, :party, :budget, :currency, :strict, CAST(:constraints AS jsonb), CAST(:validation AS jsonb), "
                "CAST(:stops AS jsonb), CAST(:legs AS jsonb), CAST(:costs AS jsonb), CAST(:run AS jsonb))"
            ),
            {
                "user_id": str(user_id),
                "trip": str(trip_id) if trip_id else None,
                "title": title,
                "origin": origin,
                "window_start": constraints.window_start,
                "return_by": constraints.return_by,
                "lng": constraints.start_lng,
                "lat": constraints.start_lat,
                "party": constraints.party_size,
                "budget": constraints.budget_minor,
                "currency": constraints.currency,
                "strict": constraints.strict_budget or False,
                "constraints": json.dumps(payload, default=str),
                "validation": json.dumps(validation),
                "stops": json.dumps(stops, default=str),
                "legs": json.dumps(legs, default=str),
                "costs": json.dumps([item.model_dump(mode="json") for item in plan.cost_items], default=str),
                "run": json.dumps(
                    {
                        "model_version": "stub-llm" if not degraded else "structured-only",
                        "prompt_version": "intent-v1",
                        "ranker_version": "ranker-v1",
                        "optimizer_version": "greedy-v1",
                        "status": run_status,
                        "latency_ms": latency_ms,
                        "candidates": ranked,
                    },
                    default=str,
                ),
            },
        )
    ).scalar()
    if not isinstance(row, dict):
        raise TypeError("persist failed")
    return row


async def list_versions(db: AsyncSession, user_id: UUID, trip_id: UUID, admin: bool) -> list[dict[str, Any]]:
    row = (
        await db.execute(
            text("SELECT app.planner_list_versions(:user_id, :trip, :admin)"),
            {"user_id": str(user_id), "trip": str(trip_id), "admin": admin},
        )
    ).scalar()
    return row if isinstance(row, list) else []


async def get_version(db: AsyncSession, user_id: UUID, version_id: UUID, admin: bool) -> dict[str, Any]:
    row = (
        await db.execute(
            text("SELECT app.planner_version_payload(:user_id, :version, :admin)"),
            {"user_id": str(user_id), "version": str(version_id), "admin": admin},
        )
    ).scalar()
    if not isinstance(row, dict):
        raise TypeError("version not found")
    return row


async def rag_chunks(db: AsyncSession, experience_id: UUID) -> list[dict[str, Any]]:
    row = (
        await db.execute(
            text("SELECT app.planner_rag_chunks(:experience_id)"),
            {"experience_id": str(experience_id)},
        )
    ).scalar()
    return row if isinstance(row, list) else []
