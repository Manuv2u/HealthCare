import uuid

from sqlalchemy import String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class CallbackRequest(TimestampMixin, Base):
    """A lead the team owes a reply to.

    Backs both the "Request a Callback" widget and the contact page's
    "Send a message" form — `source` says which one it came from.
    """

    __tablename__ = "callback_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    source: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="callback", index=True
    )
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    subject: Mapped[str | None] = mapped_column(String(50), nullable=True)
    preferred_time: Mapped[str | None] = mapped_column(String(100), nullable=True)
    #: What the visitor wrote. Distinct from `notes`, which is the admin's own scratch space.
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="new")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
