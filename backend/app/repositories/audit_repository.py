"""AuditLogRepository — append-only audit log."""
from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog

logger = logging.getLogger("sri.audit")


class AuditLogRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def append(
        self,
        action_type: str,
        entity_type: str,
        entity_id: str,
        outcome: str,
        actor_id: uuid.UUID | None = None,
        actor_role: str | None = None,
        source_ip: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """INSERT-only; errors are logged but never raised to caller."""
        try:
            log = AuditLog(
                id=uuid.uuid4(),
                actor_id=actor_id,
                actor_role=actor_role,
                action_type=action_type,
                entity_type=entity_type,
                entity_id=entity_id,
                outcome=outcome,
                source_ip=source_ip,
                extra_data=metadata,
            )
            self.db.add(log)
            await self.db.flush()
        except Exception as exc:
            logger.error(
                "audit_log_write_failed: action=%s entity=%s/%s error=%s",
                action_type,
                entity_type,
                entity_id,
                exc,
            )

    async def query(
        self,
        actor_id: uuid.UUID | None = None,
        action_type: str | None = None,
        entity_type: str | None = None,
        outcome: str | None = None,
        from_dt: Any = None,
        to_dt: Any = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[AuditLog], int]:
        from sqlalchemy import func

        base = select(AuditLog)
        if actor_id is not None:
            base = base.where(AuditLog.actor_id == actor_id)
        if action_type is not None:
            base = base.where(AuditLog.action_type == action_type)
        if entity_type is not None:
            base = base.where(AuditLog.entity_type == entity_type)
        if outcome is not None:
            base = base.where(AuditLog.outcome == outcome)
        if from_dt is not None:
            base = base.where(AuditLog.created_at >= from_dt)
        if to_dt is not None:
            base = base.where(AuditLog.created_at <= to_dt)

        count_result = await self.db.execute(
            select(func.count()).select_from(base.subquery())
        )
        total = count_result.scalar_one()

        result = await self.db.execute(
            base.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)
        )
        return list(result.scalars().all()), total
