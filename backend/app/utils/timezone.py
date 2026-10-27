"""Lab-local time helpers.

Booking dates and time-slot start/end times are stored as naive
date/time values representing the lab's local wall-clock time (India),
not UTC. Everything else in this codebase uses ``datetime.now(timezone.utc)``.
Comparing the two directly without going through these helpers is the
source of at least two prior bugs (past-slot selection, the cancellation
window check) — always convert through here instead of re-deriving the
conversion inline.
"""
from __future__ import annotations

from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

from app.config import settings

LAB_TZ = ZoneInfo(settings.lab_timezone)


def local_now() -> datetime:
    """Current time in the lab's local timezone."""
    return datetime.now(LAB_TZ)


def to_utc(local_date: date, local_time: time) -> datetime:
    """Combine a naive local date/time (lab wall-clock) into a UTC-aware datetime."""
    return datetime.combine(local_date, local_time, tzinfo=LAB_TZ).astimezone(timezone.utc)


def to_local_str(dt: datetime, fmt: str = "%H:%M:%S IST") -> str:
    """Render a UTC-aware datetime as lab-local (IST) wall-clock time for user-facing text.

    User-facing strings (error messages, exports) must never surface raw UTC —
    always go through here instead of calling .strftime() on a UTC datetime directly.
    """
    return dt.astimezone(LAB_TZ).strftime(fmt)


def local_midnight(now: datetime | None = None) -> datetime:
    """Start of the current lab-local (IST) calendar day, returned as UTC-aware.

    Use this instead of truncating a UTC ``now`` to midnight — the two only
    agree when LAB_TZ has a zero offset, and IST does not.
    """
    reference = now or datetime.now(timezone.utc)
    return reference.astimezone(LAB_TZ).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).astimezone(timezone.utc)
