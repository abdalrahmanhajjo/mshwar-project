"""Lebanese Arabic / Arabizi dialect extractor.

Epic 8 LLM extraction lives in `constraints.extract_constraints`. This path is
lexicon-based for the 85% dialect eval set and must ask for clarification
instead of guessing when confidence is low.
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import dataclass, field

ARABIZI_DIGITS = {
    "2": "ء",
    "3": "ع",
    "5": "خ",
    "6": "ط",
    "7": "ح",
    "8": "غ",
    "9": "ق",
}

DESTINATION_CUES: dict[str, Sequence[str]] = {
    "byblos": ("byblos", "jbeil", "jbeel", "jebeil", "جبيل"),
    "batroun": ("batroun", "البترون", "بترون"),
    "bsharri": ("bsharri", "bcharre", "bsharre", "بشري"),
    "qadisha-valley": ("qadisha", "kadisha", "قاديشا", "وادي قاديشا"),
    "baalbek": ("baalbek", "baalbeck", "بعلبك"),
    "beirut": ("beirut", "beyrouth", "beirout", "بيروت"),
}

CATEGORY_CUES: dict[str, Sequence[str]] = {
    "nature": ("nature", "cedar", "cedars", "arz", "jabal", "جبل", "ارز", "أرز", "طبيعة"),
    "coast": ("coast", "sea", "beach", "baher", "bahar", "bahr", "بحر", "ساحل"),
    "culture": ("culture", "heritage", "history", "ثقافة", "تراث"),
    "adventure": ("adventure", "hike", "hiking", "مغامرة"),
    "city": ("city", "urban", "souk", "مدينة"),
}

KIND_CUES: dict[str, Sequence[str]] = {
    "restaurant": ("restaurant", "lunch", "dinner", "eat", "akl", "akel", "مطعم", "غدا", "غداء"),
    "attraction": ("attraction", "museum", "walls", "معلم"),
    "experience": ("experience", "tour", "تجربة"),
}

DATE_CUES: dict[str, Sequence[str]] = {
    "today": ("today", "el yom", "alyom", "lyom", "اليوم"),
    "tomorrow": ("tomorrow", "bokra", "bukra", "بكرة", "غدا"),
    "weekend": ("weekend", "week end", "wekend", "الويكند", "ويكند"),
}

BUDGET_CUES: dict[str, Sequence[str]] = {
    "low": ("cheap", "budget", "rkhis", "rkhees", "رخيص"),
}

PARTY_CUES: tuple[tuple[str, int], ...] = (
    ("tnen", 2),
    ("tnein", 2),
    ("tnayn", 2),
    ("تنين", 2),
    ("اتنين", 2),
    ("3ayle", 4),
    ("3ele", 4),
    ("family", 4),
    ("عيله", 4),
    ("عائلة", 4),
)

CLARIFY_AR = "ما فهمت المطلوب. قلي وين بدك تروح، ومتى، وكم شخص؟"
CLARIFY_EN = "I did not catch a place, date or activity. Where do you want to go, and when?"
CLARIFY_FR = "Je n’ai pas compris le lieu ni la date. Où voulez-vous aller, et quand ?"


@dataclass
class ExtractedIntent:
    raw: str
    destination: str | None = None
    category: str | None = None
    kind: str | None = None
    party_size: int | None = None
    date_hint: str | None = None
    budget: str | None = None
    language: str = "mixed"
    confidence: float = 0.0
    needs_clarification: bool = False
    clarification_prompt: str | None = None
    matched_cues: list[str] = field(default_factory=list)


def _strip_diacritics(text: str) -> str:
    return re.sub(r"[\u064b-\u065f\u0670\u0640]", "", text)


def normalize_prompt(text: str) -> str:
    lowered = (text or "").casefold()
    replaced = [ARABIZI_DIGITS.get(char, char) for char in lowered]
    normalized = "".join(replaced)
    normalized = normalized.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ة", "ه")
    return _strip_diacritics(normalized)


def detect_language(text: str) -> str:
    has_arabic = bool(re.search(r"[\u0600-\u06ff]", text))
    has_latin = bool(re.search(r"[a-z]", text.casefold()))
    has_arabizi = bool(re.search(r"[2-9]", text)) and has_latin
    if has_arabizi or (has_latin and re.search(r"\b(bade|bedde|nrouh|jbeil|bokra|shu|3a)\b", text.casefold())):
        return "arabizi"
    if has_arabic:
        return "ar-LB"
    if re.search(r"\b(on veut|aller|à)\b", text.casefold()):
        return "fr"
    if has_latin:
        return "en"
    return "mixed"


def _first_cue(haystacks: Sequence[str], mapping: dict[str, Sequence[str]]) -> tuple[str | None, str | None]:
    for slug, cues in mapping.items():
        for cue in cues:
            needle = cue.casefold()
            if any(needle in hay for hay in haystacks):
                return slug, cue
    return None, None


def extract_intent(raw: str) -> ExtractedIntent:
    """Extract structured trip intent. Never guess a destination on low confidence."""
    text = (raw or "").strip()
    intent = ExtractedIntent(raw=text)
    if not text:
        intent.needs_clarification = True
        intent.clarification_prompt = CLARIFY_EN
        return intent

    lowered = text.casefold()
    normalized = normalize_prompt(text)
    haystacks = (lowered, normalized)
    intent.language = detect_language(text)

    dest, dest_cue = _first_cue(haystacks, DESTINATION_CUES)
    category, category_cue = _first_cue(haystacks, CATEGORY_CUES)
    kind, kind_cue = _first_cue(haystacks, KIND_CUES)
    date_hint, date_cue = _first_cue(haystacks, DATE_CUES)
    budget, budget_cue = _first_cue(haystacks, BUDGET_CUES)

    party_size: int | None = None
    party_cue: str | None = None
    party_match = re.search(r"\b(\d+)\s*(?:persons?|people|pax|اشخاص|أشخاص)\b", lowered)
    if party_match:
        party_size = int(party_match.group(1))
        party_cue = party_match.group(0)
    else:
        for cue, size in PARTY_CUES:
            if cue.casefold() in lowered or cue.casefold() in normalized:
                party_size = size
                party_cue = cue
                break

    for label, value in (
        (dest_cue, dest),
        (category_cue, category),
        (kind_cue, kind),
        (date_cue, date_hint),
        (budget_cue, budget),
        (party_cue, party_size),
    ):
        if label and value is not None:
            intent.matched_cues.append(str(label))

    filled = sum(1 for item in (dest, category, kind, date_hint, party_size, budget) if item is not None)
    actionable = dest is not None or category is not None or kind is not None
    if actionable:
        intent.destination = dest
        intent.category = category
        intent.kind = kind
        intent.date_hint = date_hint
        intent.party_size = party_size
        intent.budget = budget
        intent.confidence = min(1.0, 0.62 + 0.08 * max(0, filled - 1))
        intent.needs_clarification = False
    else:
        intent.confidence = 0.2 if filled else 0.1
        intent.needs_clarification = True
        intent.destination = None
        intent.category = None
        intent.kind = None
        intent.date_hint = None
        intent.party_size = None
        intent.budget = None
        if intent.language in {"ar-LB", "arabizi"}:
            intent.clarification_prompt = CLARIFY_AR
        elif intent.language == "fr":
            intent.clarification_prompt = CLARIFY_FR
        else:
            intent.clarification_prompt = CLARIFY_EN
    return intent
