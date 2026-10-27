"""Structured JSON request logging middleware."""
from __future__ import annotations

import json
import logging
import time
import traceback
from datetime import datetime, timezone

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("sri.access")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:  # type: ignore[override]
        start = time.monotonic()
        exc_info = None
        status_code = 500

        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception as exc:
            exc_info = exc
            status_code = 500

        elapsed_ms = round((time.monotonic() - start) * 1000, 2)
        log_record = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "method": request.method,
            "path": request.url.path,
            "status_code": status_code,
            "response_time_ms": elapsed_ms,
        }

        if exc_info is not None:
            log_record["exception_type"] = type(exc_info).__name__
            log_record["exception_message"] = str(exc_info)
            log_record["stack_trace"] = traceback.format_exc()
            logger.error(json.dumps(log_record))
            raise exc_info

        if status_code >= 500:
            logger.error(json.dumps(log_record))
        elif status_code >= 400:
            logger.warning(json.dumps(log_record))
        else:
            logger.info(json.dumps(log_record))

        return response
