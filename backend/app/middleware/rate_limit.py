"""Sliding-window rate limiting middleware for auth endpoints."""
from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.config import settings

# Limits are driven by config so they can be tuned (or disabled) per environment
# without a code change. Defaults live in app.config.Settings.
_ENABLED = settings.rate_limit_enabled
_WINDOW_MINUTES = settings.rate_limit_window_minutes
_MAX_ATTEMPTS = settings.rate_limit_max_attempts
_AUTH_PREFIX = "/api/v1/auth/"

# Forgot-password gets its own, tighter sliding window on top of the general
# auth limit above — it sends an email per request, so it's a more attractive
# target for abuse (spamming a victim's inbox, or probing many addresses).
_FORGOT_PASSWORD_PATH = "/api/v1/auth/forgot-password"
_FORGOT_PASSWORD_WINDOW_MINUTES = settings.password_reset_rate_limit_window_minutes
_FORGOT_PASSWORD_MAX_ATTEMPTS = settings.password_reset_rate_limit_max_attempts


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Sliding window rate limiter over /api/v1/auth/ (per IP), configurable via env."""

    def __init__(self, app, **kwargs):  # type: ignore[override]
        super().__init__(app, **kwargs)
        self._counters: dict[str, list[datetime]] = defaultdict(list)
        self._forgot_password_counters: dict[str, list[datetime]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next) -> Response:  # type: ignore[override]
        if not _ENABLED or not request.url.path.startswith(_AUTH_PREFIX):
            return await call_next(request)

        ip = request.client.host if request.client else "unknown"
        now = datetime.now(timezone.utc)

        if request.url.path == _FORGOT_PASSWORD_PATH:
            blocked = self._check_and_record(
                self._forgot_password_counters, ip, now,
                _FORGOT_PASSWORD_WINDOW_MINUTES, _FORGOT_PASSWORD_MAX_ATTEMPTS,
            )
            if blocked is not None:
                return blocked

        blocked = self._check_and_record(
            self._counters, ip, now, _WINDOW_MINUTES, _MAX_ATTEMPTS,
        )
        if blocked is not None:
            return blocked

        return await call_next(request)

    @staticmethod
    def _check_and_record(
        counters: dict[str, list[datetime]],
        ip: str,
        now: datetime,
        window_minutes: int,
        max_attempts: int,
    ) -> Response | None:
        """Returns a 429 response if the IP is over budget, else records this
        attempt and returns None."""
        window_start = now - timedelta(minutes=window_minutes)
        counters[ip] = [ts for ts in counters[ip] if ts > window_start]

        if len(counters[ip]) >= max_attempts:
            oldest = counters[ip][0]
            retry_after = math.ceil((oldest + timedelta(minutes=window_minutes) - now).total_seconds())
            return JSONResponse(
                status_code=429,
                content={
                    "error_code": "RATE_LIMIT_EXCEEDED",
                    "message": "Too many requests. Please try again later.",
                },
                headers={"Retry-After": str(max(retry_after, 1))},
            )

        counters[ip].append(now)
        return None
