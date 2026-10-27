import uuid

from sqlalchemy import ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Banner(TimestampMixin, Base):
    """Homepage hero-carousel banner, managed via the admin panel.

    Two banner_type values share this table: 'advertisement' (image/marketing
    only) and 'promotional_offer' (marketing only too — it may optionally link
    to a Coupon via coupon_id purely to display that coupon's code as a badge;
    the discount itself lives entirely on the Coupon, see CouponService).
    """

    __tablename__ = "banners"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    # Nullable: an admin may upload only an image with no content fields —
    # the homepage then renders the image alone, no title/text/CTA overlay.
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    subtitle: Mapped[str | None] = mapped_column(String(400), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    cta_text: Mapped[str | None] = mapped_column(String(80), nullable=True)
    cta_link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Optional secondary CTA (e.g. "View Packages").
    cta2_text: Mapped[str | None] = mapped_column(String(80), nullable=True)
    cta2_link: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Free-form bullet highlights shown on the banner.
    highlights: Mapped[list] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )

    category: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default="packages"
    )

    # advertisement | promotional_offer
    banner_type: Mapped[str] = mapped_column(
        String(30), nullable=False, server_default="advertisement"
    )
    # Optional link to the Coupon this banner advertises — display only, the
    # discount itself is owned entirely by the Coupon (see CouponService).
    coupon_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("coupons.id", ondelete="SET NULL"), nullable=True
    )

    # Separate desktop / mobile artwork stored as storage keys.
    desktop_image_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    mobile_image_key: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Carousel display order.
    display_order: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    # draft | published
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="draft"
    )
