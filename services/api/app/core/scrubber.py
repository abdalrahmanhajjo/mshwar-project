"""Removes secrets and personal data from anything headed for a log or error report (MSHWAR-111).

``SENSITIVE_FIELDS`` is the registry: each class lists the key names whose
values are always replaced, and ``VALUE_PATTERNS`` catches the same data when it
shows up inside free text (an exception message, a URL, a SQL echo line).

Used by the logging filter (``app.core.logging``) and Sentry's ``before_send``
(``app.core.observability``). tests/test_scrubber.py proves every class is removed.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

REDACTED = "[redacted]"
_MAX_DEPTH = 8

SENSITIVE_FIELDS: dict[str, frozenset[str]] = {
    "credential": frozenset(
        {
            "password",
            "new_password",
            "current_password",
            "passwd",
            "secret",
            "secret_key",
            "client_secret",
            "token",
            "access_token",
            "refresh_token",
            "id_token",
            "session_token",
            "token_hash",
            "api_key",
            "apikey",
            "authorization",
            "proxy-authorization",
            "cookie",
            "set-cookie",
            "x-job-token",
            "x-notification-token",
            "stripe-signature",
            "webhook_secret",
            "mshwar_session",
            "mshwar_guest",
            "otp",
            "code_verifier",
            "private_key",
            "dsn",
        }
    ),
    "payment": frozenset(
        {
            "card",
            "card_number",
            "cardnumber",
            "pan",
            "cvc",
            "cvv",
            "exp_month",
            "exp_year",
            "iban",
            "account_number",
            "routing_number",
            "payment_method",
            "payment_method_id",
            "payment_intent",
            "provider_reference",
            "provider_payment_id",
            "customer_id",
            "last4",
        }
    ),
    "personal": frozenset(
        {
            "email",
            "to_email",
            "phone",
            "phone_number",
            "whatsapp",
            "full_name",
            "first_name",
            "last_name",
            "legal_name",
            "address",
            "street",
            "date_of_birth",
            "dob",
            "national_id",
            "passport",
            "id_number",
            "ip",
            "ip_address",
            "client_ip",
            "user_agent",
            "latitude",
            "longitude",
            "lat",
            "lng",
            "message_body",
            "notes",
        }
    ),
}
_ALL_FIELDS = frozenset().union(*SENSITIVE_FIELDS.values())
_FIELD_SUFFIXES = ("_token", "_secret", "_password", "_email", "_phone", "_key")
# Identifiers that merely contain a sensitive word ("token_count") are fine.
_SAFE_FIELDS = frozenset({"token_count", "tokens", "prompt_tokens", "completion_tokens", "email_domain", "key"})

_EMAIL = re.compile(r"([A-Za-z0-9._%+-]{1,64})@([A-Za-z0-9.-]+\.[A-Za-z]{2,})")
_PROVIDER_SECRET = re.compile(
    r"\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{8,}|\bwhsec_[A-Za-z0-9]{8,}|\bpi_[A-Za-z0-9]+_secret_[A-Za-z0-9]+"
)
_BEARER = re.compile(r"(?i)\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}")
_JWT = re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}")
_CARD = re.compile(r"\b(?:\d[ -]?){12,18}\d\b")
_PHONE_INTL = re.compile(r"(?<![\w+-])\+\d{1,3}[ -]?(?:\d[ -]?){6,13}\d(?![\w-])")
_PHONE_LB = re.compile(r"(?<![\w+-])(?:0?3|7[0169]|81)[ -]?\d{3}[ -]?\d{3}(?![\w-])")
_URL_SECRET_PATH = re.compile(r"(/(?:unsubscribe|join|files|invitations|reset-password|verify-email)/)[^/\s?#\"']{12,}")
_QUERY_SECRET = re.compile(r"(?i)([?&](?:token|invite|code|signature|sig|key|password|secret|email)=)[^&\s#\"']+")
_KEY_VALUE = re.compile(
    r"(?i)\b(password|passwd|secret|token|api_key|apikey|authorization|cookie)(\s*[=:]\s*)(\"[^\"]*\"|'[^']*'|[^\s,;]+)"
)


def _luhn_ok(digits: str) -> bool:
    total = 0
    for index, char in enumerate(reversed(digits)):
        value = int(char)
        if index % 2 == 1:
            value *= 2
            if value > 9:
                value -= 9
        total += value
    return total % 10 == 0


def _mask_card(match: re.Match[str]) -> str:
    digits = re.sub(r"\D", "", match.group(0))
    if 13 <= len(digits) <= 19 and _luhn_ok(digits):
        return "[redacted:card]"
    return match.group(0)


def mask_email(value: str) -> str:
    return _EMAIL.sub(lambda m: f"***@{m.group(2)}", value)


def scrub_text(value: str) -> str:
    text = _PROVIDER_SECRET.sub("[redacted:secret]", value)
    text = _JWT.sub("[redacted:token]", text)
    text = _BEARER.sub(lambda m: f"{m.group(1)} [redacted]", text)
    text = _URL_SECRET_PATH.sub(lambda m: f"{m.group(1)}[redacted]", text)
    text = _QUERY_SECRET.sub(lambda m: f"{m.group(1)}[redacted]", text)
    text = _KEY_VALUE.sub(lambda m: f"{m.group(1)}{m.group(2)}[redacted]", text)
    text = _CARD.sub(_mask_card, text)
    text = mask_email(text)
    text = _PHONE_INTL.sub("[redacted:phone]", text)
    return _PHONE_LB.sub("[redacted:phone]", text)


def field_class(name: str) -> str | None:
    lowered = name.lower().replace(" ", "_")
    if lowered in _SAFE_FIELDS:
        return None
    for label, fields in SENSITIVE_FIELDS.items():
        if lowered in fields:
            return label
    if lowered.endswith(_FIELD_SUFFIXES):
        return "credential" if not lowered.endswith(("_email", "_phone")) else "personal"
    return None


def scrub(value: Any, _depth: int = 0) -> Any:
    """Return a copy of ``value`` with sensitive fields and patterns removed."""
    if _depth > _MAX_DEPTH:
        return REDACTED
    if isinstance(value, str):
        return scrub_text(value)
    if isinstance(value, bytes):
        return scrub_text(value.decode("utf-8", "replace"))
    if isinstance(value, Mapping):
        cleaned: dict[Any, Any] = {}
        for key, item in value.items():
            if isinstance(key, str) and field_class(key) is not None and item not in (None, "", [], {}):
                cleaned[key] = REDACTED
            else:
                cleaned[key] = scrub(item, _depth + 1)
        return cleaned
    if isinstance(value, list | tuple):
        items = [
            _scrub_pair(item, _depth + 1)
            if isinstance(item, list | tuple) and len(item) == 2
            else scrub(item, _depth + 1)
            for item in value
        ]
        return items if isinstance(value, list) else tuple(items)
    return value


def _scrub_pair(pair: Any, depth: int) -> Any:
    """Header lists arrive as [name, value] pairs."""
    name, item = pair
    if isinstance(name, str | bytes):
        key = name.decode("latin-1") if isinstance(name, bytes) else name
        if field_class(key) is not None:
            return type(pair)([name, REDACTED])
    return type(pair)(scrub(part, depth) for part in pair)
