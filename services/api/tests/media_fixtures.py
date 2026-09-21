"""Small, structurally valid files for upload tests."""

from __future__ import annotations

import base64
import struct
import zlib


def tiny_jpeg(width: int = 2, height: int = 2) -> bytes:
    app0 = b"\xff\xe0" + struct.pack(">H", 16) + b"JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    sof0 = b"\xff\xc0" + struct.pack(">HBHHB", 17, 8, height, width, 3) + b"\x01\x22\x00\x02\x11\x01\x03\x11\x01"
    return b"\xff\xd8" + app0 + sof0 + b"\xff\xd9"


def tiny_png(width: int = 2, height: int = 2) -> bytes:
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    chunk = struct.pack(">I", 13) + b"IHDR" + ihdr + struct.pack(">I", zlib.crc32(b"IHDR" + ihdr))
    return b"\x89PNG\r\n\x1a\n" + chunk


def tiny_pdf(body: bytes = b"") -> bytes:
    return b"%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n" + body + b"\ntrailer << /Root 1 0 R >>\n%%EOF\n"


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")
