from __future__ import annotations

from typing import Any

from app.planner.eligibility import INTENSITY_TO_RANGE, unit_price_minor
from app.planner.schemas import CandidateRecord, EligibilityResult, ExtractedConstraints, RankedCandidate

DEFAULT_WEIGHTS: dict[str, float] = {
    "preference": 0.34,
    "vector": 0.22,
    "destination": 0.18,
    "price_fit": 0.12,
    "compactness": 0.10,
    "sponsored": 0.04,
}


def _clamp(value: float) -> float:
    if value < 0:
        return 0.0
    if value > 1:
        return 1.0
    return float(value)


def preference_score(candidate: CandidateRecord, constraints: ExtractedConstraints) -> float:
    hits = 0.0
    checks = 0.0
    if constraints.category_slugs:
        checks += 1
        if any(slug in candidate.category_slugs for slug in constraints.category_slugs):
            hits += 1
    if constraints.interests:
        checks += 1
        if any(slug in candidate.interest_slugs for slug in constraints.interests):
            hits += 1
    if constraints.kind_slugs:
        checks += 1
        if candidate.listing_kind in constraints.kind_slugs:
            hits += 1
    if constraints.intensity and candidate.intensity is not None:
        checks += 1
        low, high = INTENSITY_TO_RANGE.get(constraints.intensity, (1, 0))
        if low <= candidate.intensity <= high:
            hits += 1
    if checks == 0:
        return 0.5
    return hits / checks


def price_fit_score(candidate: CandidateRecord, constraints: ExtractedConstraints) -> float:
    amount, kind = unit_price_minor(candidate, constraints.party_size or 2)
    budget = constraints.budget_minor or 0
    if kind == "quote" or budget <= 0 or amount <= 0:
        return 0.5
    ratio = amount / budget
    if ratio <= 0.4:
        return 1.0
    if ratio <= 1:
        return _clamp(1.2 - ratio)
    return 0.0


def compactness_score(candidate: CandidateRecord, constraints: ExtractedConstraints) -> float:
    if constraints.start_lat is None or constraints.start_lng is None:
        return 0.5
    dlat = abs(candidate.lat - constraints.start_lat)
    dlng = abs(candidate.lng - constraints.start_lng)
    dist = (dlat**2 + dlng**2) ** 0.5
    return _clamp(1.0 - dist / 1.5)


def score_candidate(
    result: EligibilityResult,
    constraints: ExtractedConstraints,
    weights: dict[str, float],
) -> RankedCandidate:
    candidate = result.candidate
    merged = {**DEFAULT_WEIGHTS, **weights}
    pref = preference_score(candidate, constraints)
    dest = 1.0 if constraints.destination_slugs and candidate.destination_slug in constraints.destination_slugs else 0.4
    if not constraints.destination_slugs:
        dest = 0.5
    sponsored_component = 1.0 if candidate.sponsored and result.eligible else 0.0
    total = (
        merged["preference"] * pref
        + merged["vector"] * _clamp(candidate.vec)
        + merged["destination"] * dest
        + merged["price_fit"] * price_fit_score(candidate, constraints)
        + merged["compactness"] * compactness_score(candidate, constraints)
        + merged["sponsored"] * sponsored_component
    )
    reasons = [
        f"preference={pref:.2f}",
        f"vector={candidate.vec:.2f}",
        f"destination={dest:.2f}",
    ]
    if candidate.sponsored:
        reasons.append("sponsored_labelled")
    return RankedCandidate(
        candidate=candidate,
        score=round(total, 6),
        eligible=result.eligible,
        sponsored=candidate.sponsored,
        reasons=reasons,
        flags=list(result.flags),
    )


def rank_candidates(
    results: list[EligibilityResult],
    constraints: ExtractedConstraints,
    weights: dict[str, float] | None = None,
) -> list[RankedCandidate]:
    eligible = [row for row in results if row.eligible]
    ranked = [score_candidate(row, constraints, weights or DEFAULT_WEIGHTS) for row in eligible]
    ranked.sort(key=lambda item: (-item.score, str(item.candidate.id)))
    return ranked


def weights_from_payload(payload: Any) -> dict[str, float]:
    if not isinstance(payload, dict):
        return dict(DEFAULT_WEIGHTS)
    out = dict(DEFAULT_WEIGHTS)
    for key, value in payload.items():
        if key in out:
            out[key] = float(value)
    return out
