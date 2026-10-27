"""Shared audit logging helper — fire-and-forget wrapper."""
from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("sri.audit")


async def audit(
    db: AsyncSession,
    action_type: str,
    entity_type: str,
    entity_id: str,
    outcome: str,
    actor_id: uuid.UUID | None = None,
    actor_role: str | None = None,
    source_ip: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Write an audit log entry; never raises."""
    try:
        from app.repositories.audit_repository import AuditLogRepository
        repo = AuditLogRepository(db)
        await repo.append(
            action_type=action_type,
            entity_type=entity_type,
            entity_id=entity_id,
            outcome=outcome,
            actor_id=actor_id,
            actor_role=actor_role,
            source_ip=source_ip,
            metadata=metadata,
        )
    except Exception as exc:
        logger.error("audit_helper_failed: action=%s error=%s", action_type, exc)
