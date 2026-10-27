"""Unit tests for the forgot-password / reset-password flow.

Covers: token generation, hashing, email dispatch (mocked), token validation
(invalid / expired / used), password policy enforcement, account-enumeration
protection, and session invalidation on a successful reset.
"""
from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.user_repository import (
    PasswordResetTokenRepository,
    SessionRepository,
    UserRepository,
)
from app.services.password_reset_service import PasswordResetService, _as_utc, _hash_token

EXISTING_PASSWORD_HASH = "$2b$12$" + "a" * 53  # syntactically valid bcrypt hash, never verified in these tests


async def _create_user(db: AsyncSession, email: str = "jane@example.com", is_active: bool = True) -> uuid.UUID:
    repo = UserRepository(db)
    user = await repo.create_user(
        name="Jane Doe",
        phone=None,
        email=email,
        password_hash=EXISTING_PASSWORD_HASH,
    )
    if not is_active:
        await repo.update(user.id, is_active=False)
    await db.commit()
    return user.id


def _mock_email_service() -> AsyncMock:
    mock = AsyncMock()
    mock.send_password_reset_email = AsyncMock(return_value=True)
    return mock


def _extract_token_from_reset_url(reset_url: str) -> str:
    query = parse_qs(urlsplit(reset_url).query)
    return query["token"][0]


# ---------------------------------------------------------------------------
# forgot_password
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_forgot_password_generates_and_hashes_token(db_session: AsyncSession) -> None:
    """A cryptographically secure token (>=32 bytes) is generated, only its
    SHA-256 hash is persisted, and the raw token is what gets emailed."""
    user_id = await _create_user(db_session)
    email_service = _mock_email_service()
    svc = PasswordResetService(db_session, email_service=email_service)

    result = await svc.forgot_password("jane@example.com")

    assert result == {"message": "If an account exists with this email, a password reset link has been sent."}
    email_service.send_password_reset_email.assert_awaited_once()
    _, kwargs = email_service.send_password_reset_email.call_args
    raw_token = _extract_token_from_reset_url(kwargs["reset_url"])

    # >= 32 bytes of entropy: token_urlsafe(32) base64url-encodes to 43 chars, no padding
    assert len(raw_token) >= 32

    token_repo = PasswordResetTokenRepository(db_session)
    stored = await token_repo.get_by_hash(_hash_token(raw_token))
    assert stored is not None
    assert stored.user_id == user_id
    # The DB never holds the plaintext token
    assert stored.token_hash == hashlib.sha256(raw_token.encode()).hexdigest()
    assert stored.token_hash != raw_token


@pytest.mark.asyncio
async def test_forgot_password_sets_configured_expiry(db_session: AsyncSession) -> None:
    from app.config import settings as app_settings

    await _create_user(db_session, email="expiry@example.com")
    email_service = _mock_email_service()
    svc = PasswordResetService(db_session, email_service=email_service)

    before = datetime.now(timezone.utc)
    await svc.forgot_password("expiry@example.com")
    after = datetime.now(timezone.utc)

    _, kwargs = email_service.send_password_reset_email.call_args
    raw_token = _extract_token_from_reset_url(kwargs["reset_url"])
    token_repo = PasswordResetTokenRepository(db_session)
    stored = await token_repo.get_by_hash(_hash_token(raw_token))

    expected_min = before + timedelta(minutes=app_settings.reset_token_expiry_minutes)
    expected_max = after + timedelta(minutes=app_settings.reset_token_expiry_minutes)
    assert expected_min <= _as_utc(stored.expires_at) <= expected_max


@pytest.mark.asyncio
async def test_forgot_password_unknown_email_returns_generic_message_no_token(db_session: AsyncSession) -> None:
    """Unknown email: identical generic response, no token created, no email sent —
    prevents account enumeration."""
    email_service = _mock_email_service()
    svc = PasswordResetService(db_session, email_service=email_service)

    result = await svc.forgot_password("nobody@example.com")

    assert result == {"message": "If an account exists with this email, a password reset link has been sent."}
    email_service.send_password_reset_email.assert_not_awaited()


@pytest.mark.asyncio
async def test_forgot_password_inactive_account_returns_generic_message_no_token(db_session: AsyncSession) -> None:
    await _create_user(db_session, email="inactive@example.com", is_active=False)
    email_service = _mock_email_service()
    svc = PasswordResetService(db_session, email_service=email_service)

    result = await svc.forgot_password("inactive@example.com")

    assert result == {"message": "If an account exists with this email, a password reset link has been sent."}
    email_service.send_password_reset_email.assert_not_awaited()


