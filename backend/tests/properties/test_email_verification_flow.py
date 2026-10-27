"""Unit tests for registration email verification: OTP generation, delivery
(mocked), login gating, expired/invalid/used-up-attempts handling, and resend."""
from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.user_repository import EmailVerificationOtpRepository, UserRepository
from app.services.auth_service import AuthService
from app.services.email_verification_service import EmailVerificationService, _hash_code

EXISTING_PASSWORD = "StrongP@ss1"


def _mock_email_service() -> AsyncMock:
    mock = AsyncMock()
    mock.send_verification_otp_email = AsyncMock(return_value=True)
    return mock


async def _register(db: AsyncSession, email: str = "jane@example.com", phone: str = "9000000001") -> dict:
    svc = AuthService(db)
    return await svc.register(phone=phone, name="Jane Doe", email=email, password=EXISTING_PASSWORD)


# ---------------------------------------------------------------------------
# register() no longer auto-logs-in
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_register_creates_unverified_account_without_tokens(db_session: AsyncSession, monkeypatch) -> None:
    from app.services import email_verification_service as evs_module

    monkeypatch.setattr(evs_module.EmailService, "send_verification_otp_email", AsyncMock(return_value=True))

    result = await _register(db_session)

    assert result == {
        "message": "Account created. Please check your email for a verification code.",
        "email": "jane@example.com",
    }
    assert "access_token" not in result

    user = await UserRepository(db_session).get_by_email("jane@example.com")
    assert user is not None
    assert user.email_verified_at is None


@pytest.mark.asyncio
async def test_register_sends_otp_email(db_session: AsyncSession, monkeypatch) -> None:
    from app.services import email_verification_service as evs_module

    mock_send = AsyncMock(return_value=True)
    monkeypatch.setattr(evs_module.EmailService, "send_verification_otp_email", mock_send)

    await _register(db_session)

    mock_send.assert_awaited_once()
    _, kwargs = mock_send.call_args
    assert kwargs["to_email"] == "jane@example.com"
    assert len(kwargs["otp_code"]) == 6
    assert kwargs["otp_code"].isdigit()


# ---------------------------------------------------------------------------
# login blocked until verified
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_login_blocked_before_email_verified(db_session: AsyncSession, monkeypatch) -> None:
    from app.services import email_verification_service as evs_module

    monkeypatch.setattr(evs_module.EmailService, "send_verification_otp_email", AsyncMock(return_value=True))
    await _register(db_session)

    auth_svc = AuthService(db_session)
    with pytest.raises(HTTPException) as exc_info:
        await auth_svc.login(phone_or_email="jane@example.com", password=EXISTING_PASSWORD)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail["error_code"] == "EMAIL_NOT_VERIFIED"


@pytest.mark.asyncio
async def test_login_succeeds_after_email_verified(db_session: AsyncSession, monkeypatch) -> None:
    from app.services import email_verification_service as evs_module

    captured = {}

    async def _capture(self, to_email, user_name, otp_code, expiry_minutes):
        captured["otp_code"] = otp_code
        return True

    monkeypatch.setattr(evs_module.EmailService, "send_verification_otp_email", _capture)
    await _register(db_session)

    auth_svc = AuthService(db_session)
    tokens = await auth_svc.verify_email_otp(email="jane@example.com", otp=captured["otp_code"])
    assert "access_token" in tokens

    # now login works
    login_result = await auth_svc.login(phone_or_email="jane@example.com", password=EXISTING_PASSWORD)
    assert "access_token" in login_result


# ---------------------------------------------------------------------------
# OTP validation edge cases
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_verify_wrong_otp_increments_attempts_and_fails(db_session: AsyncSession, monkeypatch) -> None:
    from app.services import email_verification_service as evs_module

    monkeypatch.setattr(evs_module.EmailService, "send_verification_otp_email", AsyncMock(return_value=True))
    await _register(db_session)

    svc = EmailVerificationService(db_session, email_service=_mock_email_service())
    with pytest.raises(HTTPException) as exc_info:
        await svc.validate_otp("jane@example.com", "000000")
    assert exc_info.value.detail["error_code"] == "INVALID_OTP"

    user = await UserRepository(db_session).get_by_email("jane@example.com")
    otp = await EmailVerificationOtpRepository(db_session).get_latest_for_user(user.id)
    assert otp.attempts == 1


