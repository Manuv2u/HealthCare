import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, JSONBCompat, TimestampMixin


class CancellationSetting(TimestampMixin, Base):
    __tablename__ = "cancellation_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    charge_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'percentage' or 'fixed'
    charge_value: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )


class ContactSetting(TimestampMixin, Base):
    __tablename__ = "contact_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    phone_number: Mapped[str] = mapped_column(String(20), nullable=False)
    whatsapp_number: Mapped[str] = mapped_column(String(20), nullable=False)
    callback_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    working_hours: Mapped[str | None] = mapped_column(String(100), nullable=True)
    call_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    whatsapp_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )


class ProviderConfig(TimestampMixin, Base):
    """Which external provider is active for a scope ('otp' | 'payment'), plus
    non-secret provider options. API keys/secrets stay in environment variables —
    this table only selects the provider and holds display/behaviour config."""

    __tablename__ = "provider_configs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    scope: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    active_provider: Mapped[str] = mapped_column(String(30), nullable=False)
    config: Mapped[dict | None] = mapped_column(JSONBCompat, nullable=True)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
