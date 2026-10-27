"""SettingsRepository — CRUD for admin-configurable settings."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import CancellationSetting, ContactSetting, ProviderConfig


class SettingsRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_active_cancellation_setting(self) -> CancellationSetting | None:
        result = await self.db.execute(
            select(CancellationSetting)
            .where(CancellationSetting.is_active.is_(True))
            .order_by(CancellationSetting.updated_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def upsert_cancellation_setting(
        self,
        charge_type: str,
        charge_value: float,
        updated_by: uuid.UUID,
    ) -> CancellationSetting:
        # Deactivate all existing active settings
        await self.db.execute(
            update(CancellationSetting)
            .where(CancellationSetting.is_active.is_(True))
            .values(is_active=False)
        )
        now = datetime.now(timezone.utc)
        setting = CancellationSetting(
            id=uuid.uuid4(),
            charge_type=charge_type,
            charge_value=charge_value,
            is_active=True,
            updated_by=updated_by,
            created_at=now,
            updated_at=now,
        )
        self.db.add(setting)
        await self.db.flush()
        await self.db.refresh(setting)
        return setting

    async def disable_cancellation_charges(self) -> None:
        await self.db.execute(
            update(CancellationSetting)
            .where(CancellationSetting.is_active.is_(True))
            .values(is_active=False)
        )
        await self.db.flush()

    # ── provider configs (which OTP / payment provider is active) ────────────

    async def get_provider_config(self, scope: str) -> ProviderConfig | None:
        result = await self.db.execute(
            select(ProviderConfig).where(ProviderConfig.scope == scope)
        )
        return result.scalar_one_or_none()

    async def upsert_provider_config(
        self,
        scope: str,
        active_provider: str,
        config: dict | None = None,
        updated_by: uuid.UUID | None = None,
    ) -> ProviderConfig:
        existing = await self.get_provider_config(scope)
        now = datetime.now(timezone.utc)
        if existing is not None:
            await self.db.execute(
                update(ProviderConfig)
                .where(ProviderConfig.id == existing.id)
                .values(
                    active_provider=active_provider,
                    config=config if config is not None else existing.config,
                    updated_by=updated_by,
                    updated_at=now,
                )
            )
            await self.db.flush()
            return await self.get_provider_config(scope)  # type: ignore[return-value]
        row = ProviderConfig(
            id=uuid.uuid4(),
            scope=scope,
            active_provider=active_provider,
            config=config,
            updated_by=updated_by,
            created_at=now,
            updated_at=now,
        )
        self.db.add(row)
        await self.db.flush()
        return row

    async def get_active_contact_setting(self) -> ContactSetting | None:
        result = await self.db.execute(
            select(ContactSetting)
            .where(ContactSetting.is_active.is_(True))
            .order_by(ContactSetting.updated_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def upsert_contact_setting(
        self,
        phone_number: str,
        whatsapp_number: str,
        callback_enabled: bool,
        updated_by: uuid.UUID,
        working_hours: str | None = None,
        call_enabled: bool = True,
        whatsapp_enabled: bool = True,
    ) -> ContactSetting:
        await self.db.execute(
            update(ContactSetting)
            .where(ContactSetting.is_active.is_(True))
            .values(is_active=False)
        )
        now = datetime.now(timezone.utc)
        setting = ContactSetting(
            id=uuid.uuid4(),
            phone_number=phone_number,
            whatsapp_number=whatsapp_number,
            callback_enabled=callback_enabled,
            working_hours=working_hours,
            call_enabled=call_enabled,
            whatsapp_enabled=whatsapp_enabled,
            is_active=True,
            updated_by=updated_by,
            created_at=now,
            updated_at=now,
        )
        self.db.add(setting)
        await self.db.flush()
        await self.db.refresh(setting)
        return setting
