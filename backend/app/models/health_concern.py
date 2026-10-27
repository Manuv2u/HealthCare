import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class HealthConcern(TimestampMixin, Base):
    __tablename__ = "health_concerns"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    key: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    icon: Mapped[str] = mapped_column(String(50), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")


class TestHealthConcern(Base):
    __tablename__ = "test_health_concerns"

    test_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tests.id"), primary_key=True
    )
    health_concern_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("health_concerns.id"), primary_key=True
    )

    test: Mapped["Test"] = relationship("Test")
    health_concern: Mapped["HealthConcern"] = relationship("HealthConcern")


class PackageHealthConcern(Base):
    __tablename__ = "package_health_concerns"

    package_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("packages.id"), primary_key=True
    )
    health_concern_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("health_concerns.id"), primary_key=True
    )

    package: Mapped["Package"] = relationship("Package")
    health_concern: Mapped["HealthConcern"] = relationship("HealthConcern")
