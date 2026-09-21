"""Recorded provider fixtures. No live credentials."""

from __future__ import annotations

import json
import re
from typing import Any

from app.planner.safety import wrap_as_data
from app.planner.schemas import ExtractedConstraints, RefinementIntent, StopExplanationDraft

GOOGLE_DISTANCE_MATRIX_BEIRUT_BYBLOS = {
    "status": "OK",
    "origin_addresses": ["Beirut, Lebanon"],
    "destination_addresses": ["Byblos, Lebanon"],
    "rows": [
        {
            "elements": [
                {
                    "status": "OK",
                    "distance": {"text": "38 km", "value": 38421},
                    "duration": {"text": "52 mins", "value": 3120},
                }
            ]
        }
    ],
}

GOOGLE_DISTANCE_MATRIX_FAILED = {"status": "UNKNOWN_ERROR", "rows": []}

OPEN_METEO_BEIRUT = {
    "latitude": 33.89,
    "longitude": 35.50,
    "generationtime_ms": 0.4,
    "utc_offset_seconds": 10800,
    "timezone": "Asia/Beirut",
    "daily": {
        "time": ["2026-09-14"],
        "precipitation_sum": [12.4],
        "windspeed_10m_max": [28.0],
        "temperature_2m_max": [31.2],
        "temperature_2m_min": [22.1],
        "weathercode": [61],
    },
}

OPEN_METEO_CLEAR = {
    "latitude": 33.89,
    "longitude": 35.50,
    "daily": {
        "time": ["2026-09-20"],
        "precipitation_sum": [0.0],
        "windspeed_10m_max": [12.0],
        "temperature_2m_max": [28.0],
        "temperature_2m_min": [21.0],
        "weathercode": [1],
    },
}

# ---- LLM stub fixtures (Epic 8) ----

_DESTINATION_RE = re.compile(
    r"\b(byblos|jbeil|جبيل|batroun|البترون|bsharri|bcharre|بشري|"
    r"qadisha|قاديشا|baalbek|بعلبك|beirut|beyrouth|بيروت)\b",
    re.IGNORECASE,
)


def _user_payload(prompt: str) -> str:
    match = re.search(r"<<DATA[^>]*>>\n?(.*?)\n?<</DATA>>", prompt, flags=re.DOTALL)
    if match:
        return match.group(1)
    return prompt


def stub_response(prompt: str, schema_name: str) -> str:
    user_text = _user_payload(prompt)
    blob = user_text.casefold()
    if schema_name == "extract":
        return json.dumps(_extract_payload(blob, user_text), ensure_ascii=False)
    if schema_name == "refine":
        return json.dumps(_refine_payload(blob), ensure_ascii=False)
    if schema_name == "explain":
        return json.dumps(_explain_payload(user_text or prompt), ensure_ascii=False)
    return "{}"


def _extract_payload(blob: str, original: str) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "locale": _locale(blob),
        "destination_slugs": _destinations(blob),
        "category_slugs": _categories(blob),
        "kind_slugs": _kinds(blob),
        "interests": _interests(blob),
        "query": _query_remainder(original),
    }
    party = _party_size(blob)
    if party is not None:
        payload["party_size"] = party
    budget = _budget_minor(blob)
    if budget is not None:
        payload["budget_minor"] = budget
    if _looks_strict_budget(blob):
        payload["strict_budget"] = True
    intensity = _intensity(blob)
    if intensity:
        payload["intensity"] = intensity
    if "less driving" in blob or "أقل قيادة" in blob or "moins de route" in blob:
        payload["max_travel_minutes"] = 90
    ExtractedConstraints.model_validate(payload)
    return payload


def _refine_payload(blob: str) -> dict[str, Any]:
    understood = any(
        token in blob
        for token in (
            "less driving",
            "more romantic",
            "romantic",
            "cheaper",
            "budget",
            "strict",
            "party",
            "intensity",
            "أقل قيادة",
            "رومانس",
            "moins de route",
            "plus romantique",
        )
    )
    if not understood:
        payload = {
            "understood": False,
            "summary": "",
            "clarification": "I could not turn that into a preference change. Try “less driving” or “more romantic”.",
        }
        RefinementIntent.model_validate(payload)
        return payload
    out: dict[str, Any] = {"understood": True, "summary": "Preference change understood from your wording."}
    if "less driving" in blob or "أقل قيادة" in blob or "moins de route" in blob:
        out["prefer_less_driving"] = True
        out["max_travel_minutes"] = 90
        out["summary"] = "Reduce driving: cap travel legs at about 90 minutes."
    if "romantic" in blob or "رومانس" in blob or "romantique" in blob:
        out["interests_add"] = ["heritage"]
        out["intensity"] = "relaxed"
        out["summary"] = "Make it more romantic: relaxed pace and heritage-friendly stops."
    if "cheap" in blob or "cheaper" in blob or "رخيص" in blob:
        out["budget_minor"] = 8000
        out["summary"] = "Lower the budget guide to USD 80."
    if "strict" in blob:
        out["strict_budget"] = True
        out["summary"] = "Treat the budget as a hard cap."
    RefinementIntent.model_validate(out)
    return out


