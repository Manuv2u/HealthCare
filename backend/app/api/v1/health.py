"""Health and metrics endpoints."""
from __future__ import annotations

import logging
import time
from collections import defaultdict
from typing import Any

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse, JSONResponse
from sqlalchemy import text

router = APIRouter(tags=["health"])

logger = logging.getLogger("sri.health")

# Simple in-process metrics counters
_metrics: dict[str, Any] = {
    "request_count": defaultdict(int),   # path -> count
    "error_count": defaultdict(int),     # path -> count
    "response_times": defaultdict(list), # path -> [ms, ...]
}


def record_request(path: str, status_code: int, elapsed_ms: float) -> None:
    _metrics["request_count"][path] += 1
    if status_code >= 500:
        _metrics["error_count"][path] += 1
    _metrics["response_times"][path].append(elapsed_ms)
    # Keep only last 1000 samples per path to bound memory
    if len(_metrics["response_times"][path]) > 1000:
        _metrics["response_times"][path] = _metrics["response_times"][path][-1000:]


@router.get("/health")
async def health_check() -> JSONResponse:
    from app.database import engine
    from app.services.storage_service import get_storage_backend

    db_ok = False
    storage_ok = False

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception as exc:
        logger.critical("health_check_db_failed: %s", exc)

    try:
        storage = get_storage_backend()
        storage_ok = await storage.health_check()
    except Exception as exc:
        logger.error("health_check_storage_failed: %s", exc)

    healthy = db_ok and storage_ok
    status_code = 200 if healthy else 503

    return JSONResponse(
        status_code=status_code,
        content={
            "status": "healthy" if healthy else "unhealthy",
            "db": "ok" if db_ok else "error",
            "storage": "ok" if storage_ok else "error",
        },
    )


@router.get("/metrics", response_class=PlainTextResponse)
async def metrics() -> str:
    """Prometheus text format metrics."""
    lines = []

    total_requests = sum(_metrics["request_count"].values())
    total_errors = sum(_metrics["error_count"].values())

    lines.append("# HELP sri_requests_total Total HTTP requests")
    lines.append("# TYPE sri_requests_total counter")
    lines.append(f"sri_requests_total {total_requests}")

    lines.append("# HELP sri_errors_total Total HTTP 5xx errors")
    lines.append("# TYPE sri_errors_total counter")
    lines.append(f"sri_errors_total {total_errors}")

    error_rate = (total_errors / total_requests * 100) if total_requests > 0 else 0.0
    lines.append("# HELP sri_error_rate_percent Error rate percentage")
    lines.append("# TYPE sri_error_rate_percent gauge")
    lines.append(f"sri_error_rate_percent {error_rate:.2f}")

    all_times = [t for times in _metrics["response_times"].values() for t in times]
    avg_ms = (sum(all_times) / len(all_times)) if all_times else 0.0
    lines.append("# HELP sri_avg_response_time_ms Average response time in ms")
    lines.append("# TYPE sri_avg_response_time_ms gauge")
    lines.append(f"sri_avg_response_time_ms {avg_ms:.2f}")

    return "\n".join(lines) + "\n"
