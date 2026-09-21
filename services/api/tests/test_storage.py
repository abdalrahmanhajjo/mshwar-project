from __future__ import annotations

import pytest

from app.core.storage import (
    InvalidObjectKey,
    delete_private_bytes,
    put_private_bytes,
    read_private_bytes,
    sign_object_url,
    storage_backend,
    verify_signed_token,
)


def test_local_backend_when_imagekit_unset() -> None:
    assert storage_backend() == "local"


def test_private_put_and_signed_url(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.core.storage.settings.private_storage_dir", str(tmp_path))
    stored = put_private_bytes(b"secret-doc", "license.pdf", "application/pdf", public=False)
    assert stored["provider"] == "local"
    assert stored["object_key"]
    assert read_private_bytes(stored["object_key"]) == b"secret-doc"
    signed = sign_object_url(stored["object_key"], ttl_seconds=60)
    assert signed["public"] == "false"
    assert verify_signed_token(signed["url"].rsplit("/", 1)[1]) == stored["object_key"]


def test_refuses_public_flag() -> None:
    with pytest.raises(ValueError):
        put_private_bytes(b"x", "a.txt", "text/plain", public=True)


def test_invalid_signature_is_rejected() -> None:
    with pytest.raises(ValueError):
        verify_signed_token("not-a-token")


@pytest.mark.parametrize(
    "object_key",
    ["../../../../etc/hostname", "2026/09/../../secret", "/etc/passwd", "2026/09/not-a-uuid-name.pdf"],
)
def test_rejects_keys_outside_storage(object_key: str, tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.core.storage.settings.private_storage_dir", str(tmp_path))
    with pytest.raises(InvalidObjectKey):
        read_private_bytes(object_key)


def test_signed_token_for_foreign_key_is_rejected() -> None:
    token = sign_object_url("../../../../etc/hostname")["url"].rsplit("/", 1)[1]
    with pytest.raises(ValueError):
        verify_signed_token(token)


def test_delete_private_bytes_removes_file(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.core.storage.settings.private_storage_dir", str(tmp_path))
    stored = put_private_bytes(b"x", "a b/../c.png", "image/png")
    assert "/" not in stored["object_key"].split("-", 1)[1]
    delete_private_bytes(stored["object_key"])
    with pytest.raises(FileNotFoundError):
        read_private_bytes(stored["object_key"])