@pytest.mark.asyncio
async def test_verify_exceeds_max_attempts(db_session: AsyncSession, monkeypatch) -> None:
    from app.config import settings as app_settings
    from app.services import email_verification_service as evs_module

    monkeypatch.setattr(evs_module.EmailService, "send_verification_otp_email", AsyncMock(return_value=True))
    await _register(db_session)

    svc = EmailVerificationService(db_session, email_service=_mock_email_service())
    for _ in range(app_settings.email_verification_max_attempts):
        with pytest.raises(HTTPException):
            await svc.validate_otp("jane@example.com", "000000")

    with pytest.raises(HTTPException) as exc_info:
        await svc.validate_otp("jane@example.com", "000000")
    assert exc_info.value.detail["error_code"] == "MAX_ATTEMPTS_EXCEEDED"


@pytest.mark.asyncio
async def test_verify_expired_otp_rejected(db_session: AsyncSession) -> None:
    user = await UserRepository(db_session).create_user(
        name="Jane", phone="9000000002", email="expired@example.com", password_hash="x",
    )
    await db_session.commit()
    otp_repo = EmailVerificationOtpRepository(db_session)
    code = "123456"
    await otp_repo.create(user.id, _hash_code(code), datetime.now(timezone.utc) - timedelta(minutes=1))
    await db_session.commit()

    svc = EmailVerificationService(db_session, email_service=_mock_email_service())
    with pytest.raises(HTTPException) as exc_info:
        await svc.validate_otp("expired@example.com", code)
    assert exc_info.value.detail["error_code"] == "EXPIRED_OTP"


@pytest.mark.asyncio
async def test_verify_already_verified_email_rejected(db_session: AsyncSession, monkeypatch) -> None:
    from app.services import email_verification_service as evs_module

    captured = {}

    async def _capture(self, to_email, user_name, otp_code, expiry_minutes):
        captured["otp_code"] = otp_code
        return True

    monkeypatch.setattr(evs_module.EmailService, "send_verification_otp_email", _capture)
    await _register(db_session)

    svc = EmailVerificationService(db_session, email_service=_mock_email_service())
    await svc.validate_otp("jane@example.com", captured["otp_code"])

    with pytest.raises(HTTPException) as exc_info:
        await svc.validate_otp("jane@example.com", captured["otp_code"])
    assert exc_info.value.detail["error_code"] == "EMAIL_ALREADY_VERIFIED"


@pytest.mark.asyncio
async def test_verify_unknown_email_rejected(db_session: AsyncSession) -> None:
    svc = EmailVerificationService(db_session, email_service=_mock_email_service())
    with pytest.raises(HTTPException) as exc_info:
        await svc.validate_otp("nobody@example.com", "123456")
    assert exc_info.value.detail["error_code"] == "INVALID_OTP"


# ---------------------------------------------------------------------------
# resend
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_resend_generates_new_otp_superseding_old(db_session: AsyncSession, monkeypatch) -> None:
    from app.services import email_verification_service as evs_module

    codes = []

    async def _capture(self, to_email, user_name, otp_code, expiry_minutes):
        codes.append(otp_code)
        return True

    monkeypatch.setattr(evs_module.EmailService, "send_verification_otp_email", _capture)
    await _register(db_session)
    first_code = codes[0]

    user = await UserRepository(db_session).get_by_email("jane@example.com")
    # Force the cooldown window to have already elapsed for this test.
    otp = await EmailVerificationOtpRepository(db_session).get_latest_for_user(user.id)
    from sqlalchemy import update as sa_update

    from app.models.user import EmailVerificationOtp
    await db_session.execute(
        sa_update(EmailVerificationOtp)
        .where(EmailVerificationOtp.id == otp.id)
        .values(created_at=datetime.now(timezone.utc) - timedelta(minutes=5))
    )
    await db_session.commit()

    svc = EmailVerificationService(db_session)  # default EmailService, but send_verification_otp_email is monkeypatched above
    await svc.resend_verification_otp("jane@example.com")
    second_code = codes[1]

    assert first_code != second_code
    # Old code no longer works
    with pytest.raises(HTTPException) as exc_info:
        await svc.validate_otp("jane@example.com", first_code)
    assert exc_info.value.detail["error_code"] == "INVALID_OTP"
    # New code works
    user2 = await svc.validate_otp("jane@example.com", second_code)
    assert user2.email_verified_at is not None


