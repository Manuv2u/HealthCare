"""JWT authentication dependency and RBAC helpers."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.utils.jwt import decode_access_token

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """FastAPI dependency: extract and validate Bearer JWT, return {user_id, role}.

    Beyond signature/expiry, this re-checks the user's live DB state on every
    request so that deactivation and logout-all take effect immediately
    instead of waiting out the token's remaining lifetime.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error_code": "MISSING_TOKEN", "message": "Authorization header required"},
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")
    role = payload.get("role")
    issued_at = payload.get("iat")
    if not user_id or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error_code": "INVALID_TOKEN", "message": "Invalid token payload"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    from app.repositories.user_repository import UserRepository

    user = await UserRepository(db).get_by_id(uuid.UUID(user_id))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error_code": "ACCOUNT_DEACTIVATED", "message": "This account is no longer active"},
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.tokens_invalidated_at is not None and issued_at is not None:
        issued_dt = datetime.fromtimestamp(issued_at, tz=timezone.utc)
        if issued_dt < user.tokens_invalidated_at:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error_code": "TOKEN_REVOKED", "message": "Session has been revoked, please log in again"},
                headers={"WWW-Authenticate": "Bearer"},
            )

    return {"user_id": user_id, "role": role}


def require_roles(*roles: str) -> Callable:
    """Dependency factory: raises 403 if current user's role is not in *roles."""

    async def _check(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "FORBIDDEN",
                    "message": "You do not have permission to perform this action",
                },
            )
        return current_user

    return _check
