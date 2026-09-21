"""Notification event taxonomy. Epic 9 composes by emitting these types."""

from __future__ import annotations

from typing import Final

TRAVELLER_EVENTS: Final[frozenset[str]] = frozenset(
    {
        "booking.requested",
        "booking.confirmed",
        "booking.rejected",
        "booking.cancelled",
        "payment.status_changed",
        "itinerary.material_change",
        "marketing.campaign",
    }
)

BUSINESS_EVENTS: Final[frozenset[str]] = frozenset(
    {
        "business.booking.requested",
        "business.request.unanswered",
    }
)

ALL_EVENTS: Final[frozenset[str]] = TRAVELLER_EVENTS | BUSINESS_EVENTS


def category_for(event_type: str) -> str:
    return "marketing" if event_type.startswith("marketing.") else "transactional"


def audience_for(event_type: str) -> str:
    return "business" if event_type.startswith("business.") else "traveller"
