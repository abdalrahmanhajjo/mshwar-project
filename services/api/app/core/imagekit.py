"""ImageKit: listing-image storage, transformation and delivery (MSHWAR-112).

Listing images are uploaded server-side with the private key into a
per-organisation folder under a random name, and served from the ImageKit URL
endpoint, which does all resizing and format conversion. Verification
documents never go to ImageKit; they stay in private storage behind
short-lived signed links (app.core.storage).

Configuration: IMAGEKIT_PRIVATE_KEY (alias IMAGEKIT_API_KEY) and
IMAGEKIT_URL_ENDPOINT (alias IMAGEKIT_URL). Both unset -> local storage.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from urllib.parse import quote

import httpx

from app.core.config import settings

logger = logging.getLogger("mshwar.imagekit")

UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload"
FILES_URL = "https://api.imagekit.io/v1/files"
_TIMEOUT = httpx.Timeout(20.0, connect=5.0)


class ImageKitError(RuntimeError):
    pass


@dataclass(frozen=True)
class UploadedImage:
    file_id: str
    file_path: str
    url: str
    width: int | None
    height: int | None


def enabled() -> bool:
    return bool(settings.imagekit_api_key and settings.imagekit_url)


def delivery_url(file_path: str, transformation: str | None = None) -> str:
    base = settings.imagekit_url.rstrip("/")
    path = "/".join(quote(part) for part in file_path.lstrip("/").split("/"))
    url = f"{base}/{path}"
    return f"{url}?tr={transformation}" if transformation else url


class ImageKitClient:
    def __init__(self, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._transport = transport

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(auth=(settings.imagekit_api_key, ""), timeout=_TIMEOUT, transport=self._transport)

    async def upload(self, data: bytes, *, filename: str, folder: str, content_type: str) -> UploadedImage:
        files = {"file": (filename, data, content_type)}
        form = {
            "fileName": filename,
            "folder": folder,
            "useUniqueFileName": "true",
            "isPrivateFile": "false",
            "overwriteFile": "false",
            "tags": "mshwar,listing,pending-moderation",
        }
        try:
            async with self._client() as client:
                response = await client.post(UPLOAD_URL, data=form, files=files)
        except httpx.HTTPError as exc:
            raise ImageKitError("image storage is unavailable") from exc
        if response.status_code >= 300:
            # The body can echo request details; keep it out of logs.
            logger.warning("imagekit upload failed", extra={"status": response.status_code})
            raise ImageKitError("image storage rejected the upload")
        body = response.json()
        return UploadedImage(
            file_id=str(body["fileId"]),
            file_path=str(body["filePath"]),
            url=str(body.get("url") or delivery_url(str(body["filePath"]))),
            width=body.get("width"),
            height=body.get("height"),
        )

    async def delete(self, file_id: str) -> None:
        try:
            async with self._client() as client:
                response = await client.delete(f"{FILES_URL}/{quote(file_id)}")
        except httpx.HTTPError:
            logger.warning("imagekit delete failed", extra={"reason": "network"})
            return
        if response.status_code >= 300 and response.status_code != 404:
            logger.warning("imagekit delete failed", extra={"status": response.status_code})


_client: ImageKitClient | None = None


def get_client() -> ImageKitClient:
    global _client
    if _client is None:
        _client = ImageKitClient()
    return _client


def set_client(client: ImageKitClient | None) -> None:
    global _client
    _client = client
