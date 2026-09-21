"""Epic 8 LLM intent extraction. Dialect/Arabizi eval lives in extractor.py."""

from __future__ import annotations

from app.planner.defaults import has_intent_anchor
from app.planner.fixtures import data_prompt
from app.planner.llm import INTENT_SYSTEM, ValidatingLLM, build_client
from app.planner.schemas import ClarificationQuestion, ExtractedConstraints

MISSING_ANCHOR = ClarificationQuestion(
    field="intent_anchor",
    prompt="Which region or kind of day do you want — for example Byblos, the coast, or a slow harbour lunch?",
    required=True,
)


def extract_constraints(text: str, locale: str, client: ValidatingLLM | None = None) -> ExtractedConstraints:
    llm = client or build_client()
    prompt = INTENT_SYSTEM + "\n" + data_prompt("extract", text, extra=f"locale_hint={locale}")
    extracted = llm.complete_model(prompt, ExtractedConstraints, "extract")
    if not extracted.query:
        extracted.query = text[:200]
    if extracted.locale == "en" and locale in {"ar", "ar-LB", "fr", "mixed"}:
        extracted.locale = locale
    return extracted


def clarification_for(extracted: ExtractedConstraints, round_number: int) -> list[ClarificationQuestion]:
    if round_number >= 2:
        return []
    questions: list[ClarificationQuestion] = []
    if not has_intent_anchor(extracted):
        questions.append(MISSING_ANCHOR)
    return questions