def _explain_payload(prompt: str) -> dict[str, Any]:
    exp_match = re.search(r"experience_id=([0-9a-f-]{36})", prompt, flags=re.IGNORECASE)
    title_match = re.search(r"title=(.+)", prompt)
    dest_match = re.search(r"destination=(\S+)", prompt)
    pref_match = re.search(r"preferences=(.+)", prompt)
    experience_id = exp_match.group(1) if exp_match else "00000000-0000-0000-0000-000000000001"
    title = title_match.group(1).strip() if title_match else "This stop"
    dest = dest_match.group(1) if dest_match else "Lebanon"
    prefs = pref_match.group(1).strip() if pref_match else "your stated preferences"
    payload = {
        "experience_id": experience_id,
        "text": f"{title} is included because it matches {prefs} and is a published listing in {dest}.",
        "source_facts": [f"Published inventory in {dest}"],
    }
    StopExplanationDraft.model_validate(payload)
    return payload


def _locale(blob: str) -> str:
    arabic = bool(re.search(r"[\u0600-\u06FF]", blob))
    french = any(token in blob for token in ("journée", "pour deux", "moins de", "beyrouth"))
    lebanese = any(token in blob for token in ("بدي", "مشوار", "هيدا", "هلأ", "لشخصين", "جبيل"))
    if arabic and lebanese:
        return "ar-LB"
    if arabic:
        return "ar"
    if french:
        return "fr"
    return "en"


def _destinations(blob: str) -> list[str]:
    mapping = {
        "byblos": "byblos",
        "jbeil": "byblos",
        "جبيل": "byblos",
        "batroun": "batroun",
        "البترون": "batroun",
        "bsharri": "bsharri",
        "bcharre": "bsharri",
        "بشري": "bsharri",
        "qadisha": "qadisha-valley",
        "قاديشا": "qadisha-valley",
        "baalbek": "baalbek",
        "بعلبك": "baalbek",
        "beirut": "beirut",
        "beyrouth": "beirut",
        "بيروت": "beirut",
    }
    found: list[str] = []
    for alias, slug in mapping.items():
        if alias in blob and slug not in found:
            found.append(slug)
    return found


def _categories(blob: str) -> list[str]:
    mapping = {
        "culture": "culture",
        "heritage": "culture",
        "ثقافة": "culture",
        "nature": "nature",
        "cedar": "nature",
        "طبيعة": "nature",
        "coast": "coast",
        "sea": "coast",
        "ساحل": "coast",
        "adventure": "adventure",
        "hike": "adventure",
        "مغامرة": "adventure",
        "city": "city",
        "مدينة": "city",
    }
    found: list[str] = []
    for alias, slug in mapping.items():
        if alias in blob and slug not in found:
            found.append(slug)
    return found


def _kinds(blob: str) -> list[str]:
    mapping = {
        "restaurant": "restaurant",
        "lunch": "restaurant",
        "dinner": "restaurant",
        "مطعم": "restaurant",
        "غداء": "restaurant",
        "attraction": "attraction",
        "museum": "attraction",
        "experience": "experience",
        "tour": "experience",
    }
    found: list[str] = []
    for alias, slug in mapping.items():
        if alias in blob and slug not in found:
            found.append(slug)
    return found


def _interests(blob: str) -> list[str]:
    found: list[str] = []
    if "romantic" in blob or "رومان" in blob or "romantique" in blob:
        found.append("heritage")
    if "food" in blob or "أكل" in blob:
        found.append("food")
    return found


def _party_size(blob: str) -> int | None:
    if any(token in blob for token in ("لشخصين", "pour deux", "for two", "two people", "couple")):
        return 2
    if any(token in blob for token in ("alone", "solo", "لحالي", "seul")):
        return 1
    match = re.search(r"\b(\d{1,2})\s*(people|guests|persons|أشخاص|personnes)\b", blob)
    if match:
        return int(match.group(1))
    return None


def _budget_minor(blob: str) -> int | None:
    match = re.search(r"\$(\d{1,5})|\b(\d{1,5})\s*(usd|dollars)\b", blob)
    if match:
        amount = int(match.group(1) or match.group(2))
        return amount * 100
    if "cheap" in blob or "رخيص" in blob or "pas cher" in blob:
        return 8000
    return None


def _looks_strict_budget(blob: str) -> bool:
    return "strict" in blob or "do not exceed" in blob or "hard cap" in blob


def _intensity(blob: str) -> str | None:
    if "relax" in blob or "slow" in blob or "هادي" in blob or "lente" in blob:
        return "relaxed"
    if "active" in blob or "hike" in blob:
        return "active"
    return None


def _query_remainder(original: str) -> str:
    return re.sub(_DESTINATION_RE, " ", original).strip()[:200]


def data_prompt(schema_name: str, user_text: str, extra: str = "") -> str:
    body = wrap_as_data("user_text", user_text)
    if extra:
        body += "\n" + extra
    return f"schema={schema_name}\n{body}"
