"""One error shape for every response (MSHWAR-108, MSHWAR-111).

    {"detail": "<human message>", "code": "<stable machine code>", "request_id": "<id>"}

``detail`` keeps FastAPI's field name so existing clients keep working. The
messages for 401/403/404 are fixed strings: they never say whether a record
exists, which capability was missing, or anything from the database.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.observability import report_exception
from app.core.request_context import current_request_id
from app.core.sql import INTERNAL, raise_from_db

logger = logging.getLogger("mshwar.errors")

NOT_AUTHENTICATED = "Not authenticated"
NOT_FOUND = "Not found."

CODES: dict[int, str] = {
    400: "bad_request",
    401: "unauthenticated",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    410: "gone",
    413: "payload_too_large",
    415: "unsupported_media_type",
    422: "invalid",
    429: "rate_limited",
    500: "internal",
    502: "upstream_error",
    503: "unavailable",
    504: "upstream_timeout",
}


class ApiError(HTTPException):
    """An HTTPException with an explicit machine-readable code (e.g. ``ai_quota_exceeded``)."""

    def __init__(self, status_code: int, detail: str, code: str, headers: dict[str, str] | None = None) -> None:
        super().__init__(status_code=status_code, detail=detail, headers=headers)
        self.code = code


def error_body(
    status_code: int, detail: Any, code: str | None = None, request: Request | None = None
) -> dict[str, Any]:
    body: dict[str, Any] = {"detail": detail, "code": code or CODES.get(status_code, "error")}
    request_id = current_request_id() or (getattr(request.state, "request_id", None) if request else None)
    if request_id:
        body["request_id"] = request_id
    return body


def _normalise(status_code: int, detail: Any) -> Any:
    if status_code == status.HTTP_404_NOT_FOUND and not isinstance(detail, str):
        return NOT_FOUND
    if status_code >= 500 and status_code not in (502, 503, 504):
        return INTERNAL
    return detail


async def _http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = getattr(exc, "code", None)
    return JSONResponse(
        error_body(exc.status_code, _normalise(exc.status_code, exc.detail), code),
        status_code=exc.status_code,
        headers=getattr(exc, "headers", None),
    )


async def _validation_exception(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Field errors only: never echo the submitted values back (passwords, card data).
    issues = [
        {"loc": list(error.get("loc", ())), "msg": error.get("msg", "Invalid value"), "type": error.get("type")}
        for error in exc.errors()
    ]
    return JSONResponse(error_body(422, issues, "invalid"), status_code=422)


async def _database_exception(request: Request, exc: DBAPIError) -> JSONResponse:
    """A database error a handler did not map itself gets the same mapping as raise_from_db."""
    try:
        raise_from_db(exc)
    except HTTPException as mapped:
        return await _http_exception(request, mapped)


async def _unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
    logger.error("unhandled error", exc_info=exc)
    report_exception(exc)
    body = error_body(500, INTERNAL, request=request)
    headers = {"X-Request-ID": body["request_id"]} if "request_id" in body else None
    return JSONResponse(body, status_code=500, headers=headers)


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, _http_exception)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, _validation_exception)  # type: ignore[arg-type]
    app.add_exception_handler(DBAPIError, _database_exception)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, _unhandled_exception)
