"""Shared fixtures for property-based tests.

App repositories/services run against the REAL app model classes; the mirror
models below exist only to CREATE SQLite-compatible tables with the same names
and columns (the real models use PostgreSQL-only DDL like gen_random_uuid()
server defaults, ARRAY and JSONB, which SQLite cannot create).

Hypothesis settings:
  - Default profile: max_examples=100  (use `@settings(max_examples=100)`)
  - Concurrency profile: max_examples=200  (use `@settings(max_examples=200)` for P13)
"""
from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from datetime import date, datetime
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from fastapi import FastAPI
from hypothesis import HealthCheck, settings
from httpx import ASGITransport, AsyncClient
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text
from sqlalchemy import text as sa_text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# ---------------------------------------------------------------------------
# Hypothesis settings profiles
# ---------------------------------------------------------------------------
# Default: 100 examples for most property tests
settings.register_profile("default", max_examples=100, suppress_health_check=[HealthCheck.too_slow])
# Concurrency: 200 examples for P13 (Slot Capacity Invariant) and similar
settings.register_profile("concurrency", max_examples=200, suppress_health_check=[HealthCheck.too_slow])
settings.load_profile("default")


# ---------------------------------------------------------------------------
# Mirror models — SQLite-compatible DDL for the real tables
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(10), nullable=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="user")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    is_temp_password: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deletion_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Auth-hardening fields (migration 0011) + profile/CRM fields (0009/0017) —
    # the mirror table must contain every column the real User model selects.
    tokens_invalidated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    login_attempt_count: Mapped[int] = mapped_column(default=0, nullable=False, server_default="0")
    login_window_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    health_concerns: Mapped[str | None] = mapped_column(Text, nullable=True)
    health_concern_prompt_dismissed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    avatar_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    alternate_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    phone_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)
    # CRM / login-tracking fields (mirrors migrations 0017) — needed so the auth
    # flow's login summary update works against the SQLite test models.
    account_status: Mapped[str] = mapped_column(String(20), nullable=False, default="active", server_default="active")
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_logout_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    first_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    login_count: Mapped[int] = mapped_column(default=0, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, server_default=sa_text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, server_default=sa_text("CURRENT_TIMESTAMP"))

    sessions: Mapped[list["Session"]] = relationship("Session", back_populates="user")


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    refresh_token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    device_identifier: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, server_default=sa_text("CURRENT_TIMESTAMP"))

    user: Mapped["User"] = relationship("User", back_populates="sessions")


class OtpCode(Base):
    """Mirror of app.models.otp.OtpCode for the SQLite test schema."""

    __tablename__ = "otp_codes"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    purpose: Mapped[str] = mapped_column(String(20), nullable=False, default="login")
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    provider: Mapped[str | None] = mapped_column(String(30), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts: Mapped[int] = mapped_column(default=0, nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, server_default=sa_text("CURRENT_TIMESTAMP"))


class OtpSendEvent(Base):
    """Mirror of app.models.otp.OtpSendEvent for the SQLite test schema."""

    __tablename__ = "otp_send_events"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    purpose: Mapped[str] = mapped_column(String(20), nullable=False, default="login")
    provider: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    provider_message_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, server_default=sa_text("CURRENT_TIMESTAMP"))


class CancellationSetting(Base):
    """Mirror of app.models.settings.CancellationSetting."""

    __tablename__ = "cancellation_settings"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    charge_type: Mapped[str] = mapped_column(String(20), nullable=False)
    charge_value: Mapped[float] = mapped_column(nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, server_default=sa_text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, server_default=sa_text("CURRENT_TIMESTAMP"))


class ContactSetting(Base):
    """Mirror of app.models.settings.ContactSetting."""

    __tablename__ = "contact_settings"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone_number: Mapped[str] = mapped_column(String(20), nullable=False)
    whatsapp_number: Mapped[str] = mapped_column(String(20), nullable=False)
    callback_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    working_hours: Mapped[str | None] = mapped_column(String(100), nullable=True)
    call_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    whatsapp_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, server_default=sa_text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, server_default=sa_text("CURRENT_TIMESTAMP"))


