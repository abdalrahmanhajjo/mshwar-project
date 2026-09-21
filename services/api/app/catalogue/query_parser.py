from __future__ import annotations

import re
from dataclasses import dataclass, field

DESTINATION_ALIASES = {
    "byblos": {"byblos", "jbeil", "جبيل"},
    "batroun": {"batroun", "البترون"},
    "bsharri": {"bsharri", "bcharre", "بشري"},
    "qadisha-valley": {"qadisha", "qadisha valley", "وادي قاديشا", "vallée"},
    "baalbek": {"baalbek", "بعلبك"},
    "beirut": {"beirut", "beyrouth", "بيروت"},
}

CATEGORY_ALIASES = {
    "culture": {"culture", "heritage", "history", "ثقافة"},
    "nature": {"nature", "cedar", "forest", "طبيعة", "أرز"},
    "coast": {"coast", "sea", "beach", "ساحل", "بحر"},
    "adventure": {"adventure", "hike", "hiking", "مغامرة"},
    "city": {"city", "urban", "souk", "مدينة"},
}

KIND_ALIASES = {
    "restaurant": {"restaurant", "lunch", "dinner", "eat", "مطعم", "غداء"},
    "attraction": {"attraction", "museum", "walls", "معلم"},
    "experience": {"experience", "tour", "تجربة"},
}

STOPWORDS = {
    "in",
    "the",
    "a",
    "an",
    "of",
    "and",
    "or",
    "not",
    "to",
    "at",
    "on",
    "for",
    "with",
    "from",
    "by",
    "near",
    "around",
    "dans",
    "de",
    "et",
    "la",
    "le",
    "les",
    "un",
    "une",
    "du",
    "des",
    "في",
    "من",
    "إلى",
    "و",
}


@dataclass
class ParsedQuery:
    q: str
    destination: str | None = None
    category: str | None = None
    kind: str | None = None
    price_max: int | None = None
    filters: dict[str, str] = field(default_factory=dict)


def search_tokens(raw: str) -> list[str]:
    """Split a query into significant tokens, dropping punctuation and stopwords."""
    parts = re.split(r"\s+", (raw or "").casefold())
    cleaned: list[str] = []
    for part in parts:
        token = part.strip(".,;:!?\"'()[]{}")
        if len(token) >= 2 and token not in STOPWORDS:
            cleaned.append(token)
    return cleaned


def _strip_whole_alias(text: str, alias: str) -> str:
    return re.sub(rf"(?<!\w){re.escape(alias)}(?!\w)", " ", text, flags=re.IGNORECASE)


def parse_search_query(raw: str) -> ParsedQuery:
    """Map a natural-language string onto the same catalogue filters as keyword search."""
    text = (raw or "").strip()
    lowered = text.casefold()
    parsed = ParsedQuery(q=text)
    matched_aliases: list[str] = []
    for slug, aliases in DESTINATION_ALIASES.items():
        hit = next((alias for alias in aliases if alias in lowered), None)
        if hit is not None:
            parsed.destination = slug
            parsed.filters["destination"] = slug
            matched_aliases.append(hit)
            break
    for slug, aliases in CATEGORY_ALIASES.items():
        hit = next((alias for alias in aliases if alias in lowered), None)
        if hit is not None:
            parsed.category = slug
            parsed.filters["category"] = slug
            matched_aliases.append(hit)
            break
    for slug, aliases in KIND_ALIASES.items():
        hit = next((alias for alias in aliases if alias in lowered), None)
        if hit is not None:
            parsed.kind = slug
            parsed.filters["kind"] = slug
            matched_aliases.append(hit)
            break
    price_cues = ("cheap", "budget", "رخيص", "pas cher")
    if any(token in lowered for token in price_cues):
        parsed.price_max = 30
        parsed.filters["price_max"] = "30"
        matched_aliases.extend(price_cues)
    remainder = lowered
    for alias in sorted(set(matched_aliases), key=len, reverse=True):
        remainder = _strip_whole_alias(remainder, alias)
    parsed.q = " ".join(search_tokens(remainder))
    return parsed


def relaxation_steps(parsed: ParsedQuery) -> list[dict[str, str]]:
    steps: list[dict[str, str]] = []
    if parsed.q:
        steps.append({"drop": "q", "label": "Search without these words"})
    if parsed.kind:
        steps.append({"drop": "kind", "label": "Any listing kind"})
    if parsed.category:
        steps.append({"drop": "category", "label": "Any category"})
    if parsed.destination:
        steps.append({"drop": "destination", "label": "Anywhere in Lebanon"})
    if parsed.price_max is not None:
        steps.append({"drop": "price_max", "label": "Any price"})
    return steps