@pytest.mark.asyncio
async def test_forgot_password_invalidates_previous_outstanding_token(db_session: AsyncSession) -> None:
    """A second forgot-password request supersedes the first — only one live
    reset link should exist at a time."""
    await _create_user(db_session, email="repeat@example.com")
    email_service = _mock_email_service()
    svc = PasswordResetService(db_session, email_service=email_service)

    await svc.forgot_password("repeat@example.com")
    _, kwargs1 = email_service.send_password_reset_email.call_args
    first_token = _extract_token_from_reset_url(kwargs1["reset_url"])

    await svc.forgot_password("repeat@example.com")

    token_repo = PasswordResetTokenRepository(db_session)
    first_stored = await token_repo.get_by_hash(_hash_token(first_token))
    assert first_stored.used_at is not None, "Superseded token must be invalidated"


@pytest.mark.asyncio
async def test_forgot_password_survives_smtp_failure(db_session: AsyncSession) -> None:
    """An SMTP failure must not surface to the caller or leak account existence —
    the generic message is still returned."""
    await _create_user(db_session, email="smtpdown@example.com")
    email_service = _mock_email_service()
    email_service.send_password_reset_email = AsyncMock(return_value=False)
    svc = PasswordResetService(db_session, email_service=email_service)

    result = await svc.forgot_password("smtpdown@example.com")

    assert result == {"message": "If an account exists with this email, a password reset link has been sent."}


# ---------------------------------------------------------------------------
# reset_password
# ---------------------------------------------------------------------------


async def _seed_valid_token(db: AsyncSession, user_id: uuid.UUID, raw_token: str = "valid-raw-token") -> None:
    token_repo = PasswordResetTokenRepository(db)
    await token_repo.create(
        user_id, _hash_token(raw_token), datetime.now(timezone.utc) + timedelta(minutes=30)
    )
    await db.commit()


@pytest.mark.asyncio
async def test_reset_password_success_updates_password_and_marks_token_used(db_session: AsyncSession) -> None:
    user_id = await _create_user(db_session, email="reset-ok@example.com")
    await _seed_valid_token(db_session, user_id, "good-token")
    svc = PasswordResetService(db_session, email_service=_mock_email_service())

    result = await svc.reset_password("good-token", "NewStrongP@ss1")

    assert result == {"message": "Password updated successfully"}

    user_repo = UserRepository(db_session)
    user = await user_repo.get_by_id(user_id)
    assert user.password_hash != EXISTING_PASSWORD_HASH
    assert user.is_temp_password is False

    token_repo = PasswordResetTokenRepository(db_session)
    token = await token_repo.get_by_hash(_hash_token("good-token"))
    assert token.used_at is not None


