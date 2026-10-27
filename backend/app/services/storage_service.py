"""Pluggable storage backend for report files."""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Protocol

from jose import jwt as jose_jwt

from app.config import settings


def _normalise_disposition(disposition: str) -> str:
    """Only ever emit a known-safe Content-Disposition type — the value ends up
    in a response header, so an arbitrary string must not reach it."""
    return "inline" if disposition == "inline" else "attachment"


class StorageBackend(Protocol):
    async def upload(self, file_bytes: bytes, key: str, content_type: str) -> str:
        """Upload file and return storage key."""
        ...

    async def generate_signed_url(
        self,
        key: str,
        report_id: uuid.UUID,
        user_id: uuid.UUID,
        file_name: str,
        disposition: str = "attachment",
    ) -> str:
        """Return a time-limited URL. `disposition` is "attachment" to force a
        download, or "inline" so the browser renders the file (preview)."""
        ...

    async def delete(self, key: str) -> None:
        """Delete file by storage key."""
        ...

    async def health_check(self) -> bool:
        """Return True if storage is reachable."""
        ...


class LocalStorage:
    """Stores files on local filesystem; signs download URLs with JWT."""

    def __init__(self) -> None:
        self.base_path = Path(settings.file_storage_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

    async def upload(self, file_bytes: bytes, key: str, content_type: str) -> str:
        dest = self.base_path / key
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(file_bytes)
        return key

    async def generate_signed_url(
        self,
        key: str,
        report_id: uuid.UUID,
        user_id: uuid.UUID,
        file_name: str,
        disposition: str = "attachment",
    ) -> str:
        payload = {
            "report_id": str(report_id),
            "user_id": str(user_id),
            "key": key,
            "file_name": file_name,
            "disposition": _normalise_disposition(disposition),
            "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        }
        token = jose_jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
        return f"/api/v1/files/download/{token}"

    async def delete(self, key: str) -> None:
        path = self.base_path / key
        if path.exists():
            path.unlink()

    async def download(self, key: str) -> bytes | None:
        path = self.base_path / key
        if not path.exists():
            return None
        return path.read_bytes()

    async def health_check(self) -> bool:
        return self.base_path.exists() and os.access(self.base_path, os.W_OK)

    def resolve_path(self, key: str) -> Path:
        return self.base_path / key


class S3Storage:
    """Stores files in AWS S3; generates pre-signed URLs with 24h expiry."""

    def __init__(self) -> None:
        self._bucket = settings.aws_s3_bucket
        self._region = settings.aws_region

    def _get_client(self):  # type: ignore[return]
        try:
            import aiobotocore.session  # type: ignore[import]
            session = aiobotocore.session.get_session()
            return session.create_client(
                "s3",
                region_name=self._region,
                aws_access_key_id=settings.aws_access_key_id,
                aws_secret_access_key=settings.aws_secret_access_key,
            )
        except ImportError as exc:
            raise RuntimeError("aiobotocore is required for S3 storage") from exc

    async def upload(self, file_bytes: bytes, key: str, content_type: str) -> str:
        async with self._get_client() as client:
            await client.put_object(
                Bucket=self._bucket,
                Key=key,
                Body=file_bytes,
                ContentType=content_type,
            )
        return key

    async def generate_signed_url(
        self,
        key: str,
        report_id: uuid.UUID,
        user_id: uuid.UUID,
        file_name: str,
        disposition: str = "attachment",
    ) -> str:
        async with self._get_client() as client:
            url = await client.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": self._bucket,
                    "Key": key,
                    "ResponseContentDisposition": (
                        f'{_normalise_disposition(disposition)}; filename="{file_name}"'
                    ),
                },
                ExpiresIn=86400,  # 24 hours
            )
        return url

    async def delete(self, key: str) -> None:
        async with self._get_client() as client:
            await client.delete_object(Bucket=self._bucket, Key=key)

    async def download(self, key: str) -> bytes | None:
        try:
            async with self._get_client() as client:
                resp = await client.get_object(Bucket=self._bucket, Key=key)
                async with resp["Body"] as stream:
                    return await stream.read()
        except Exception:
            return None

    async def health_check(self) -> bool:
        try:
            async with self._get_client() as client:
                await client.head_bucket(Bucket=self._bucket)
            return True
        except Exception:
            return False


def get_storage_backend() -> LocalStorage | S3Storage:
    """Factory: select backend from FILE_STORAGE_BACKEND env var."""
    if settings.file_storage_backend == "s3":
        return S3Storage()
    return LocalStorage()
