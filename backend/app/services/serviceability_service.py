"""Home-collection serviceability rules engine.

The booking UI never decides *why* an address can or cannot be served — it only
renders the verdict this module returns. That split is deliberate: new rules
(technician availability, holidays, temporary blocks) can be added here and the
booking flow picks them up without a single UI change.

Adding a rule
-------------
Write a coroutine that takes a `_RuleContext` and returns either `None` (rule
passes, keep checking) or a `ServiceabilityVerdict` (rule blocks, stop here) and
append it to `_RULES`. The first blocking rule wins, so order `_RULES` from
cheapest/most-fundamental to most expensive. Give the rule its own `reason_code`
so callers and analytics can tell verdicts apart, and write `message` as
finished, user-facing copy — the UI prints it verbatim.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.service import ServiceArea
from app.repositories.service_repository import ServiceAreaRepository


@dataclass(frozen=True)
class ServiceabilityVerdict:
    """The answer to "can we collect from this pincode?", ready to render."""

    pincode: str
    serviceable: bool
    reason_code: str
    message: str
    area_label: str | None = None


@dataclass
class _RuleContext:
    """What a rule gets to look at. Widen this as rules need more inputs."""

    pincode: str
    area: ServiceArea | None


# A rule returns None to pass, or a verdict to block.
_Rule = Callable[[_RuleContext], Awaitable[ServiceabilityVerdict | None]]


async def _pincode_coverage(ctx: _RuleContext) -> ServiceabilityVerdict | None:
    """The pincode must fall inside an active service area."""
    if ctx.area is not None:
        return None
    return ServiceabilityVerdict(
        pincode=ctx.pincode,
        serviceable=False,
        reason_code="OUT_OF_SERVICE_AREA",
        message=(
            f"Home Collection is currently unavailable for this address "
            f"(PIN Code {ctx.pincode})."
        ),
    )


_RULES: list[_Rule] = [
    _pincode_coverage,
]


def _area_label(area: ServiceArea | None) -> str | None:
    if area is None:
        return None
    parts = [p for p in (area.area, area.city) if p]
    return ", ".join(parts) or None


async def check_pincode(db: AsyncSession, pincode: str) -> ServiceabilityVerdict:
    """Evaluate every rule for one pincode. First blocking rule wins."""
    repo = ServiceAreaRepository(db)
    area = await repo.get_by_pincode(pincode)
    ctx = _RuleContext(pincode=pincode, area=area)

    for rule in _RULES:
        verdict = await rule(ctx)
        if verdict is not None:
            return verdict

    return ServiceabilityVerdict(
        pincode=pincode,
        serviceable=True,
        reason_code="AVAILABLE",
        message="Home Collection is available at this address.",
        area_label=_area_label(area),
    )


async def check_pincodes(
    db: AsyncSession, pincodes: list[str]
) -> list[ServiceabilityVerdict]:
    """Batch form so the booking step can badge a whole address list in one call.

    Duplicate pincodes are evaluated once; the input order is preserved so
    callers can zip the result back onto their own list.
    """
    verdicts: dict[str, ServiceabilityVerdict] = {}
    for pincode in pincodes:
        if pincode not in verdicts:
            verdicts[pincode] = await check_pincode(db, pincode)
    return [verdicts[p] for p in pincodes]
