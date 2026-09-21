from __future__ import annotations

from datetime import datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from app.core.geo import BEIRUT_LAT, BEIRUT_LNG
from app.planner.schemas import AssumedDefault, ExtractedConstraints

BEIRUT = ZoneInfo("Asia/Beirut")

DEFAULT_PARTY_SIZE = 2
DEFAULT_BUDGET_MINOR = 20000
DEFAULT_CURRENCY = "USD"
DEFAULT_DAY_START = time(9, 0)
DEFAULT_DAY_END = time(18, 0)


def next_open_window(now: datetime | None = None) -> tuple[datetime, datetime]:
    current = now.astimezone(BEIRUT) if now else datetime.now(BEIRUT)
    start_day = current.date() + timedelta(days=1)
    start = datetime.combine(start_day, DEFAULT_DAY_START, tzinfo=BEIRUT)
    end = datetime.combine(start_day, DEFAULT_DAY_END, tzinfo=BEIRUT)
    return start, end


_ANCHOR_ALIASES = {
    "byblos": "byblos",
    "jbeil": "byblos",
    "جبيل": "byblos",
    "batroun": "batroun",
    "coast": "batroun",
    "beirut": "beirut",
    "بيروت": "beirut",
}


def _apply_answers(payload: dict[str, Any], answers: dict[str, Any] | None) -> None:
    """Merge clarification answers; the free-text anchor becomes a destination slug."""
    mapped = dict(answers or {})
    anchor = mapped.pop("intent_anchor", None)
    if isinstance(anchor, str) and anchor.strip():
        token = anchor.strip().casefold()
        slug = _ANCHOR_ALIASES.get(token, token.replace(" ", "-"))
        destinations = list(payload.get("destination_slugs") or [])
        if slug not in destinations:
            destinations.append(slug)
        payload["destination_slugs"] = destinations
    for key, value in mapped.items():
        if key in payload and value not in (None, "", []):
            payload[key] = value


def _default_return_by(window_start: datetime | str) -> datetime:
    """Same-day 18:00 Beirut, or eight hours after a late start."""
    start = datetime.fromisoformat(window_start) if isinstance(window_start, str) else window_start
    if start.tzinfo is None:
        start = start.replace(tzinfo=BEIRUT)
    return_by = datetime.combine(start.astimezone(BEIRUT).date(), DEFAULT_DAY_END, tzinfo=BEIRUT)
    if return_by <= start:
        return_by = start + timedelta(hours=8)
    return return_by


def _ensure_beirut(value: Any) -> datetime | None:
    """Coerce a provided datetime (or ISO string) to timezone-aware Beirut time.

    Structured answers may carry a naive ``window_start``/``return_by``; downstream
    planner math mixes them with aware datetimes, so normalise here.
    """
    if value in (None, ""):
        return None
    parsed = datetime.fromisoformat(value) if isinstance(value, str) else value
    if not isinstance(parsed, datetime):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=BEIRUT)
    return parsed


def apply_defaults(
    extracted: ExtractedConstraints,
    answers: dict[str, Any] | None = None,
) -> tuple[ExtractedConstraints, list[AssumedDefault]]:
    payload = extracted.model_dump()
    _apply_answers(payload, answers)
    for _field in ("window_start", "return_by"):
        if payload.get(_field) is not None:
            payload[_field] = _ensure_beirut(payload[_field])
    assumed: list[AssumedDefault] = []
    window_start, _window_end = next_open_window()
    if payload.get("party_size") is None:
        payload["party_size"] = DEFAULT_PARTY_SIZE
        assumed.append(AssumedDefault(field="party_size", value=DEFAULT_PARTY_SIZE, label="Party size 2"))
    if payload.get("window_start") is None:
        payload["window_start"] = window_start
        assumed.append(
            AssumedDefault(field="window_start", value=window_start.isoformat(), label="Starts tomorrow 09:00 Beirut")
        )
    if payload.get("return_by") is None:
        payload["return_by"] = _default_return_by(payload["window_start"])
        assumed.append(
            AssumedDefault(field="return_by", value=payload["return_by"].isoformat(), label="Returns 18:00 Beirut")
        )
    if payload.get("start_lat") is None or payload.get("start_lng") is None:
        payload["start_lat"] = BEIRUT_LAT
        payload["start_lng"] = BEIRUT_LNG
        assumed.append(AssumedDefault(field="start_location", value="Beirut", label="Start in Beirut"))
    if payload.get("budget_minor") is None:
        payload["budget_minor"] = DEFAULT_BUDGET_MINOR
        assumed.append(
            AssumedDefault(field="budget_minor", value=DEFAULT_BUDGET_MINOR, label="Budget USD 200 (not strict)")
        )
    if payload.get("strict_budget") is None:
        payload["strict_budget"] = False
        assumed.append(AssumedDefault(field="strict_budget", value=False, label="Budget is a guide, not a hard cap"))
    if not payload.get("currency"):
        payload["currency"] = DEFAULT_CURRENCY
    return ExtractedConstraints.model_validate(payload), assumed


def has_intent_anchor(extracted: ExtractedConstraints) -> bool:
    return bool(extracted.destination_slugs or extracted.category_slugs or extracted.kind_slugs or extracted.interests)
