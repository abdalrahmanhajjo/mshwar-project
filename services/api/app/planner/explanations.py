from __future__ import annotations

import logging
import re
from typing import Any
from uuid import UUID

from app.planner.fixtures import data_prompt
from app.planner.llm import ValidatingLLM, build_client
from app.planner.schemas import AssembledStop, CandidateRecord, ExtractedConstraints, StopExplanationDraft

logger = logging.getLogger("mshwar.planner")

PRICE_RE = re.compile(r"(\$\s?\d+(?:[.,]\d+)?)|(\d+\s*(usd|dollars))", re.IGNORECASE)
TIME_RE = re.compile(r"\b([01]?\d|2[0-3]):[0-5]\d\b")


def _allowed_numbers(stop: AssembledStop) -> set[str]:
    allowed = {str(stop.estimated_minor), f"{stop.estimated_minor / 100:.0f}", f"{stop.estimated_minor / 100:.2f}"}
    allowed.add(stop.starts_at.strftime("%H:%M"))
    allowed.add(stop.ends_at.strftime("%H:%M"))
    return {item.casefold() for item in allowed}


def contradiction_free(text: str, stop: AssembledStop) -> str:
    allowed = _allowed_numbers(stop)
    cleaned = text
    for match in PRICE_RE.finditer(text):
        token = match.group(0)
        digits = re.sub(r"[^\d.]", "", token)
        if digits and digits.casefold() not in allowed and token.casefold() not in allowed:
            cleaned = cleaned.replace(token, "the listed price")
    for match in TIME_RE.finditer(text):
        token = match.group(0)
        padded = token if len(token) == 5 else f"0{token}"
        if token not in allowed and padded not in {stop.starts_at.strftime("%H:%M"), stop.ends_at.strftime("%H:%M")}:
            cleaned = cleaned.replace(token, "the scheduled time")
    forbidden = ("score", "ranker", "embedding", "prompt", "system", "hidden")
    lowered = cleaned.casefold()
    if any(word in lowered for word in forbidden):
        cleaned = template_explanation(stop.snapshot.get("title") or "This stop", stop, None)
    return cleaned.strip()


def template_explanation(title: str, stop: AssembledStop, constraints: ExtractedConstraints | None) -> str:
    dest = str(stop.snapshot.get("destination_slug") or "Lebanon")
    prefs: list[str] = []
    if constraints and constraints.destination_slugs:
        prefs.append("your chosen region")
    if constraints and constraints.intensity:
        prefs.append(f"a {constraints.intensity} pace")
    pref_text = " and ".join(prefs) if prefs else "your stated preferences"
    return f"{title} is included because it matches {pref_text} and is a published listing in {dest}."


def explain_stop(
    stop: AssembledStop,
    candidate: CandidateRecord,
    constraints: ExtractedConstraints,
    rag_chunks: list[dict[str, Any]],
    client: ValidatingLLM | None = None,
) -> str:
    facts = []
    for fact in candidate.facts:
        if isinstance(fact, dict) and fact.get("body"):
            facts.append(str(fact["body"]))
        elif isinstance(fact, str):
            facts.append(fact)
    for chunk in rag_chunks:
        body = str(chunk.get("body") or "").strip()
        if body:
            facts.append(body)
    extra = (
        f"experience_id={candidate.id}\ntitle={candidate.title}\ndestination={candidate.destination_slug}\n"
        f"preferences={constraints.intensity or 'stated preferences'}\n"
        f"verified_facts={facts[:4]}"
    )
    llm = client or build_client()
    try:
        draft = llm.complete_model(data_prompt("explain", extra), StopExplanationDraft, "explain")
        if draft.experience_id != candidate.id:
            return template_explanation(candidate.title, stop, constraints)
        text = contradiction_free(draft.text, stop)
    except Exception:  # noqa: BLE001 - any model failure falls back to the deterministic template
        logger.warning("stop explanation fell back to template experience_id=%s", candidate.id, exc_info=True)
        text = template_explanation(candidate.title, stop, constraints)
    if not text:
        text = template_explanation(candidate.title, stop, constraints)
    return text


def explain_plan(
    stops: list[AssembledStop],
    by_id: dict[UUID, CandidateRecord],
    constraints: ExtractedConstraints,
    chunks_by_id: dict[UUID, list[dict[str, Any]]],
    client: ValidatingLLM | None = None,
) -> None:
    for stop in stops:
        candidate = by_id.get(stop.experience_id)
        if candidate is None:
            continue
        stop.explanation = explain_stop(
            stop, candidate, constraints, chunks_by_id.get(stop.experience_id, []), client=client
        )
