from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator

PRICE_TYPES = frozenset({"fixed", "from", "estimated", "quote-required"})
PRICE_SOURCES = frozenset({"catalogue-seed", "provider", "operator", "unknown"})


class PriceModel(BaseModel):
    """Every public price carries currency, type, and an effective source."""

    currency: str = Field(min_length=3, max_length=3)
    type: str
    source: str
    amount_minor: int | None = None
    amount: float = 0

    @field_validator("currency")
    @classmethod
    def currency_is_iso(cls, value: str) -> str:
        code = value.strip().upper()
        if len(code) != 3 or not code.isalpha():
            raise ValueError("currency must be an ISO 4217 code")
        return code

    @field_validator("type")
    @classmethod
    def type_is_controlled(cls, value: str) -> str:
        mapped = "quote-required" if value in {"quote", "quote-required"} else value
        if mapped == "range":
            mapped = "from"
        if mapped not in PRICE_TYPES:
            raise ValueError("invalid price type")
        return mapped

    @field_validator("source")
    @classmethod
    def source_is_present(cls, value: str) -> str:
        return value.strip() or "unknown"

    @classmethod
    def from_row(cls, payload: dict[str, Any] | None) -> PriceModel:
        data = payload or {}
        amount_minor = data.get("amount_minor")
        amount = data.get("amount")
        if amount is None and amount_minor is not None:
            amount = float(amount_minor) / 100.0
        return cls(
            currency=str(data.get("currency") or "USD"),
            type=str(data.get("type") or data.get("price_type") or "from"),
            source=str(data.get("source") or "unknown"),
            amount_minor=amount_minor,
            amount=float(amount or 0),
        )

    def as_label(self) -> str:
        if self.type == "estimated":
            return "estimated"
        if self.type == "quote-required":
            return "quote"
        return "from"
