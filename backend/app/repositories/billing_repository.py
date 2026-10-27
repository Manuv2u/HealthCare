"""Repositories for billing settings, immutable invoices and booking adjustments."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import BillingSetting, BookingAdjustment, Invoice


class BillingSettingsRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_active(self) -> BillingSetting | None:
        result = await self.db.execute(
            select(BillingSetting)
            .where(BillingSetting.is_active.is_(True))
            .order_by(BillingSetting.updated_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def upsert(self, updated_by: uuid.UUID, **fields) -> BillingSetting:
        """Versioned update: deactivate the current row, insert a fresh one.
        Missing fields inherit from the previous active row so a partial update
        never silently resets other settings."""
        current = await self.get_active()
        inherited = {}
        if current is not None:
            inherited = {
                "invoice_enabled": current.invoice_enabled,
                "invoice_prefix": current.invoice_prefix,
                "gst_enabled": current.gst_enabled,
                "gst_percentage": current.gst_percentage,
                "gstin": current.gstin,
                "company_name": current.company_name,
                "company_address": current.company_address,
                "company_phone": current.company_phone,
                "company_email": current.company_email,
                "invoice_footer": current.invoice_footer,
                "show_logo": current.show_logo,
                "refund_eta_text": current.refund_eta_text,
                "show_barcode": current.show_barcode,
                "show_doctor": current.show_doctor,
                "show_technician": current.show_technician,
                "show_patient_address": current.show_patient_address,
                "show_signature": current.show_signature,
                "show_report_info": current.show_report_info,
                "show_qr_code": current.show_qr_code,
                "currency_symbol": current.currency_symbol,
                "decimal_precision": current.decimal_precision,
                "company_website": current.company_website,
                "company_cin": current.company_cin,
                "nabl_registration_number": current.nabl_registration_number,
                "iso_certification": current.iso_certification,
            }
        inherited.update({k: v for k, v in fields.items() if v is not None or k in fields})

        await self.db.execute(
            update(BillingSetting)
            .where(BillingSetting.is_active.is_(True))
            .values(is_active=False)
        )
        now = datetime.now(timezone.utc)
        setting = BillingSetting(
            id=uuid.uuid4(),
            is_active=True,
            updated_by=updated_by,
            created_at=now,
            updated_at=now,
            **inherited,
        )
        self.db.add(setting)
        await self.db.flush()
        await self.db.refresh(setting)
        return setting

    async def next_invoice_number(self, prefix: str) -> str:
        """Allocate the next invoice number from a real DB sequence — numbers
        survive settings changes and can never collide or reset. Non-PostgreSQL
        engines (the SQLite test suite) fall back to a random unique suffix."""
        year = datetime.now(timezone.utc).year
        if self.db.bind.dialect.name == "postgresql":  # type: ignore[union-attr]
            seq = (await self.db.execute(text("SELECT nextval('invoice_number_seq')"))).scalar_one()
            return f"{prefix}-{year}-{int(seq):06d}"
        return f"{prefix}-{year}-{uuid.uuid4().hex[:8].upper()}"


class InvoiceRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, **fields) -> Invoice:
        invoice = Invoice(id=uuid.uuid4(), **fields)
        self.db.add(invoice)
        await self.db.flush()
        await self.db.refresh(invoice)
        return invoice

    async def get_by_id(self, invoice_id: uuid.UUID) -> Invoice | None:
        result = await self.db.execute(select(Invoice).where(Invoice.id == invoice_id))
        return result.scalar_one_or_none()

    async def get_by_payment_id(self, payment_id: uuid.UUID) -> Invoice | None:
        result = await self.db.execute(select(Invoice).where(Invoice.payment_id == payment_id))
        return result.scalar_one_or_none()

    async def get_by_booking_id(self, booking_id: uuid.UUID) -> Invoice | None:
        result = await self.db.execute(select(Invoice).where(Invoice.booking_id == booking_id))
        return result.scalar_one_or_none()

    async def search(
        self,
        query: str | None = None,
        booking_id: uuid.UUID | None = None,
        user_id: uuid.UUID | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Invoice], int]:
        """Admin search. `query` matches invoice number, payment id, booking
        reference, or patient name/phone (joined at the API layer via user_id
        resolution when needed — here we match invoice_number directly plus
        exact ids)."""
        stmt = select(Invoice)
        conditions = []
        if query:
            q = query.strip()
            like = f"%{q}%"
            ors = [Invoice.invoice_number.ilike(like)]
            try:
                ors.append(Invoice.payment_id == uuid.UUID(q))
                ors.append(Invoice.booking_id == uuid.UUID(q))
            except ValueError:
                pass
            from sqlalchemy import or_
            conditions.append(or_(*ors))
        if booking_id is not None:
            conditions.append(Invoice.booking_id == booking_id)
        if user_id is not None:
            conditions.append(Invoice.user_id == user_id)
        if date_from is not None:
            conditions.append(func.date(Invoice.issued_at) >= date_from)
        if date_to is not None:
            conditions.append(func.date(Invoice.issued_at) <= date_to)
        if conditions:
            stmt = stmt.where(*conditions)

        total = (
            await self.db.execute(
                select(func.count()).select_from(stmt.subquery())
            )
        ).scalar_one()
        result = await self.db.execute(
            stmt.order_by(Invoice.issued_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(result.scalars().all()), total

    async def set_pdf_storage_key(self, invoice_id: uuid.UUID, key: str) -> None:
        """The one permitted mutation: remembering where the rendered PDF lives.
        Financial fields are never updated after creation."""
        await self.db.execute(
            update(Invoice).where(Invoice.id == invoice_id).values(pdf_storage_key=key)
        )
        await self.db.flush()


class AdjustmentRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_by_booking(self, booking_id: uuid.UUID) -> list[BookingAdjustment]:
        result = await self.db.execute(
            select(BookingAdjustment)
            .where(BookingAdjustment.booking_id == booking_id)
            .order_by(BookingAdjustment.created_at.asc())
        )
        return list(result.scalars().all())

    async def get_by_id(self, adjustment_id: uuid.UUID) -> BookingAdjustment | None:
        result = await self.db.execute(
            select(BookingAdjustment).where(BookingAdjustment.id == adjustment_id)
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        booking_id: uuid.UUID,
        kind: str,
        label: str,
        amount: float,
        created_by: uuid.UUID | None = None,
        source: str = "manual",
        coupon_id: uuid.UUID | None = None,
    ) -> BookingAdjustment:
        adjustment = BookingAdjustment(
            id=uuid.uuid4(),
            booking_id=booking_id,
            kind=kind,
            label=label,
            amount=amount,
            created_by=created_by,
            source=source,
            coupon_id=coupon_id,
        )
        self.db.add(adjustment)
        await self.db.flush()
        await self.db.refresh(adjustment)
        return adjustment

    async def delete(self, adjustment_id: uuid.UUID) -> None:
        adjustment = await self.get_by_id(adjustment_id)
        if adjustment is not None:
            await self.db.delete(adjustment)
            await self.db.flush()
