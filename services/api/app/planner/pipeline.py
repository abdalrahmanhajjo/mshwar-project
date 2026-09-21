from __future__ import annotations

import time
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.planner import MAX_CLARIFICATION_ROUNDS
from app.planner.assembly import assemble_plan, candidate_by_id, plan_total_minor
from app.planner.circuit import circuit_open, guard_provider, record_failure, record_success
from app.planner.defaults import apply_defaults, has_intent_anchor
from app.planner.eligibility import evaluate_candidate
from app.planner.explanations import explain_plan
from app.planner.intent import clarification_for, extract_constraints
from app.planner.llm import ProviderError, SchemaRetryExhausted
from app.planner.persist import (
    get_session,
    get_version,
    load_weights,
    persist_plan,
    rag_chunks,
    retrieve_candidates,
    upsert_session,
)
from app.planner.ranking import rank_candidates
from app.planner.refinement import apply_refinement, parse_refinement
from app.planner.safety import detect_injection, log_safety_event
from app.planner.schemas import (
    AssembledPlan,
    AssumedDefault,
    CandidateRecord,
    ExtractedConstraints,
    RankedCandidate,
)


def _title_from(constraints: ExtractedConstraints, raw: str) -> str:
    if constraints.destination_slugs:
        return f"Plan · {constraints.destination_slugs[0]}"
    clipped = raw.strip().split("\n")[0][:80]
    return clipped or "Mshwar plan"


def _pending_dict(stored: dict[str, Any]) -> dict[str, Any]:
    raw = stored.get("pending_action")
    return raw if isinstance(raw, dict) else {}


def _retrieved_ids(candidates: list[CandidateRecord]) -> list[str]:
    return [str(item.id) for item in candidates]


