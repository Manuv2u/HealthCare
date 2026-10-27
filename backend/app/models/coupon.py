import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Coupon(TimestampMixin, Base):
    """Admin-managed discount code, applied explicitly by the user at checkout.

    Replaces the old banner-driven auto-apply-by-package-membership discount
    mechanism: a coupon only ever discounts a booking once its code has been
    entered and validated (see CouponService), never silently.
    """

    __tablename__ = "coupons"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    code: Mapped[str] = mapped_column(String(30), nullable=False, unique=True)
    # percentage | fixed
    discount_type: Mapped[str] = mapped_column(String(10), nullable=False)
    discount_value: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Null = unlimited.
    usage_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    per_user_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    times_used: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

    # Relationships
    coupon_packages: Mapped[list["CouponPackage"]] = relationship(
        "CouponPackage", back_populates="coupon", cascade="all, delete-orphan"
    )


class CouponPackage(Base):
    """Applicable-package link for a coupon (mirrors the old BannerPackage)."""

    __tablename__ = "coupon_packages"

    coupon_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("coupons.id", ondelete="CASCADE"),
        primary_key=True,
    )
    package_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("packages.id"), primary_key=True
    )

    # Relationships
    coupon: Mapped["Coupon"] = relationship("Coupon", back_populates="coupon_packages")
    package: Mapped[object] = relationship("Package", foreign_keys=[package_id])
