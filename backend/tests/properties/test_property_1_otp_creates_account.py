"""Property 1 — OTP creates account (Requirements 1.3, 1.4).

For any valid phone number:
  * verifying the correct OTP creates a user account and returns a JWT;
  * verifying a wrong OTP errors and creates no account;
  * an OTP is single-use — replaying it fails and creates no duplicate.

The OTP store is database-backed (app.models.otp.OtpCode). Tests seed codes
directly through OtpRepository with a known plaintext, mirroring what
OTPService.send_otp persists (only the SHA-256 hash is stored).
"""
from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.otp_repository import OtpRepository
from app.repositories.user_repository import UserRepository
from app.services.auth_service import AuthService

# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Valid Indian-style phone numbers: +91 followed by 10 digits starting with 6-9
phone_strategy = st.from_regex(r"\+91[6-9]\d{9}", fullmatch=True)

# Wrong OTP: 6-digit string that is NOT the correct one (we filter after seeding)
wrong_otp_strategy = st.from_regex(r"\d{6}", fullmatch=True)

CORRECT_OTP = "123456"


async def _seed_otp(db: AsyncSession, phone: str, code: str = CORRECT_OTP) -> None:
    """Persist a hashed OTP row exactly as OTPService.send_otp would."""
    repo = OtpRepository(db)
    await repo.create_code(
        phone=phone,
        purpose="login",
        code_hash=hashlib.sha256(code.encode()).hexdigest(),
        provider="mock",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )


# ---------------------------------------------------------------------------
# Property tests
# ---------------------------------------------------------------------------


@settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.too_slow, HealthCheck.function_scoped_fixture])
@given(phone=phone_strategy, name=st.text(min_size=1, max_size=50, alphabet=st.characters(whitelist_categories=("L",))))
@pytest.mark.asyncio
async def test_valid_otp_creates_account_and_returns_jwt(
    db_session: AsyncSession,
    phone: str,
    name: str,
) -> None:
    """
    **Validates: Requirements 1.3**

    For any valid phone number, verifying the correct OTP creates a user account
    and returns a JWT access token.
    """
    auth_svc = AuthService(db_session)
    await _seed_otp(db_session, phone)

    tokens = await auth_svc.verify_otp(phone=phone, otp=CORRECT_OTP, name=name)

    # Assertions — Req 1.3
    assert "access_token" in tokens, "JWT access token must be returned"
    assert tokens["access_token"], "access_token must be non-empty"
    assert tokens.get("token_type", "").lower() == "bearer"

    # User account must exist in DB
    user_repo = UserRepository(db_session)
    user = await user_repo.get_by_phone(phone)
    assert user is not None, "User account must be created after valid OTP"
    assert user.phone == phone


@settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.too_slow, HealthCheck.function_scoped_fixture])
@given(phone=phone_strategy, name=st.just("TestUser"), wrong_otp=wrong_otp_strategy)
@pytest.mark.asyncio
async def test_incorrect_otp_does_not_create_account(
    db_session: AsyncSession,
    phone: str,
    name: str,
    wrong_otp: str,
) -> None:
    """
    **Validates: Requirements 1.4**

    For any valid phone number, submitting an incorrect OTP returns an error
    and does NOT create a user account.
    """
    if wrong_otp == CORRECT_OTP:
        return  # trivially skip this example

    auth_svc = AuthService(db_session)
    await _seed_otp(db_session, phone)

    with pytest.raises(HTTPException) as exc_info:
        await auth_svc.verify_otp(phone=phone, otp=wrong_otp, name=name)

    # Req 1.4: error response with descriptive message
    assert exc_info.value.status_code == 400
    detail = exc_info.value.detail
    assert detail.get("error_code") == "INVALID_OTP"
    assert detail.get("message"), "Error message must be non-empty"

    # Req 1.4: account must NOT be created
    user_repo = UserRepository(db_session)
    user = await user_repo.get_by_phone(phone)
    assert user is None, "No account should be created after incorrect OTP"


@settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.too_slow, HealthCheck.function_scoped_fixture])
@given(phone=phone_strategy, name=st.just("ReplayUser"))
@pytest.mark.asyncio
async def test_otp_is_single_use_replay_prevention(
    db_session: AsyncSession,
    phone: str,
    name: str,
) -> None:
    """
    **Validates: Requirements 1.3, 1.4**

    OTPs are single-use. Replaying the same OTP a second time does NOT create
    a second account and returns an error.
    """
    auth_svc = AuthService(db_session)
    await _seed_otp(db_session, phone)

    # First verification — should succeed and create user
    tokens = await auth_svc.verify_otp(phone=phone, otp=CORRECT_OTP, name=name)
    assert "access_token" in tokens

    # Second verification with the same OTP — must fail (OTP consumed)
    with pytest.raises(HTTPException) as exc_info:
        await auth_svc.verify_otp(phone=phone, otp=CORRECT_OTP, name=name)

    assert exc_info.value.status_code == 400
    detail = exc_info.value.detail
    assert detail.get("error_code") == "INVALID_OTP"

    # Only one user account should exist
    user_repo = UserRepository(db_session)
    user = await user_repo.get_by_phone(phone)
    assert user is not None
    assert user.phone == phone


@settings(max_examples=25, deadline=None, suppress_health_check=[HealthCheck.too_slow, HealthCheck.function_scoped_fixture])
@given(phone=phone_strategy)
@pytest.mark.asyncio
async def test_otp_verify_attempt_cap(
    db_session: AsyncSession,
    phone: str,
) -> None:
    """
    Wrong guesses are capped: after otp_max_verify_attempts failures, even the
    CORRECT code no longer verifies (the code is destroyed).
    """
    from app.config import settings as app_settings
    from app.services.otp_service import OTPService

    svc = OTPService(db_session)
    await _seed_otp(db_session, phone)

    for _ in range(app_settings.otp_max_verify_attempts):
        assert not await svc.verify_otp(phone, "000000")
    # Cap reached — correct code must now be rejected too.
    assert not await svc.verify_otp(phone, CORRECT_OTP)
