"""Validation for files uploaded as base64 JSON (listing images, verification documents)."""

from __future__ import annotations

import base64
import binascii

from fastapi import HTTPException, status

from app.core.config import settings
from app.core.http_status import HTTP_413_CONTENT_TOO_LARGE, HTTP_422_UNPROCESSABLE
from app.core.media_inspect import Inspected, UnsafeUpload, inspect_upload

_IMAGE_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})
ALLOWED_CONTENT_TYPES = {
    "listing": _IMAGE_TYPES,
    "verification": _IMAGE_TYPES | {"application/pdf"},
}


def _matches_signature(data: bytes, content_type: str) -> bool:
    if content_type == "image/jpeg":
        return data.startswith(b"\xff\xd8\xff")
    if content_type == "image/png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/webp":
        return data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    if content_type == "application/pdf":
        return data.startswith(b"%PDF-")
    return False


def validate_upload(content_base64: str, content_type: str, purpose: str) -> bytes:
    """Decode an upload and check its size, declared type and real file signature.

    ``inspect_upload`` (app.core.media_inspect) then checks the structure.
    """
    allowed = ALLOWED_CONTENT_TYPES.get(purpose)
    if allowed is None or content_type not in allowed:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Unsupported file type")
    # base64 inflates by 4/3: reject oversized payloads before decoding them.
    if len(content_base64) > (settings.max_upload_bytes * 4) // 3 + 4:
        raise HTTPException(status_code=HTTP_413_CONTENT_TOO_LARGE, detail="File is too large")
    try:
        data = base64.b64decode(content_base64, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="Invalid file payload") from exc
    if not data or len(data) > settings.max_upload_bytes:
        raise HTTPException(status_code=HTTP_413_CONTENT_TOO_LARGE, detail="File is too large")
    if not _matches_signature(data, content_type):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="File content does not match its type"
        )
    return data


def inspect_or_reject(data: bytes, content_type: str) -> Inspected:
    try:
        return inspect_upload(data, content_type, settings.max_image_pixels)
    except UnsafeUpload as exc:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=str(exc).capitalize()) from exc