@pytest.mark.asyncio
async def test_reset_password_revokes_existing_sessions(db_session: AsyncSession) -> None:
    """A password reset must invalidate every existing session/refresh token —
    a leaked credential shouldn't remain valid after the owner resets it."""
    user_id = await _create_user(db_session, email="revoke@example.com")
    session_repo = SessionRepository(db_session)
    session = await session_repo.create_session(
        user_id=user_id,
        refresh_token_hash="some-refresh-hash",
        device_identifier="pytest",
        ip_address=None,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    await db_session.commit()
    await _seed_valid_token(db_session, user_id, "session-revoke-token")
    svc = PasswordResetService(db_session, email_service=_mock_email_service())

    await svc.reset_password("session-revoke-token", "NewStrongP@ss1")

    refreshed = await session_repo.get_by_id(session.id)
    assert refreshed.revoked_at is not None

    user_repo = UserRepository(db_session)
    user = await user_repo.get_by_id(user_id)
    assert user.tokens_invalidated_at is not None


@pytest.mark.asyncio
async def test_reset_password_invalid_token_rejected(db_session: AsyncSession) -> None:
    svc = PasswordResetService(db_session, email_service=_mock_email_service())

    with pytest.raises(HTTPException) as exc_info:
        await svc.reset_password("does-not-exist", "NewStrongP@ss1")

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["error_code"] == "INVALID_RESET_TOKEN"


@pytest.mark.asyncio
async def test_reset_password_expired_token_rejected(db_session: AsyncSession) -> None:
    user_id = await _create_user(db_session, email="expired@example.com")
    token_repo = PasswordResetTokenRepository(db_session)
    await token_repo.create(
        user_id, _hash_token("expired-token"), datetime.now(timezone.utc) - timedelta(minutes=1)
    )
    await db_session.commit()
    svc = PasswordResetService(db_session, email_service=_mock_email_service())

    with pytest.raises(HTTPException) as exc_info:
        await svc.reset_password("expired-token", "NewStrongP@ss1")

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["error_code"] == "EXPIRED_RESET_TOKEN"


@pytest.mark.asyncio
async def test_reset_password_already_used_token_rejected(db_session: AsyncSession) -> None:
    user_id = await _create_user(db_session, email="used@example.com")
    await _seed_valid_token(db_session, user_id, "used-token")
    svc = PasswordResetService(db_session, email_service=_mock_email_service())

    # First reset consumes the token
    await svc.reset_password("used-token", "NewStrongP@ss1")

    # Replaying it must fail
    with pytest.raises(HTTPException) as exc_info:
        await svc.reset_password("used-token", "AnotherStrongP@ss2")

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["error_code"] == "USED_RESET_TOKEN"


# ---------------------------------------------------------------------------
# Schema-level validation (password policy, confirm-password match)
# ---------------------------------------------------------------------------


def test_reset_password_schema_rejects_weak_password() -> None:
    from pydantic import ValidationError

    from app.schemas.auth import ResetPasswordRequest

    with pytest.raises(ValidationError):
        ResetPasswordRequest(token="t", password="weak", confirm_password="weak")


def test_reset_password_schema_rejects_mismatched_confirmation() -> None:
    from pydantic import ValidationError

    from app.schemas.auth import ResetPasswordRequest

    with pytest.raises(ValidationError):
        ResetPasswordRequest(token="t", password="StrongP@ss1", confirm_password="Different@2")


def test_reset_password_schema_accepts_valid_strong_password() -> None:
    from app.schemas.auth import ResetPasswordRequest

    req = ResetPasswordRequest(token="t", password="StrongP@ss1", confirm_password="StrongP@ss1")
    assert req.password == "StrongP@ss1"


def test_forgot_password_schema_rejects_invalid_email() -> None:
    from pydantic import ValidationError

    from app.schemas.auth import ForgotPasswordRequest

    with pytest.raises(ValidationError):
        ForgotPasswordRequest(email="not-an-email")


def test_forgot_password_schema_normalizes_email() -> None:
    from app.schemas.auth import ForgotPasswordRequest

    req = ForgotPasswordRequest(email="  Jane@Example.COM ")
    assert req.email == "jane@example.com"


# ---------------------------------------------------------------------------
# End-to-end via the HTTP API
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_api_forgot_password_endpoint_returns_generic_message(async_client, db_session: AsyncSession, monkeypatch) -> None:
    from app.services import password_reset_service as prs_module

    monkeypatch.setattr(
        prs_module.EmailService, "send_password_reset_email", AsyncMock(return_value=True)
    )
    await _create_user(db_session, email="api-user@example.com")

    resp = await async_client.post("/api/v1/auth/forgot-password", json={"email": "api-user@example.com"})
    assert resp.status_code == 200
    assert resp.json() == {"message": "If an account exists with this email, a password reset link has been sent."}

    resp_unknown = await async_client.post("/api/v1/auth/forgot-password", json={"email": "unknown@example.com"})
    assert resp_unknown.status_code == 200
    assert resp_unknown.json() == resp.json()


@pytest.mark.asyncio
async def test_api_reset_password_endpoint_rejects_weak_password(async_client) -> None:
    resp = await async_client.post(
        "/api/v1/auth/reset-password",
        json={"token": "whatever", "password": "weak", "confirm_password": "weak"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_api_reset_password_endpoint_rejects_mismatched_confirmation(async_client) -> None:
    resp = await async_client.post(
        "/api/v1/auth/reset-password",
        json={"token": "whatever", "password": "StrongP@ss1", "confirm_password": "Other@2222"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_api_reset_password_endpoint_success(async_client, db_session: AsyncSession) -> None:
    user_id = await _create_user(db_session, email="api-reset@example.com")
    await _seed_valid_token(db_session, user_id, "api-good-token")

    resp = await async_client.post(
        "/api/v1/auth/reset-password",
        json={"token": "api-good-token", "password": "StrongP@ss1", "confirm_password": "StrongP@ss1"},
    )
    assert resp.status_code == 200
    assert resp.json() == {"message": "Password updated successfully"}
