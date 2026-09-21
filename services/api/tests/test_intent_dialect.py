from __future__ import annotations

from app.planner.intent.eval import DEFAULT_THRESHOLD, evaluate_dialect_set
from app.planner.intent.extractor import extract_intent, normalize_prompt


def test_arabizi_normalizes_digits() -> None:
    assert "ع" in normalize_prompt("3a jbeil")
    assert "ح" in normalize_prompt("7abibti")


def test_low_confidence_asks_for_clarification() -> None:
    result = extract_intent("بدي شي")
    assert result.needs_clarification is True
    assert result.destination is None
    assert result.clarification_prompt
    assert "وين" in result.clarification_prompt


def test_dialect_eval_set_meets_threshold() -> None:
    ok, accuracy, failures = evaluate_dialect_set()
    assert ok, f"accuracy={accuracy:.2f} below {DEFAULT_THRESHOLD}: {failures}"
    assert accuracy >= DEFAULT_THRESHOLD


def test_empty_and_french_clarification() -> None:
    empty = extract_intent("")
    assert empty.needs_clarification is True
    assert empty.destination is None
    french = extract_intent("on veut un voyage")
    assert french.language == "fr"
    assert french.needs_clarification is True
    assert french.clarification_prompt and "où" in french.clarification_prompt.casefold()
