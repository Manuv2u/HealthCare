"""Audit middleware: logs 401/403 responses to audit_logs (fire-and-forget)."""
from __future__ import annotations

import asyncio
import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("sri.audit")


class AuditMiddleware(BaseHTTPMiddleware):
    """After each response, fire-and-forget audit log for 401/403 status codes."""

    async def dispatch(self, request: Request, call_next) -> Response:  # type: ignore[override]
        response = await call_next(request)
        if response.status_code in (401, 403):
            asyncio.ensure_future(self._log_event(request, response.status_code))
        return response

    async def _log_event(self, request: Request, status_code: int) -> None:
        try:
            from app.database import AsyncSessionFactory
            from app.models.audit import AuditLog

            action_type = "USER_LOGIN_FAILURE" if status_code == 401 else "ACCESS_DENIED"
            source_ip = request.client.host if request.client else None

            async with AsyncSessionFactory() as db:
                log_entry = AuditLog(
                    action_type=action_type,
                    entity_type="endpoint",
                    entity_id=request.url.path,
                    outcome="failure",
                    source_ip=source_ip,
                )
                db.add(log_entry)
                await db.commit()
        except Exception as exc:
            logger.error("Audit log write failed: %s", exc)
