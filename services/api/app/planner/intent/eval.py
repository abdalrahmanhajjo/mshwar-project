from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

from app.planner.intent.extractor import ExtractedIntent, extract_intent

FIXTURE_PATH = Path(__file__).resolve().parent / "fixtures" / "lebanese_arabizi.json"
DEFAULT_THRESHOLD = 0.85


def load_eval_set(path: Path = FIXTURE_PATH) -> dict[str, Any]:
    return cast(dict[str, Any], json.loads(path.read_text(encoding="utf-8")))


def case_passes(result: ExtractedIntent, expected: dict[str, Any]) -> bool:
    return all(getattr(result, key) == value for key, value in expected.items())


def evaluate_dialect_set(path: Path = FIXTURE_PATH) -> tuple[bool, float, list[str]]:
    payload = load_eval_set(path)
    threshold = float(payload.get("threshold", DEFAULT_THRESHOLD))
    cases = payload["cases"]
    failures: list[str] = []
    passed = 0
    for case in cases:
        result = extract_intent(case["prompt"])
        if case_passes(result, case["expected"]):
            passed += 1
        else:
            failures.append(
                f"{case['id']}: expected {case['expected']} got destination={result.destination} "
                f"category={result.category} kind={result.kind} date={result.date_hint} "
                f"party={result.party_size} budget={result.budget} clarify={result.needs_clarification}"
            )
    accuracy = passed / len(cases) if cases else 0.0
    return accuracy + 1e-9 >= threshold, accuracy, failures
