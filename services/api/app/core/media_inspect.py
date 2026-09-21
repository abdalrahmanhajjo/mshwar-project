"""Content checks for uploads (MSHWAR-112).

Uploads are untrusted until these pass. The checks read file structure only;
nothing is decoded, resized or re-encoded here - image processing happens in
ImageKit, outside the API process.

* images: the header must parse as the declared format, with sane dimensions
  under ``MAX_IMAGE_PIXELS`` (decompression-bomb guard), and the bytes must not
  carry markup that a browser could be tricked into running;
* PDFs: a real PDF envelope with no active content (JavaScript, launch
  actions, embedded files, XFA forms).
"""

from __future__ import annotations

import re
import struct
from dataclasses import dataclass

MAX_DIMENSION = 12_000


class UnsafeUpload(ValueError):
    """The bytes are not a safe file of the declared type."""


@dataclass(frozen=True)
class Inspected:
    content_type: str
    width: int | None = None
    height: int | None = None


_MARKUP = re.compile(rb"<\s*(?:script|html|svg|iframe|object|embed|body)\b|<\?php|javascript:", re.IGNORECASE)
_PDF_ACTIVE = re.compile(rb"/(?:JavaScript|JS|Launch|EmbeddedFile|RichMedia|XFA|SubmitForm|ImportData)\b")


def _png_size(data: bytes) -> tuple[int, int]:
    if len(data) < 33 or data[12:16] != b"IHDR":
        raise UnsafeUpload("not a PNG image")
    width, height = struct.unpack(">II", data[16:24])
    return width, height


_JPEG_SOF = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}


def _jpeg_size(data: bytes) -> tuple[int, int]:
    index = 2
    length = len(data)
    while index + 4 <= length:
        if data[index] != 0xFF:
            raise UnsafeUpload("not a JPEG image")
        marker = data[index + 1]
        if marker == 0xFF:  # fill byte
            index += 1
            continue
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            index += 2
            continue
        (segment,) = struct.unpack(">H", data[index + 2 : index + 4])
        if segment < 2:
            raise UnsafeUpload("not a JPEG image")
        if marker in _JPEG_SOF:
            if index + 9 > length:
                break
            height, width = struct.unpack(">HH", data[index + 5 : index + 9])
            return width, height
        if marker == 0xDA:  # start of scan before any frame header
            break
        index += 2 + segment
    raise UnsafeUpload("not a JPEG image")


def _webp_size(data: bytes) -> tuple[int, int]:
    chunk = data[12:16]
    if chunk == b"VP8 " and len(data) >= 30 and data[23:26] == b"\x9d\x01\x2a":
        width, height = struct.unpack("<HH", data[26:30])
        return width & 0x3FFF, height & 0x3FFF
    if chunk == b"VP8L" and len(data) >= 25 and data[20] == 0x2F:
        bits = int.from_bytes(data[21:25], "little")
        return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    if chunk == b"VP8X" and len(data) >= 30:
        width = int.from_bytes(data[24:27], "little") + 1
        height = int.from_bytes(data[27:30], "little") + 1
        return width, height
    raise UnsafeUpload("not a WebP image")


_SIZERS = {"image/png": _png_size, "image/jpeg": _jpeg_size, "image/webp": _webp_size}


def inspect_image(data: bytes, content_type: str, max_pixels: int) -> Inspected:
    sizer = _SIZERS.get(content_type)
    if sizer is None:
        raise UnsafeUpload("unsupported image type")
    try:
        width, height = sizer(data)
    except struct.error as exc:
        raise UnsafeUpload("truncated image") from exc
    if not (0 < width <= MAX_DIMENSION and 0 < height <= MAX_DIMENSION) or width * height > max_pixels:
        raise UnsafeUpload("image dimensions are not allowed")
    if _MARKUP.search(data[:4096]) or _MARKUP.search(data[-4096:]):
        raise UnsafeUpload("image contains markup")
    return Inspected(content_type, width, height)


def inspect_pdf(data: bytes) -> Inspected:
    if not re.match(rb"%PDF-[12]\.\d", data[:8]):
        raise UnsafeUpload("not a PDF document")
    if b"%%EOF" not in data[-2048:]:
        raise UnsafeUpload("truncated PDF document")
    if _PDF_ACTIVE.search(data):
        raise UnsafeUpload("PDF contains active content")
    return Inspected("application/pdf")


def inspect_upload(data: bytes, content_type: str, max_pixels: int) -> Inspected:
    if content_type == "application/pdf":
        return inspect_pdf(data)
    return inspect_image(data, content_type, max_pixels)
