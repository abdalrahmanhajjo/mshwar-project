"""Process-wide logging (MSHWAR-111).

Every record passes through ``ScrubbingFilter`` before it is written, which
masks secrets and personal data (see ``app.core.scrubber``) and stamps the
request's correlation id. The filter sits on the app logger and on the
uvicorn and SQLAlchemy loggers, whose lines carry URL paths and bound SQL
parameters.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime

from app.core.request_context import current_request_id
from app.core.scrubber import scrub, scrub_text

_STANDARD_ATTRS = frozenset(logging.LogRecord("", 0, "", 0, "", (), None).__dict__) | {"message", "asctime"}
FILTERED_LOGGERS = ("mshwar", "uvicorn", "uvicorn.access", "uvicorn.error", "sqlalchemy.engine", "fastapi")


class ScrubbingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if getattr(record, "_mshwar_scrubbed", False):
            return True
        try:
            message = record.getMessage()
        except Exception:  # noqa: BLE001 - a bad format string must not drop the record
            message = str(record.msg)
        record.msg = scrub_text(message)
        record.args = ()
        for key, value in list(record.__dict__.items()):
            if key not in _STANDARD_ATTRS:
                record.__dict__[key] = scrub({key: value})[key]
        if record.exc_info and not record.exc_text:
            record.exc_text = scrub_text(logging.Formatter().formatException(record.exc_info))
        elif record.exc_text:
            record.exc_text = scrub_text(record.exc_text)
        if not getattr(record, "request_id", None):
            record.request_id = current_request_id()
        record._mshwar_scrubbed = True
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        payload.update(
            {
                key: value
                for key, value in record.__dict__.items()
                if key not in _STANDARD_ATTRS and not key.startswith("_")
            }
        )
        if record.exc_text:
            payload["exc_info"] = record.exc_text
        elif record.exc_info:
            payload["exc_info"] = scrub_text(self.formatException(record.exc_info))
        return json.dumps(payload, default=str)


class TextFormatter(logging.Formatter):
    def __init__(self) -> None:
        super().__init__("%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s")

    def format(self, record: logging.LogRecord) -> str:
        if not hasattr(record, "request_id"):
            record.request_id = current_request_id() or "-"
        return super().format(record)


def _make_handler(log_format: str) -> logging.Handler:
    handler = logging.StreamHandler()
    handler.addFilter(ScrubbingFilter())
    handler.setFormatter(JsonFormatter() if log_format == "json" else TextFormatter())
    return handler


def configure_logging(level: str, log_format: str) -> None:
    root = logging.getLogger("mshwar")
    root.handlers[:] = [_make_handler(log_format)]
    root.setLevel(level.upper())
    root.propagate = False
    for name in FILTERED_LOGGERS:
        target = logging.getLogger(name)
        if not any(isinstance(existing, ScrubbingFilter) for existing in target.filters):
            target.addFilter(ScrubbingFilter())
        if name == "mshwar":
            continue
        # Route uvicorn / sqlalchemy / fastapi through our own handler and stop
        # propagation. This removes uvicorn's AccessFormatter from the chain, which
        # rebuilds the access line by unpacking record.args -- the args the
        # ScrubbingFilter clears after formatting, which otherwise raises
        # "not enough values to unpack" while logging every single request.
        target.handlers[:] = [_make_handler(log_format)]
        target.propagate = False
        target.setLevel(level.upper())