@pytest.mark.asyncio
async def test_resend_cooldown_enforced(db_session: AsyncSession, monkeypatch) -> None:
    from app.services import email_verification_service as evs_module

    monkeypatch.setattr(evs_module.EmailService, "send_verification_otp_email", AsyncMock(return_value=True))
    await _register(db_session)

    svc = EmailVerificationService(db_session, email_service=_mock_email_service())
    with pytest.raises(HTTPException) as exc_info:
        await svc.resend_verification_otp("jane@example.com")
    assert exc_info.value.status_code == 429
    assert exc_info.value.detail["error_code"] == "RESEND_COOLDOWN"


@pytest.mark.asyncio
async def test_resend_unknown_email_returns_generic_message_no_send(db_session: AsyncSession) -> None:
    email_service = _mock_email_service()
    svc = EmailVerificationService(db_session, email_service=email_service)

    result = await svc.resend_verification_otp("nobody@example.com")

    assert result == {"message": "If this email is pending verification, a new code has been sent."}
    email_service.send_verification_otp_email.assert_not_awaited()


# ---------------------------------------------------------------------------
# End-to-end via the HTTP API
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_api_register_then_verify_then_login(async_client, db_session: AsyncSession, monkeypatch) -> None:
    from app.services import email_verification_service as evs_module

    captured = {}

    async def _capture(self, to_email, user_name, otp_code, expiry_minutes):
        captured["otp_code"] = otp_code
        return True

    monkeypatch.setattr(evs_module.EmailService, "send_verification_otp_email", _capture)

    resp = await async_client.post(
        "/api/v1/auth/register",
        json={"name": "API User", "phone": "9000000099", "email": "api-verify@example.com", "password": EXISTING_PASSWORD},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == "api-verify@example.com"
    assert "access_token" not in body

    login_before = await async_client.post(
        "/api/v1/auth/login", json={"phone_or_email": "api-verify@example.com", "password": EXISTING_PASSWORD}
    )
    assert login_before.status_code == 403
    assert login_before.json()["detail"]["error_code"] == "EMAIL_NOT_VERIFIED"

    verify_resp = await async_client.post(
        "/api/v1/auth/verify-email-otp", json={"email": "api-verify@example.com", "otp": captured["otp_code"]}
    )
    assert verify_resp.status_code == 200
    assert "access_token" in verify_resp.json()

    login_after = await async_client.post(
        "/api/v1/auth/login", json={"phone_or_email": "api-verify@example.com", "password": EXISTING_PASSWORD}
    )
    assert login_after.status_code == 200
    assert "access_token" in login_after.json()


@pytest.mark.asyncio
async def test_api_verify_email_otp_rejects_invalid_code(async_client, db_session: AsyncSession, monkeypatch) -> None:
    from app.services import email_verification_service as evs_module

    monkeypatch.setattr(evs_module.EmailService, "send_verification_otp_email", AsyncMock(return_value=True))

    await async_client.post(
        "/api/v1/auth/register",
        json={"name": "API User2", "phone": "9000000098", "email": "api-invalid@example.com", "password": EXISTING_PASSWORD},
    )

    resp = await async_client.post(
        "/api/v1/auth/verify-email-otp", json={"email": "api-invalid@example.com", "otp": "000000"}
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error_code"] == "INVALID_OTP"