def _run_candidates(ranked: list[RankedCandidate], blocked: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for index, item in enumerate(ranked, start=1):
        rows.append(
            {
                "experience_id": str(item.candidate.id),
                "rank": index,
                "score": item.score,
                "eligible": True,
                "sponsored": item.sponsored,
                "reasons": {"notes": item.reasons, "flags": item.flags},
            }
        )
    rank = len(rows)
    for blocked_row in blocked:
        rank += 1
        rows.append(
            {
                "experience_id": blocked_row["experience_id"],
                "rank": rank,
                "score": 0,
                "eligible": False,
                "sponsored": blocked_row.get("sponsored", False),
                "reasons": {"blocked": blocked_row.get("blocked", [])},
            }
        )
    return rows


async def _scan_input(db: AsyncSession, user_id: UUID, session_id: UUID | None, raw: str) -> str | None:
    pattern = detect_injection(raw)
    if pattern:
        await log_safety_event(db, user_id, session_id, "injection_attempt", pattern, raw)
    return pattern


def _structured_extract(raw: str, locale: str) -> ExtractedConstraints:
    import json

    from app.planner.fixtures import stub_response

    payload = json.loads(stub_response(raw, "extract"))
    extracted = ExtractedConstraints.model_validate(payload)
    if extracted.locale == "en" and locale in {"ar", "ar-LB", "fr", "mixed"}:
        extracted.locale = locale
    return extracted


def _extract(raw: str, locale: str, degraded: bool) -> tuple[ExtractedConstraints, bool]:
    if degraded or circuit_open():
        return _structured_extract(raw, locale), True
    try:
        guard_provider()
        extracted = extract_constraints(raw, locale)
        record_success()
        return extracted, False
    except (ProviderError, SchemaRetryExhausted):
        record_failure()
        return _structured_extract(raw, locale), True


async def _build(
    db: AsyncSession,
    constraints: ExtractedConstraints,
    *,
    locked_ids: set[UUID] | None = None,
    exclude_ids: set[UUID] | None = None,
) -> tuple[list[CandidateRecord], list[RankedCandidate], list[dict[str, Any]], AssembledPlan]:
    candidates = await retrieve_candidates(db, constraints)
    remaining = constraints.budget_minor
    results = []
    blocked: list[dict[str, Any]] = []
    for candidate in candidates:
        result = evaluate_candidate(
            candidate,
            constraints,
            from_lat=constraints.start_lat,
            from_lng=constraints.start_lng,
            remaining_budget=remaining,
        )
        results.append(result)
        if not result.eligible:
            blocked.append(
                {
                    "experience_id": str(candidate.id),
                    "slug": candidate.slug,
                    "blocked": result.blocked,
                    "sponsored": candidate.sponsored,
                }
            )
    weights = await load_weights(db)
    ranked = rank_candidates(results, constraints, weights)
    plan = assemble_plan(ranked, constraints, locked_ids=locked_ids, exclude_ids=exclude_ids)
    by_id = {item.candidate.id: item.candidate for item in ranked}
    chunks: dict[UUID, list[dict[str, Any]]] = {}
    for stop in plan.stops:
        chunks[stop.experience_id] = await rag_chunks(db, stop.experience_id)
    explain_plan(plan.stops, by_id, constraints, chunks)
    if plan_total_minor(plan) != plan.total_minor:
        plan.total_minor = plan_total_minor(plan)
    return candidates, ranked, blocked, plan


def _session_payload(
    *,
    session_id: UUID,
    status: str,
    degraded: bool,
    constraints: ExtractedConstraints,
    assumed: list[AssumedDefault],
    questions: list[Any],
    plan_doc: dict[str, Any] | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "session_id": str(session_id),
        "status": status,
        "degraded": degraded,
        "degraded_message": (
            "Natural-language planning is unavailable. This plan used structured filters only." if degraded else None
        ),
        "constraints": constraints.model_dump(mode="json"),
        "assumed_defaults": [item.model_dump(mode="json") for item in assumed],
        "clarifications": [item.model_dump() for item in questions],
        "plan": plan_doc,
        "llm_never_sets_totals": True,
    }
    if extra:
        body.update(extra)
    return body


async def start_or_continue(
    db: AsyncSession,
    user_id: UUID,
    raw: str,
    locale: str,
    session_id: UUID | None,
    trip_id: UUID | None,
    answers: dict[str, Any] | None = None,
    approve_budget: bool = False,
) -> dict[str, Any]:
    started = time.monotonic()
    injection = await _scan_input(db, user_id, session_id, raw)
    extracted, degraded = _extract(raw, locale, degraded=False)
    if injection:
        degraded = degraded or False
    stored = None
    round_number = 0
    pending: dict[str, Any] = {}
    if session_id:
        stored = await get_session(db, user_id, session_id)
        round_number = int(stored.get("clarification_round") or 0)
        pending = _pending_dict(stored)
        trip_id = trip_id or stored.get("trip_id")
    merged, assumed = apply_defaults(extracted, answers)
    if approve_budget:
        merged.strict_budget = False
        assumed.append(
            AssumedDefault(field="strict_budget", value=False, label="You approved exceeding the strict budget")
        )
    questions = clarification_for(extracted if not answers else merged, round_number)
    extra_common = {"injection_logged": bool(injection)}
    if questions and not answers and round_number < MAX_CLARIFICATION_ROUNDS:
        session_uuid = await upsert_session(
            db,
            user_id,
            session_id,
            locale=merged.locale,
            raw_text=raw,
            status="clarifying",
            round_number=round_number + 1,
            constraints=merged,
            assumed=assumed,
            degraded=degraded,
            trip_id=trip_id,
        )
        return _session_payload(
            session_id=session_uuid,
            status="clarifying",
            degraded=degraded,
            constraints=merged,
            assumed=assumed,
            questions=questions,
            extra=extra_common,
        )
    if not has_intent_anchor(merged) and round_number >= MAX_CLARIFICATION_ROUNDS:
        assumed.append(
            AssumedDefault(field="intent_anchor", value="lebanon", label="Exploring published Lebanon inventory")
        )
    candidates, ranked, blocked, plan = await _build(db, merged)
    retrieved = _retrieved_ids(candidates)
    if plan.infeasible:
        session_uuid = await upsert_session(
            db,
            user_id,
            session_id,
            locale=merged.locale,
            raw_text=raw,
            status="infeasible",
            round_number=min(round_number, MAX_CLARIFICATION_ROUNDS),
            constraints=merged,
            assumed=assumed,
            degraded=degraded,
            trip_id=trip_id,
        )
        return _session_payload(
            session_id=session_uuid,
            status="infeasible",
            degraded=degraded,
            constraints=merged,
            assumed=assumed,
            questions=[],
            extra={
                "blocked": blocked,
                "reason": plan.infeasible_reason,
                "forced_lock_changes": plan.forced_lock_changes,
                "injection_logged": bool(injection),
            },
        )
    origin = "ai"
    run_status = "fallback" if degraded else "succeeded"
    if plan.needs_budget_approval:
        run_status = "infeasible"
    doc = await persist_plan(
        db,
        user_id,
        merged,
        plan,
        trip_id=UUID(str(trip_id)) if trip_id else None,
        title=_title_from(merged, raw),
        origin=origin,
        retrieved_ids=retrieved,
        assumed=assumed,
        degraded=degraded,
        ranked=_run_candidates(ranked, blocked),
        latency_ms=int((time.monotonic() - started) * 1000),
        run_status=run_status,
    )
    for stop in plan.stops:
        if str(stop.experience_id) not in retrieved:
            raise RuntimeError("entity-id contract violated")
    session_uuid = await upsert_session(
        db,
        user_id,
        session_id,
        locale=merged.locale,
        raw_text=raw,
        status="degraded" if degraded else "planned",
        round_number=min(round_number, MAX_CLARIFICATION_ROUNDS),
        constraints=merged,
        assumed=assumed,
        degraded=degraded,
        trip_id=UUID(str(doc["trip_id"])),
        version_id=UUID(str(doc["version_id"])),
        pending=pending,
    )
    extra = {
        "blocked": blocked,
        "forced_lock_changes": plan.forced_lock_changes,
        "budget_warning": plan.budget_warning,
        "needs_budget_approval": plan.needs_budget_approval,
        "injection_logged": bool(injection),
        "explanations": [stop.explanation for stop in plan.stops],
    }
    return _session_payload(
        session_id=session_uuid,
        status="degraded" if degraded else "planned",
        degraded=degraded,
        constraints=merged,
        assumed=assumed,
        questions=[],
        plan_doc=doc,
        extra=extra,
    )


async def regenerate(
    db: AsyncSession,
    user_id: UUID,
    session_id: UUID,
    *,
    exclude_unlocked: bool = True,
) -> dict[str, Any]:
    stored = await get_session(db, user_id, session_id)
    constraints = ExtractedConstraints.model_validate(stored.get("constraints") or {})
    assumed = [AssumedDefault.model_validate(item) for item in (stored.get("assumed_defaults") or [])]
    version_id = stored.get("current_version_id")
    locked_ids: set[UUID] = set()
    exclude_ids: set[UUID] = set()
    if version_id:
        current = await get_version(db, user_id, UUID(str(version_id)), False)
        for stop in current.get("stops") or []:
            exp = UUID(str(stop["experience_id"]))
            if stop.get("locked"):
                locked_ids.add(exp)
            elif exclude_unlocked:
                exclude_ids.add(exp)
    degraded = bool(stored.get("degraded"))
    candidates, ranked, blocked, plan = await _build(db, constraints, locked_ids=locked_ids, exclude_ids=exclude_ids)
    if plan.infeasible:
        return _session_payload(
            session_id=session_id,
            status="infeasible",
            degraded=degraded,
            constraints=constraints,
            assumed=assumed,
            questions=[],
            extra={
                "blocked": blocked,
                "forced_lock_changes": plan.forced_lock_changes,
                "reason": plan.infeasible_reason,
            },
        )
    doc = await persist_plan(
        db,
        user_id,
        constraints,
        plan,
        trip_id=UUID(str(stored["trip_id"])) if stored.get("trip_id") else None,
        title=str(stored.get("raw_text") or "Mshwar plan")[:80],
        origin="ai",
        retrieved_ids=_retrieved_ids(candidates),
        assumed=assumed,
        degraded=degraded,
        ranked=_run_candidates(ranked, blocked),
        latency_ms=0,
        run_status="fallback" if degraded else "succeeded",
    )
    await upsert_session(
        db,
        user_id,
        session_id,
        locale=constraints.locale,
        raw_text=str(stored.get("raw_text") or ""),
        status="degraded" if degraded else "planned",
        round_number=int(stored.get("clarification_round") or 0),
        constraints=constraints,
        assumed=assumed,
        degraded=degraded,
        trip_id=UUID(str(doc["trip_id"])),
        version_id=UUID(str(doc["version_id"])),
    )
    return _session_payload(
        session_id=session_id,
        status="degraded" if degraded else "planned",
        degraded=degraded,
        constraints=constraints,
        assumed=assumed,
        questions=[],
        plan_doc=doc,
        extra={"forced_lock_changes": plan.forced_lock_changes, "blocked": blocked},
    )


def _locked_after_toggle(stops: list[dict[str, Any]], stop_id: UUID, locked: bool) -> set[UUID]:
    """Experience ids that stay locked once `stop_id` is locked or unlocked."""
    target = next((stop for stop in stops if str(stop.get("id")) == str(stop_id)), None)
    if target is None:
        raise ValueError("stop not found")
    locked_ids = {UUID(str(stop["experience_id"])) for stop in stops if stop.get("locked")}
    experience_id = UUID(str(target["experience_id"]))
    if locked:
        locked_ids.add(experience_id)
    else:
        locked_ids.discard(experience_id)
    return locked_ids


async def set_lock(db: AsyncSession, user_id: UUID, session_id: UUID, stop_id: UUID, locked: bool) -> dict[str, Any]:
    stored = await get_session(db, user_id, session_id)
    version_id = stored.get("current_version_id")
    if not version_id:
        raise ValueError("no plan")
    current = await get_version(db, user_id, UUID(str(version_id)), False)
    locked_ids = _locked_after_toggle(current.get("stops") or [], stop_id, locked)
    constraints = ExtractedConstraints.model_validate(stored.get("constraints") or {})
    assumed = [AssumedDefault.model_validate(item) for item in (stored.get("assumed_defaults") or [])]
    candidates, ranked, blocked, plan = await _build(db, constraints, locked_ids=locked_ids, exclude_ids=set())
    if plan.infeasible:
        return _session_payload(
            session_id=session_id,
            status="infeasible",
            degraded=bool(stored.get("degraded")),
            constraints=constraints,
            assumed=assumed,
            questions=[],
            extra={
                "blocked": blocked,
                "forced_lock_changes": plan.forced_lock_changes,
                "reason": plan.infeasible_reason,
            },
        )
    for stop in plan.stops:
        if stop.experience_id in locked_ids:
            stop.locked = True
    doc = await persist_plan(
        db,
        user_id,
        constraints,
        plan,
        trip_id=UUID(str(current["trip_id"])),
        title=str(current.get("trip_title") or "Mshwar plan"),
        origin="ai",
        retrieved_ids=_retrieved_ids(candidates),
        assumed=assumed,
        degraded=bool(stored.get("degraded")),
        ranked=_run_candidates(ranked, blocked),
        latency_ms=0,
        run_status="succeeded",
    )
    await upsert_session(
        db,
        user_id,
        session_id,
        locale=constraints.locale,
        raw_text=str(stored.get("raw_text") or ""),
        status="planned",
        round_number=int(stored.get("clarification_round") or 0),
        constraints=constraints,
        assumed=assumed,
        degraded=bool(stored.get("degraded")),
        trip_id=UUID(str(doc["trip_id"])),
        version_id=UUID(str(doc["version_id"])),
    )
    return _session_payload(
        session_id=session_id,
        status="planned",
        degraded=bool(stored.get("degraded")),
        constraints=constraints,
        assumed=assumed,
        questions=[],
        plan_doc=doc,
        extra={"forced_lock_changes": plan.forced_lock_changes},
    )


async def preview_replace(
    db: AsyncSession, user_id: UUID, session_id: UUID, stop_id: UUID, experience_id: UUID
) -> dict[str, Any]:
    stored = await get_session(db, user_id, session_id)
    version_id = stored.get("current_version_id")
    if not version_id:
        raise ValueError("no plan")
    current = await get_version(db, user_id, UUID(str(version_id)), False)
    constraints = ExtractedConstraints.model_validate(stored.get("constraints") or {})
    candidates, ranked, _blocked, _plan = await _build(db, constraints)
    replacement = candidate_by_id(ranked, experience_id)
    if replacement is None:
        raise ValueError("alternative is not an eligible retrieved candidate")
    locked_ids: set[UUID] = set()
    exclude_ids: set[UUID] = set()
    target_exp = None
    for stop in current.get("stops") or []:
        exp = UUID(str(stop["experience_id"]))
        if str(stop.get("id")) == str(stop_id):
            target_exp = exp
            continue
        if stop.get("locked"):
            locked_ids.add(exp)
        else:
            exclude_ids.add(exp)
    if target_exp is None:
        raise ValueError("stop not found")
    locked_ids.add(experience_id)
    rebuilt = assemble_plan(ranked, constraints, locked_ids=locked_ids, exclude_ids=exclude_ids - {experience_id})
    old_total = int(current.get("total_minor") or 0)
    preview_id = str(uuid4())
    pending = {
        "kind": "replace",
        "preview_id": preview_id,
        "stop_id": str(stop_id),
        "experience_id": str(experience_id),
        "locked_ids": [str(item) for item in locked_ids],
        "exclude_ids": [str(item) for item in exclude_ids],
    }
    assumed = [AssumedDefault.model_validate(item) for item in (stored.get("assumed_defaults") or [])]
    await upsert_session(
        db,
        user_id,
        session_id,
        locale=constraints.locale,
        raw_text=str(stored.get("raw_text") or ""),
        status=str(stored.get("status") or "planned"),
        round_number=int(stored.get("clarification_round") or 0),
        constraints=constraints,
        assumed=assumed,
        degraded=bool(stored.get("degraded")),
        trip_id=UUID(str(stored["trip_id"])) if stored.get("trip_id") else None,
        version_id=UUID(str(version_id)),
        pending=pending,
    )
    why = []
    for item in ranked:
        if item.candidate.id == experience_id:
            why = item.reasons
            break
    return {
        "preview_id": preview_id,
        "why_fit": why,
        "sponsored": replacement.sponsored,
        "sponsored_label": replacement.sponsored_label,
        "title": replacement.title,
        "delta_cost_minor": rebuilt.total_minor - old_total,
        "delta_minutes": sum((s.ends_at - s.starts_at).seconds // 60 for s in rebuilt.stops)
        - sum(_stop_minutes(s) for s in current.get("stops") or []),
        "new_total_minor": rebuilt.total_minor,
        "stops": [
            {
                "experience_id": str(s.experience_id),
                "title": s.snapshot.get("title"),
                "starts_at": s.starts_at.isoformat(),
                "ends_at": s.ends_at.isoformat(),
                "estimated_minor": s.estimated_minor,
            }
            for s in rebuilt.stops
        ],
        "retrieved_ids": _retrieved_ids(candidates),
    }


def _stop_minutes(stop: dict[str, Any]) -> int:
    start = stop.get("starts_at")
    end = stop.get("ends_at")
    if not start or not end:
        return 0
    from datetime import datetime as dt

    a = dt.fromisoformat(str(start).replace("Z", "+00:00"))
    b = dt.fromisoformat(str(end).replace("Z", "+00:00"))
    return int((b - a).total_seconds() // 60)


async def accept_replace(db: AsyncSession, user_id: UUID, session_id: UUID, preview_id: str) -> dict[str, Any]:
    stored = await get_session(db, user_id, session_id)
    pending = _pending_dict(stored)
    if pending.get("kind") != "replace" or pending.get("preview_id") != preview_id:
        raise ValueError("no matching replacement preview")
    locked_ids = {UUID(item) for item in pending.get("locked_ids") or []}
    exclude_ids = {UUID(item) for item in pending.get("exclude_ids") or []}
    constraints = ExtractedConstraints.model_validate(stored.get("constraints") or {})
    assumed = [AssumedDefault.model_validate(item) for item in (stored.get("assumed_defaults") or [])]
    candidates, ranked, blocked, plan = await _build(db, constraints, locked_ids=locked_ids, exclude_ids=exclude_ids)
    doc = await persist_plan(
        db,
        user_id,
        constraints,
        plan,
        trip_id=UUID(str(stored["trip_id"])) if stored.get("trip_id") else None,
        title=str(stored.get("raw_text") or "Mshwar plan")[:80],
        origin="ai",
        retrieved_ids=_retrieved_ids(candidates),
        assumed=assumed,
        degraded=bool(stored.get("degraded")),
        ranked=_run_candidates(ranked, blocked),
        latency_ms=0,
        run_status="succeeded",
    )
    await upsert_session(
        db,
        user_id,
        session_id,
        locale=constraints.locale,
        raw_text=str(stored.get("raw_text") or ""),
        status="planned",
        round_number=int(stored.get("clarification_round") or 0),
        constraints=constraints,
        assumed=assumed,
        degraded=bool(stored.get("degraded")),
        trip_id=UUID(str(doc["trip_id"])),
        version_id=UUID(str(doc["version_id"])),
        pending={},
    )
    return _session_payload(
        session_id=session_id,
        status="planned",
        degraded=bool(stored.get("degraded")),
        constraints=constraints,
        assumed=assumed,
        questions=[],
        plan_doc=doc,
    )


async def cancel_replace(db: AsyncSession, user_id: UUID, session_id: UUID) -> dict[str, Any]:
    stored = await get_session(db, user_id, session_id)
    constraints = ExtractedConstraints.model_validate(stored.get("constraints") or {})
    assumed = [AssumedDefault.model_validate(item) for item in (stored.get("assumed_defaults") or [])]
    await upsert_session(
        db,
        user_id,
        session_id,
        locale=constraints.locale,
        raw_text=str(stored.get("raw_text") or ""),
        status=str(stored.get("status") or "planned"),
        round_number=int(stored.get("clarification_round") or 0),
        constraints=constraints,
        assumed=assumed,
        degraded=bool(stored.get("degraded")),
        trip_id=UUID(str(stored["trip_id"])) if stored.get("trip_id") else None,
        version_id=UUID(str(stored["current_version_id"])) if stored.get("current_version_id") else None,
        pending={},
    )
    plan_doc = None
    if stored.get("current_version_id"):
        plan_doc = await get_version(db, user_id, UUID(str(stored["current_version_id"])), False)
    return _session_payload(
        session_id=session_id,
        status=str(stored.get("status") or "planned"),
        degraded=bool(stored.get("degraded")),
        constraints=constraints,
        assumed=assumed,
        questions=[],
        plan_doc=plan_doc,
        extra={"cancelled": True},
    )


async def alternatives(db: AsyncSession, user_id: UUID, session_id: UUID, stop_id: UUID) -> list[dict[str, Any]]:
    stored = await get_session(db, user_id, session_id)
    version_id = stored.get("current_version_id")
    if not version_id:
        return []
    current = await get_version(db, user_id, UUID(str(version_id)), False)
    used = {str(stop["experience_id"]) for stop in current.get("stops") or []}
    current_exp = None
    for stop in current.get("stops") or []:
        if str(stop.get("id")) == str(stop_id):
            current_exp = str(stop["experience_id"])
    constraints = ExtractedConstraints.model_validate(stored.get("constraints") or {})
    _candidates, ranked, _blocked, _plan = await _build(db, constraints)
    out: list[dict[str, Any]] = []
    for item in ranked:
        if str(item.candidate.id) in used and str(item.candidate.id) != current_exp:
            continue
        if str(item.candidate.id) == current_exp:
            continue
        out.append(
            {
                "experience_id": str(item.candidate.id),
                "slug": item.candidate.slug,
                "title": item.candidate.title,
                "destination_slug": item.candidate.destination_slug,
                "why_fit": item.reasons,
                "sponsored": item.sponsored,
                "sponsored_label": item.candidate.sponsored_label,
                "price": item.candidate.price,
                "duration_minutes": item.candidate.duration_minutes,
            }
        )
        if len(out) >= 5:
            break
    return out


async def refine_preview(db: AsyncSession, user_id: UUID, session_id: UUID, text_value: str) -> dict[str, Any]:
    injection = await _scan_input(db, user_id, session_id, text_value)
    stored = await get_session(db, user_id, session_id)
    intent = parse_refinement(text_value)
    pending = {"kind": "refine", "intent": intent.model_dump(mode="json")} if intent.understood else {}
    constraints = ExtractedConstraints.model_validate(stored.get("constraints") or {})
    assumed = [AssumedDefault.model_validate(item) for item in (stored.get("assumed_defaults") or [])]
    await upsert_session(
        db,
        user_id,
        session_id,
        locale=constraints.locale,
        raw_text=str(stored.get("raw_text") or ""),
        status=str(stored.get("status") or "planned"),
        round_number=int(stored.get("clarification_round") or 0),
        constraints=constraints,
        assumed=assumed,
        degraded=bool(stored.get("degraded")),
        trip_id=UUID(str(stored["trip_id"])) if stored.get("trip_id") else None,
        version_id=UUID(str(stored["current_version_id"])) if stored.get("current_version_id") else None,
        pending=pending,
    )
    return {
        "understood": intent.understood,
        "summary": intent.summary,
        "clarification": intent.clarification,
        "intent": intent.model_dump(mode="json"),
        "injection_logged": bool(injection),
    }


async def refine_apply(db: AsyncSession, user_id: UUID, session_id: UUID) -> dict[str, Any]:
    stored = await get_session(db, user_id, session_id)
    pending = _pending_dict(stored)
    if pending.get("kind") != "refine":
        raise ValueError("no refinement to apply")
    from app.planner.schemas import RefinementIntent

    intent = RefinementIntent.model_validate(pending.get("intent") or {})
    if not intent.understood:
        raise ValueError("refinement was not understood")
    constraints = apply_refinement(ExtractedConstraints.model_validate(stored.get("constraints") or {}), intent)
    assumed = [AssumedDefault.model_validate(item) for item in (stored.get("assumed_defaults") or [])]
    assumed.append(AssumedDefault(field="refinement", value=intent.summary, label=intent.summary))
    candidates, ranked, blocked, plan = await _build(db, constraints)
    if plan.infeasible:
        return _session_payload(
            session_id=session_id,
            status="infeasible",
            degraded=bool(stored.get("degraded")),
            constraints=constraints,
            assumed=assumed,
            questions=[],
            extra={"reason": plan.infeasible_reason, "blocked": blocked},
        )
    doc = await persist_plan(
        db,
        user_id,
        constraints,
        plan,
        trip_id=UUID(str(stored["trip_id"])) if stored.get("trip_id") else None,
        title=str(stored.get("raw_text") or "Mshwar plan")[:80],
        origin="ai",
        retrieved_ids=_retrieved_ids(candidates),
        assumed=assumed,
        degraded=bool(stored.get("degraded")),
        ranked=_run_candidates(ranked, blocked),
        latency_ms=0,
        run_status="succeeded",
    )
    await upsert_session(
        db,
        user_id,
        session_id,
        locale=constraints.locale,
        raw_text=str(stored.get("raw_text") or ""),
        status="planned",
        round_number=int(stored.get("clarification_round") or 0),
        constraints=constraints,
        assumed=assumed,
        degraded=bool(stored.get("degraded")),
        trip_id=UUID(str(doc["trip_id"])),
        version_id=UUID(str(doc["version_id"])),
        pending={},
    )
    return _session_payload(
        session_id=session_id,
        status="planned",
        degraded=bool(stored.get("degraded")),
        constraints=constraints,
        assumed=assumed,
        questions=[],
        plan_doc=doc,
        extra={"interpreted": intent.summary},
    )
