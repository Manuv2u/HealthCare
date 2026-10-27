import uuid

from sqlalchemy import Boolean, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Faq(TimestampMixin, Base):
    """General, application-wide FAQ entry managed via the admin panel.

    Distinct from per-test FAQs (stored as JSONB on the Test model); these are
    global questions about using the service (booking, home collection, reports,
    payments, etc.) and are shown on the public /faq page and the Contact page.
    """

    __tablename__ = "faqs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default="general"
    )
    question: Mapped[str] = mapped_column(String(300), nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    display_order: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
