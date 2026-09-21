from __future__ import annotations

import re
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

INJECTION_PATTERNS = (
    (r"ignore (all )?(previous|prior|above) (instructions|prompts)", "ignore_previous"),
    (r"you are now", "role_override"),
    (r"system prompt", "system_prompt"),
    (r"disregard (the )?(rules|guardrails)", "disregard_rules"),
    (r"\bbook\b.*\b(now|immediately)\b", "book_command"),
    (r"\b(pay|charge|refund)\b", "payment_command"),
    (r"change (the )?price", "price_change"),
    (r"set total (to|at)", "total_override"),
    (r"<\s*script", "markup_injection"),
    (r"\[\[system\]\]", "system_delimiter"),
)


def wrap_as_data(label: str, body: str) -> str:
    cleaned = (body or "").replace("```", "'''")
    return f"<<DATA kind={label}>>\n{cleaned}\n<</DATA>>"


def detect_injection(text_value: str) -> str | None:
    lowered = (text_value or "").casefold()
    for pattern, name in INJECTION_PATTERNS:
        if re.search(pattern, lowered, flags=re.IGNORECASE):
            return name
    return None


def excerpt(text_value: str, limit: int = 180) -> str:
    compact = re.sub(r"\s+", " ", (text_value or "")).strip()
    return compact[:limit]


async def log_safety_event(
    db: AsyncSession,
    user_id: UUID,
    session_id: UUID | None,
    kind: str,
    pattern: str,
    raw: str,
) -> None:
    await db.execute(
        text("SELECT app.planner_log_safety_event(:user_id, :session_id, :kind, :pattern, :excerpt)"),
        {
            "user_id": str(user_id),
            "session_id": str(session_id) if session_id else None,
            "kind": kind,
            "pattern": pattern,
            "excerpt": excerpt(raw),
        },
    )


def assert_no_side_effects(payload: dict[str, object]) -> None:
    lowered_keys = {str(key).casefold() for key in payload}
    blocked = lowered_keys & {
        "book",
        "booking_id",
        "payment",
        "pay",
        "charge",
        "total",
        "total_minor",
        "price_override",
        "amount_minor",
    }
    if blocked:
        raise ValueError(f"model output attempted side effect: {sorted(blocked)}")