class ProviderConfig(Base):
    """Mirror of app.models.settings.ProviderConfig (config JSON omitted —
    provider resolution only reads scope + active_provider)."""

    __tablename__ = "provider_configs"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scope: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    active_provider: Mapped[str] = mapped_column(String(30), nullable=False)
    config: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, server_default=sa_text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, server_default=sa_text("CURRENT_TIMESTAMP"))


class FamilyMember(Base):
    __tablename__ = "family_members"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(10), nullable=True)
    relationship_type: Mapped[str] = mapped_column("relationship", String(50), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, server_default=sa_text("CURRENT_TIMESTAMP"))


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, server_default=sa_text("CURRENT_TIMESTAMP"))


class EmailVerificationOtp(Base):
    """Mirror of app.models.user.EmailVerificationOtp for the SQLite test schema."""

    __tablename__ = "email_verification_otps"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts: Mapped[int] = mapped_column(default=0, nullable=False, server_default="0")
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, server_default=sa_text("CURRENT_TIMESTAMP"))


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    actor_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    action_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(255), nullable=False)
    outcome: Mapped[str] = mapped_column(String(20), nullable=False)
    source_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    extra_metadata: Mapped[str | None] = mapped_column("metadata", Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, server_default=sa_text("CURRENT_TIMESTAMP"))


class LoginEvent(Base):
    __tablename__ = "login_events"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(20), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String, nullable=True)
    browser: Mapped[str | None] = mapped_column(String(80), nullable=True)
    os: Mapped[str | None] = mapped_column(String(80), nullable=True)
    device_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, server_default=sa_text("CURRENT_TIMESTAMP"))


class AdminNote(Base):
    __tablename__ = "admin_notes"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    author_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False)
    is_internal: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, server_default=sa_text("CURRENT_TIMESTAMP"))


# NOTE: The sys.modules stubbing that used to live here (working around a
# then-broken app/models/__init__.py) is gone: app.models imports cleanly
# now, and the stubs poisoned any combined run with tests/test_integration.py.
# Repositories/services use the REAL app model classes; the mirror models
# above exist only to CREATE SQLite-compatible tables with matching names.


@pytest_asyncio.fixture
async def db_session():
    """Provide a fresh in-memory SQLite async session for each test."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def async_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """
    Provide an httpx AsyncClient wired to a minimal FastAPI app backed by the
    in-memory SQLite test session.  No PostgreSQL or APScheduler required.

    Usage in property tests::

        async def test_something(async_client: AsyncClient) -> None:
            response = await async_client.get("/api/v1/health")
            assert response.status_code == 200
    """
    # Build a minimal app that skips the production lifespan (no APScheduler,
    # no PostgreSQL seed) but registers the same API routers.
    @asynccontextmanager
    async def _test_lifespan(app: FastAPI):  # type: ignore[type-arg]
        yield

    test_app = FastAPI(
        title="Sri Health Plus — Test",
        version="0.0.0",
        lifespan=_test_lifespan,
    )

    # Override the DB dependency so every request uses the test session.
    from app.database import get_db_session  # noqa: PLC0415

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    test_app.dependency_overrides[get_db_session] = _override_get_db

    # Register API routers (import lazily to avoid triggering production startup).
    from fastapi import APIRouter  # noqa: PLC0415
    from app.api.v1.health import router as health_router  # noqa: PLC0415
    from app.api.v1.auth import router as auth_router  # noqa: PLC0415
    from app.api.v1.users import router as users_router  # noqa: PLC0415
    from app.api.v1.tests import router as tests_router  # noqa: PLC0415
    from app.api.v1.packages import router as packages_router  # noqa: PLC0415

    api_v1 = APIRouter(prefix="/api/v1")
    api_v1.include_router(health_router)
    api_v1.include_router(auth_router)
    api_v1.include_router(users_router)
    api_v1.include_router(tests_router)
    api_v1.include_router(packages_router)
    test_app.include_router(api_v1)

    async with AsyncClient(
        transport=ASGITransport(app=test_app),
        base_url="http://testserver",
    ) as client:
        yield client
