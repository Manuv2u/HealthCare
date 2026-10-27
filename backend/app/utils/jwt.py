"""JWT utilities: access token creation/decoding and refresh token helpers."""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

ALGORITHM = "HS256"
# Kept short because access tokens are otherwise stateless — this bounds how
# long a stolen, post-logout, or post-deactivation token stays usable before
# the mandatory DB re-check in get_current_user() catches it on refresh. The
# frontend refresh interceptor mints a new one transparently.
ACCESS_TOKEN_EXPIRE_HOURS = 2


def create_access_token(user_id: str, role: str, name: str = "") -> str:
    """Create a signed HS256 JWT with a short expiry."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "name": name,
        "jti": str(uuid.uuid4()),
        "exp": now + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),
        "iat": now,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT. Raises HTTP 401 on invalid/expired token."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error_code": "INVALID_TOKEN", "message": "Invalid or expired token"},
            headers={"WWW-Authenticate": "Bearer"},
        )


def generate_refresh_token() -> str:
    """Generate a 256-bit cryptographically secure random token."""
    return secrets.token_urlsafe(32)


def hash_refresh_token(token: str) -> str:
    """Bcrypt-hash a refresh token for storage."""
    return _pwd_context.hash(token)


def verify_refresh_token(plain: str, hashed: str) -> bool:
    """Verify a plain refresh token against its bcrypt hash."""
    return _pwd_context.verify(plain, hashed)
