"""InvoiceService — issues immutable invoices and renders their PDFs.

An invoice is created exactly once, when a payment succeeds. Everything on it
(amounts, parties, company details, GST, payment/technician details and the
admin's invoice-layout options) is snapshotted onto the `invoices` row at that
moment; the PDF is rendered from the snapshot and stored permanently. Nothing
about an issued invoice ever changes — re-downloads serve the stored PDF (or
re-render it byte-for-byte from the same snapshot if storage lost it).

The rendered document is a black & white A4 diagnostic-centre bill: centred
letterhead repeated on every page, barcode/QR, invoice + patient blocks, an
itemised test table, right-aligned price summary, amount in words, payment /
technician / report blocks and a repeated footer. Section visibility follows
the layout options snapshotted into `company["options"]` at issue time.
"""
from __future__ import annotations

import io
import logging
import uuid
from datetime import date, datetime, timezone
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import Invoice
from app.repositories.billing_repository import (
    AdjustmentRepository,
    BillingSettingsRepository,
    InvoiceRepository,
)
from app.services.billing_service import BillingService
from app.services.storage_service import get_storage_backend
from app.utils.timezone import LAB_TZ

logger = logging.getLogger("sri.invoice")

# Letterhead logo (bundled with the backend image — see app/assets/).
_LOGO_PATH = Path(__file__).resolve().parent.parent / "assets" / "logo-mark.png"

# Layout options snapshotted into company["options"] at issue time. Invoices
# issued before these existed render with the same defaults.
_OPTION_DEFAULTS = {
    "show_barcode": True,
    "show_doctor": True,
    "show_technician": True,
    "show_patient_address": True,
    "show_signature": True,
    "show_report_info": False,
    "show_qr_code": False,
    "currency_symbol": "₹",
    "decimal_precision": 2,
}


def _absolute_url(raw: str) -> str:
    """Admins enter the website as plain text (e.g. "srihealthplus.com"); a PDF
    hyperlink needs a scheme or it opens as a relative (broken) link."""
    raw = raw.strip()
    if raw.lower().startswith(("http://", "https://")):
        return raw
    return f"https://{raw}"


def invoice_verify_url(invoice_id: uuid.UUID) -> str:
    """Absolute link to the public, unauthenticated invoice PDF — this is what
    the letterhead QR code encodes, so scanning it opens the exact invoice."""
    from app.config import settings as app_settings

    return f"{app_settings.public_api_base_url}/api/v1/invoices/public/{invoice_id}/pdf"


def _age_on(dob: date | None, at: date) -> int | None:
    if dob is None:
        return None
    years = at.year - dob.year - ((at.month, at.day) < (dob.month, dob.day))
    return max(years, 0)


def _split_company_name(name: str) -> tuple[str, str]:
    """Split the company name into its letterhead halves — brand line and
    subtitle line. Splits at an em-dash ("NAME — TAGLINE") when present, so
    brand + tagline stay intact on their own lines. Otherwise splits at
    "LABORATORY" for legacy names ("SRI DIAGNOSTIC" / "LABORATORY & HEALTH
    CARE"); otherwise falls back to an even word split. Original casing is
    preserved (the brand line is uppercased by the caller; the subtitle
    prints as entered, matching the mixed-case letterhead style)."""
    if "—" in name:
        first, _, second = name.partition("—")
        return first.strip(), second.strip()
    words = name.split()
    upper_words = name.upper().split()
    if "LABORATORY" in upper_words:
        i = upper_words.index("LABORATORY")
        return " ".join(words[:i]), " ".join(words[i:])
    mid = max(1, len(words) // 2)
    return " ".join(words[:mid]), " ".join(words[mid:])


class InvoiceService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = InvoiceRepository(db)
        self.settings_repo = BillingSettingsRepository(db)

    # ── issue ─────────────────────────────────────────────────────────────────

    async def issue_for_payment(self, payment_id: uuid.UUID) -> Invoice | None:
        """Create the invoice for a successful payment. Idempotent — returns the
        existing invoice if one was already issued. Returns None when invoice
        generation is disabled in billing settings."""
        existing = await self.repo.get_by_payment_id(payment_id)
        if existing is not None:
            return existing

        billing_svc = BillingService(self.db)
        billing = await billing_svc.get_settings()
        if not billing["invoice_enabled"]:
            logger.info("invoice_disabled: skipping invoice for payment_id=%s", payment_id)
            return None

        from sqlalchemy import select

        from app.models.payment import Payment
        from app.models.user import FamilyMember, User

        payment = (
            await self.db.execute(select(Payment).where(Payment.id == payment_id))
        ).scalar_one_or_none()
        if payment is None:
            raise ValueError(f"Payment {payment_id} not found")

        from app.repositories.booking_repository import BookingRepository

        booking = await BookingRepository(self.db).get_by_id(payment.booking_id)
        if booking is None:
            raise ValueError(f"Booking {payment.booking_id} not found")

        user = (
            await self.db.execute(select(User).where(User.id == booking.user_id))
        ).scalar_one_or_none()

        patient_name = user.name if user else None
        patient_dob = user.date_of_birth if user else None
        patient_gender = user.gender if user else None
        patient_ref = str(booking.user_id)
        if booking.patient_id is not None:
            member = (
                await self.db.execute(
                    select(FamilyMember).where(FamilyMember.id == booking.patient_id)
                )
            ).scalar_one_or_none()
            if member is not None:
                patient_name = member.name
                patient_dob = member.date_of_birth
                patient_gender = member.gender
                patient_ref = str(member.id)

        totals = await billing_svc.booking_totals(booking)
        adjustments = await AdjustmentRepository(self.db).list_by_booking(booking.id)

        invoice_number = payment.invoice_number or await self.settings_repo.next_invoice_number(
            billing["invoice_prefix"]
        )
        now = datetime.now(timezone.utc)

        invoice = await self.repo.create(
            invoice_number=invoice_number,
            payment_id=payment.id,
            booking_id=booking.id,
            user_id=booking.user_id,
            subtotal=totals["subtotal"],
            discount_total=totals["discount_total"],
            charge_total=totals["charge_total"],
            gst_rate=totals["gst_percentage"],
            gst_amount=totals["gst_amount"],
            total=totals["total"],
            amount_paid=float(payment.amount),
            payment_method=payment.method,
            company=self._company_snapshot(billing),
            customer={
                "name": user.name if user else None,
                "phone": user.phone if user else None,
                "email": user.email if user else None,
                "patient_name": patient_name,
                "patient_id": patient_ref[:8].upper(),
                "age": _age_on(patient_dob, now.date()),
                "gender": patient_gender,
                "address": await self._address_text(booking),
                "referred_by": None,  # no referral capture in the booking flow yet
                "booking_reference": booking.reference_number,
                "booking_date": str(booking.booking_date),
                "collection_type": booking.collection_type,
                "report_status": "Available" if booking.status == "completed" else "Pending",
            },
            line_items=await self._line_items_snapshot(booking),
            adjustments=[
                {"kind": a.kind, "label": a.label, "amount": float(a.amount)}
                for a in adjustments
            ],
            payment_details={
                "gateway": payment.gateway,
                "method": payment.method,
                "status": payment.status,
                "transaction_id": payment.gateway_payment_id,
                "reference": payment.gateway_order_id,
                "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
            },
            technician=await self._technician_snapshot(booking),
            issued_at=now,
        )

        # Render + store the PDF. Failure to store must never fail the payment —
        # the snapshot row is the source of truth and the PDF can re-render.
        try:
            pdf = self.render_pdf(invoice)
            storage = get_storage_backend()
            key = f"invoices/{invoice.invoice_number}.pdf"
            await storage.upload(pdf, key, "application/pdf")
            await self.repo.set_pdf_storage_key(invoice.id, key)
        except Exception as exc:
            logger.error("invoice_pdf_store_failed: invoice=%s error=%s", invoice.invoice_number, exc)

        logger.info(
            "invoice_issued: number=%s payment_id=%s total=%.2f",
            invoice.invoice_number, payment.id, float(invoice.total),
        )
        return invoice

    # ── snapshot builders ─────────────────────────────────────────────────────

    @staticmethod
    def _company_snapshot(billing: dict) -> dict:
        return {
            "name": billing["company_name"],
            "address": billing["company_address"],
            "phone": billing["company_phone"],
            "email": billing["company_email"],
            "website": billing.get("company_website"),
            "cin": billing.get("company_cin"),
            "nabl_registration_number": billing.get("nabl_registration_number"),
            "iso_certification": billing.get("iso_certification"),
            "gstin": billing["gstin"] if billing["gst_enabled"] else None,
            "footer": billing["invoice_footer"],
            "show_logo": billing["show_logo"],
            "options": {key: billing.get(key, default) for key, default in _OPTION_DEFAULTS.items()},
        }

    async def _address_text(self, booking) -> str | None:  # type: ignore[no-untyped-def]
        if booking.address_id is None:
            return None
        from sqlalchemy import select

        from app.models.user import UserAddress

        address = (
            await self.db.execute(
                select(UserAddress).where(UserAddress.id == booking.address_id)
            )
        ).scalar_one_or_none()
        if address is None:
            return None
        parts = [address.address_line1, address.address_line2, address.city, address.state]
        line = ", ".join(p for p in parts if p)
        return f"{line} – {address.pincode}" if address.pincode else line

    async def _line_items_snapshot(self, booking) -> list[dict]:  # type: ignore[no-untyped-def]
        """One entry per booking item; packages carry their included test names
        and pre-discount price so the invoice can show package contents."""
        from sqlalchemy import select

        from app.models.test import PackageTest, Test

        items = []
        for item in booking.items:
            entry: dict = {"qty": 1, "amount": float(item.unit_price)}
            if item.test is not None:
                entry.update({
                    "label": getattr(item.test, "name", "Test"),
                    "item_type": "test",
                    "sample_type": getattr(item.test, "sample_type", None),
                })
            elif item.package is not None:
                included = (
                    await self.db.execute(
                        select(Test.name)
                        .join(PackageTest, PackageTest.test_id == Test.id)
                        .where(PackageTest.package_id == item.package_id)
                        .order_by(Test.name)
                    )
                ).scalars().all()
                original = float(getattr(item.package, "original_price", 0) or 0)
                entry.update({
                    "label": getattr(item.package, "name", "Package"),
                    "item_type": "package",
                    "sample_type": None,
                    "package_tests": list(included),
                    "package_original_price": original if original > float(item.unit_price) else None,
                })
            else:
                entry.update({"label": "Item", "item_type": "item", "sample_type": None})
            items.append(entry)
        return items

    async def _technician_snapshot(self, booking) -> dict | None:  # type: ignore[no-untyped-def]
        """The assigned home-collection technician, if any."""
        if booking.collection_type != "home":
            return None
        from sqlalchemy import select

        from app.models.service import Technician, TechnicianAssignment

        row = (
            await self.db.execute(
                select(Technician, TechnicianAssignment)
                .join(TechnicianAssignment, TechnicianAssignment.technician_id == Technician.id)
                .where(TechnicianAssignment.booking_id == booking.id)
                .order_by(TechnicianAssignment.assigned_at.desc())
                .limit(1)
            )
        ).first()
        if row is None:
            return None
        technician, assignment = row
        return {
            "name": technician.name,
            "phone": technician.phone,
            "employee_id": str(technician.id)[:8].upper(),
            "assigned_at": assignment.assigned_at.isoformat() if assignment.assigned_at else None,
            "collected_at": booking.collected_at.isoformat() if booking.collected_at else None,
        }

    # ── serve ─────────────────────────────────────────────────────────────────

    async def get_pdf_for_invoice(self, invoice: Invoice) -> bytes:
        """Serve the stored PDF; re-render from the immutable snapshot (and
        re-store) if the stored copy is missing."""
        if invoice.pdf_storage_key:
            data = await get_storage_backend().download(invoice.pdf_storage_key)
            if data:
                return data
        is_cancelled = await self.is_booking_cancelled(invoice.booking_id)
        return await self.regenerate_pdf(invoice, is_cancelled=is_cancelled)

    async def regenerate_pdf(self, invoice: Invoice, is_cancelled: bool = False) -> bytes:
        """Re-render from the immutable snapshot and replace the stored copy.
        The figures cannot change — only the template/layout applied to them
        (e.g. the "CANCELLED" stamp overlaid when the booking is cancelled)."""
        pdf = self.render_pdf(invoice, is_cancelled=is_cancelled)
        try:
            storage = get_storage_backend()
            key = f"invoices/{invoice.invoice_number}.pdf"
            await storage.upload(pdf, key, "application/pdf")
            await self.repo.set_pdf_storage_key(invoice.id, key)
        except Exception as exc:
            logger.warning("invoice_pdf_restore_failed: %s", exc)
        return pdf

    async def regenerate_for_booking(self, booking_id: uuid.UUID, is_cancelled: bool = True) -> None:
        """Re-stamp a booking's invoice PDF after its status changes underneath
        it (currently: cancellation). No-op if the booking was never invoiced —
        e.g. cancelled before payment."""
        invoice = await self.repo.get_by_booking_id(booking_id)
        if invoice is None:
            return
        await self.regenerate_pdf(invoice, is_cancelled=is_cancelled)

    async def is_booking_cancelled(self, booking_id: uuid.UUID) -> bool:
        from app.repositories.booking_repository import BookingRepository

        booking = await BookingRepository(self.db).get_by_id(booking_id)
        return booking is not None and booking.status == "cancelled"

    async def generate_pdf(self, payment_id: uuid.UUID) -> bytes:
        """Invoice PDF for a payment. Prefers the immutable invoice record;
        falls back to a legacy on-the-fly render for payments made before
        persistent invoices existed."""
        invoice = await self.repo.get_by_payment_id(payment_id)
        if invoice is not None:
            return await self.get_pdf_for_invoice(invoice)
        return await self._legacy_generate_pdf(payment_id)

    # ── legacy path (pre-0028 payments with no invoice row) ──────────────────

    async def _legacy_generate_pdf(self, payment_id: uuid.UUID) -> bytes:
        from sqlalchemy import select

        from app.models.payment import Payment
        from app.models.user import User

        result = await self.db.execute(select(Payment).where(Payment.id == payment_id))
        payment = result.scalar_one_or_none()
        if payment is None:
            raise ValueError(f"Payment {payment_id} not found")

        from app.repositories.booking_repository import BookingRepository

        booking = await BookingRepository(self.db).get_by_id(payment.booking_id)
        if booking is None:
            raise ValueError(f"Booking {payment.booking_id} not found")
        result = await self.db.execute(select(User).where(User.id == booking.user_id))
        user = result.scalar_one_or_none()

        billing = await BillingService(self.db).get_settings()
        pseudo = Invoice(
            id=payment.id,
            invoice_number=payment.invoice_number or str(payment.id)[:8].upper(),
            payment_id=payment.id,
            booking_id=booking.id,
            user_id=booking.user_id,
            subtotal=max(float(payment.amount) - float(payment.gst_amount), 0.0),
            discount_total=0,
            charge_total=0,
            gst_rate=billing["gst_percentage"] if billing["gst_enabled"] else 0,
            gst_amount=float(payment.gst_amount),
            total=float(payment.amount),
            amount_paid=float(payment.amount),
            payment_method=payment.method,
            company=self._company_snapshot(billing),
            customer={
                "name": user.name if user else None,
                "phone": user.phone if user else None,
                "email": user.email if user else None,
                "patient_name": user.name if user else None,
                "booking_reference": booking.reference_number,
                "booking_date": str(booking.booking_date),
                "collection_type": booking.collection_type,
            },
            line_items=await self._line_items_snapshot(booking),
            adjustments=[],
            payment_details={
                "gateway": payment.gateway,
                "method": payment.method,
                "status": payment.status,
                "transaction_id": payment.gateway_payment_id,
                "reference": payment.gateway_order_id,
                "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
            },
            technician=None,
            issued_at=payment.paid_at or datetime.now(timezone.utc),
        )
        return self.render_pdf(pseudo, is_cancelled=(booking.status == "cancelled"))

    # ── rendering (snapshot only — never reads live data) ────────────────────

    def render_pdf(self, invoice: Invoice, is_cancelled: bool = False) -> bytes:
        try:
            return _render_reportlab(invoice, is_cancelled=is_cancelled)
        except ImportError:
            logger.warning("reportlab not installed; returning placeholder PDF")
            return _placeholder_pdf(invoice.invoice_number)


# ── amount in words (Indian numbering: crore / lakh / thousand) ──────────────

_ONES = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def _two_digits(n: int) -> str:
    if n < 20:
        return _ONES[n]
    return (_TENS[n // 10] + (" " + _ONES[n % 10] if n % 10 else "")).strip()


def _three_digits(n: int) -> str:
    hundreds, rest = divmod(n, 100)
    if hundreds and rest:
        return f"{_ONES[hundreds]} Hundred and {_two_digits(rest)}"
    if hundreds:
        return f"{_ONES[hundreds]} Hundred"
    return _two_digits(rest)


def amount_in_words(value: float) -> str:
    """'1710.00' → 'One Thousand Seven Hundred and Ten Rupees Only'."""
    rupees = int(value)
    paise = int(round((value - rupees) * 100))
    if paise == 100:
        rupees, paise = rupees + 1, 0

    if rupees == 0:
        words = "Zero"
    else:
        parts = []
        crore, rem = divmod(rupees, 10_000_000)
        lakh, rem = divmod(rem, 100_000)
        thousand, rest = divmod(rem, 1000)
        if crore:
            parts.append(f"{_three_digits(crore)} Crore")
        if lakh:
            parts.append(f"{_two_digits(lakh)} Lakh")
        if thousand:
            parts.append(f"{_two_digits(thousand)} Thousand")
        if rest:
            parts.append(_three_digits(rest))
        words = " ".join(parts)

    result = f"{words} Rupees"
    if paise:
        result += f" and {_two_digits(paise)} Paise"
    return result + " Only"


# ── the PDF template ─────────────────────────────────────────────────────────


def _render_reportlab(invoice: Invoice, is_cancelled: bool = False) -> bytes:
    from reportlab.graphics import renderPDF
    from reportlab.graphics.barcode import code128
    from reportlab.graphics.barcode.qr import QrCodeWidget
    from reportlab.graphics.shapes import Drawing
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.pdfbase.pdfmetrics import stringWidth
    from reportlab.pdfgen import canvas as pdfcanvas
    from reportlab.platypus import (
        BaseDocTemplate,
        Frame,
        KeepTogether,
        PageTemplate,
        Paragraph,
        Spacer,
        Table,
        TableStyle,
    )

    company = invoice.company or {}
    customer = invoice.customer or {}
    payment = invoice.payment_details or {}
    technician = invoice.technician or {}
    options = company.get("options") or {}

    def opt(key: str) -> bool:
        return bool(options.get(key, _OPTION_DEFAULTS[key]))

    precision = int(options.get("decimal_precision", 2))
    symbol = options.get("currency_symbol") or "₹"
    if symbol == "₹":
        symbol = "Rs."  # Helvetica has no rupee glyph; keep the PDF glyph-safe

    def money(value) -> str:  # type: ignore[no-untyped-def]
        return f"{float(value):,.{precision}f}"

    def fmt_date(value, with_time: bool = False) -> str:  # type: ignore[no-untyped-def]
        if value in (None, ""):
            return "—"
        if isinstance(value, str):
            try:
                value = datetime.fromisoformat(value)
            except ValueError:
                return value
        if isinstance(value, datetime):
            # Timestamps stored UTC-aware (issued_at, paid_at, collected_at) must
            # be converted to IST for display; naive values (booking_date) are
            # already lab-local wall-clock per app.utils.timezone's convention.
            if value.tzinfo is not None:
                value = value.astimezone(LAB_TZ)
            return value.strftime("%d-%m-%Y %I:%M %p") if with_time else value.strftime("%d-%m-%Y")
        return value.strftime("%d-%m-%Y")

    black = colors.black
    page_w, page_h = A4
    margin = 14 * mm
    body_w = page_w - 2 * margin

    company_name = company.get("name") or "Sri Health Plus — Diagnostic Laboratory & Health Care"
    is_tax_invoice = bool(company.get("gstin")) and float(invoice.gst_amount or 0) > 0
    title_text = "TAX INVOICE" if is_tax_invoice else "INVOICE"

    contact_bits = []
    if company.get("phone"):
        contact_bits.append(f"Phone: {company['phone']}")
    if company.get("email"):
        contact_bits.append(f"Email: {company['email']}")
    if company.get("website"):
        contact_bits.append(f"{company['website']}")

    # ── letterhead (drawn on every page): logo + name left-aligned, QR
    # right-aligned, closed off by a single rule and the big centred title —
    # the barcode (independently toggleable) prints right-aligned within the
    # title row itself, not the top corner. All vertical offsets below are
    # computed once and reused verbatim by draw_header(), so the precomputed
    # header_height always matches exactly what gets drawn (the body Frame is
    # sized from it).
    border_inset = 8 * mm  # outer page-frame rule, just inside the edge

    show_qr_col = opt("show_qr_code")

    logo_size = 20 * mm
    name_gap = 6 * mm
    x_logo0 = margin
    x_name0 = x_logo0 + logo_size + name_gap

    if show_qr_col:
        col_qr_w = 26 * mm
        x_qr1 = page_w - margin
        x_name1 = x_qr1 - col_qr_w - name_gap
    else:
        x_name1 = page_w - margin
    name_w = x_name1 - x_name0

    # -- brand + subtitle, auto-shrunk to fit the available width --
    name_parts = _split_company_name(company_name)
    brand_line = name_parts[0].upper()
    subtitle_line = name_parts[1]
    brand_font = 19.0
    while brand_font > 11.0 and stringWidth(brand_line, "Helvetica-Bold", brand_font) > name_w:
        brand_font -= 0.5
    subtitle_font = 11.5
    while subtitle_font > 8.0 and stringWidth(subtitle_line, "Helvetica", subtitle_font) > name_w:
        subtitle_font -= 0.5

    # Each entry: (kind, payload, font, size, gap-below).
    name_lines: list[tuple] = [
        ("text", brand_line, "Helvetica-Bold", brand_font, 3.0),
        ("text", subtitle_line, "Helvetica", subtitle_font, 4.0),
        ("text", "Trusted Diagnostic Services", "Helvetica-Oblique", 8.5, 4.0),
    ]

    badge_font = 6.5
    badge_pad_x, badge_pad_y = 3.5, 2.2
    badge_h = badge_font + 2 * badge_pad_y
    badge_row_gap = 3.0

    # Real, admin-entered accreditation only — never fabricated. Nothing
    # prints here unless the lab's actual registration/certification was
    # filled in under Billing Settings.
    accreditation_badges = []
    if company.get("nabl_registration_number"):
        accreditation_badges.append("NABL")
    if company.get("iso_certification"):
        accreditation_badges.append(str(company["iso_certification"]).upper())
    if accreditation_badges:
        name_lines.append(("badges", accreditation_badges, None, badge_h, 4.0))

    reg_bits = []
    if company.get("gstin"):
        reg_bits.append(f"GSTIN: {company['gstin']}")
    if company.get("nabl_registration_number"):
        reg_bits.append(f"NABL Reg. No.: {company['nabl_registration_number']}")
    if reg_bits:
        name_lines.append(("text", "   |   ".join(reg_bits), "Helvetica-Bold", 8.0, 4.0))
    if company.get("address"):
        address_line = " ".join(str(company["address"]).split())
        name_lines.append(("text", address_line, "Helvetica", 8.0, 4.0))
    # Website leads, phone follows directly behind it, email last.
    contact_segments = []
    if company.get("website"):
        contact_segments.append(("globe", company["website"]))
    if company.get("phone"):
        contact_segments.append(("phone", company["phone"]))
    if company.get("email"):
        contact_segments.append(("email", company["email"]))
    if contact_segments:
        name_lines.append(("contact", contact_segments, "Helvetica", 9.0, 0.0))

    def _line_h(spec: tuple) -> float:
        kind, _payload, _font, size, gap = spec
        return (size if kind != "badges" else size) + gap

    name_block_h = max(logo_size, sum(_line_h(s) for s in name_lines))

    # -- scan-to-view QR code, top-right corner --
    # Encodes the public invoice-PDF link, so any camera app opens this exact
    # invoice — invoice.id is a random UUID, unguessable, so it is safe to
    # serve without a login (see the /invoices/public/{id}/pdf route).
    qr_size = 20 * mm
    qr_caption = "Scan for Invoice"
    qr_caption_font = 6.5
    qr_caption_gap = 2.0
    qr_drawing = None
    if opt("show_qr_code"):
        qr_widget = QrCodeWidget(invoice_verify_url(invoice.id))
        qr_widget.barWidth = qr_size
        qr_widget.barHeight = qr_size
        qr_drawing = Drawing(qr_size, qr_size)
        qr_drawing.add(qr_widget)

    qr_block_h = qr_size + qr_caption_gap + qr_caption_font
    right_h = qr_block_h if qr_drawing is not None else 0.0
    row1_h = max(name_block_h, right_h)

    # -- single rule below the letterhead, then the big centred title --
    gap_to_rule = 8.0
    title_pad_top = 10.0
    title_font = 20.0
    title_ascent = title_font * 0.8
    title_pad_bottom = 8.0

    # -- barcode, right-aligned within the title row, invoice number printed
    # below it (sized to never collide with the centred title text) --
    title_bar_height = 9 * mm
    barcode_num_font = 8.0
    barcode_num_gap = 2.0
    barcode_stack_h = title_bar_height + barcode_num_gap + barcode_num_font

    title_barcode = None
    if opt("show_barcode"):
        title_half_w = stringWidth(title_text, "Helvetica-Bold", title_font) / 2
        avail_barcode_w = (page_w - margin) - (page_w / 2 + title_half_w) - 6 * mm
        avail_barcode_w = min(avail_barcode_w, 42 * mm)
        if avail_barcode_w >= 20 * mm:
            bar_width = 0.24 * mm
            title_barcode = code128.Code128(
                invoice.invoice_number, barHeight=title_bar_height, barWidth=bar_width, humanReadable=0
            )
            if title_barcode.width > avail_barcode_w:
                bar_width = max(bar_width * (avail_barcode_w / title_barcode.width), 0.15 * mm)
                title_barcode = code128.Code128(
                    invoice.invoice_number, barHeight=title_bar_height, barWidth=bar_width, humanReadable=0
                )

    title_row_h = title_pad_top + (
        max(title_ascent + title_pad_bottom, barcode_stack_h) if title_barcode is not None
        else title_ascent + title_pad_bottom
    )

    header_height = row1_h + gap_to_rule + title_row_h

    def draw_icon(cv, kind: str, x: float, y_baseline: float, s: float) -> None:  # type: ignore[no-untyped-def]
        """Small monochrome vector glyphs — no image assets needed."""
        cy = y_baseline + s * 0.32
        cv.setLineWidth(0.8)
        if kind == "phone":
            cv.setLineCap(1)
            cv.line(x + s * 0.16, cy - s * 0.26, x + s * 0.84, cy + s * 0.26)
            cv.circle(x + s * 0.16, cy - s * 0.26, s * 0.13, stroke=0, fill=1)
            cv.circle(x + s * 0.84, cy + s * 0.26, s * 0.13, stroke=0, fill=1)
        elif kind == "email":
            w, h = s, s * 0.66
            cv.rect(x, cy - h / 2, w, h, stroke=1, fill=0)
            cv.line(x, cy + h / 2, x + w / 2, cy)
            cv.line(x + w, cy + h / 2, x + w / 2, cy)
        elif kind == "globe":
            r = s * 0.42
            cx = x + r
            cv.circle(cx, cy, r, stroke=1, fill=0)
            cv.line(cx - r, cy, cx + r, cy)
            cv.ellipse(cx - r * 0.42, cy - r, cx + r * 0.42, cy + r, stroke=1, fill=0)

    def draw_contact_line(cv, x0: float, y: float, segments, font: str, size: float) -> None:  # type: ignore[no-untyped-def]
        icon_s = size * 0.95
        icon_gap = 2.0
        item_gap = 9.0
        cv.setFont(font, size)
        x = x0
        for kind, text in segments:
            cv.setFillColor(black)
            draw_icon(cv, kind, x, y, icon_s)
            cv.setFont(font, size)
            cv.drawString(x + icon_s + icon_gap, y, text)
            w = icon_s + icon_gap + cv.stringWidth(text, font, size)
            if kind == "globe":
                # Clickable hyperlink over the website line in the letterhead.
                cv.linkURL(_absolute_url(text), (x, y - 2, x + w, y + size), relative=0, thickness=0)
            x += w + item_gap

    def draw_badge_row(cv, x0: float, y_top: float, labels: list[str]) -> None:  # type: ignore[no-untyped-def]
        cv.setFont("Helvetica-Bold", badge_font)
        y0 = y_top - badge_h
        x = x0
        for text in labels:
            w = cv.stringWidth(text, "Helvetica-Bold", badge_font) + 2 * badge_pad_x
            cv.setLineWidth(0.6)
            cv.rect(x, y0, w, badge_h, stroke=1, fill=0)
            cv.setFillColor(black)
            cv.drawCentredString(x + w / 2, y0 + badge_pad_y + 1, text)
            x += w + badge_row_gap

    def draw_border(cv) -> None:  # type: ignore[no-untyped-def]
        cv.setLineWidth(1.0)
        cv.setStrokeColor(black)
        cv.rect(
            border_inset, border_inset,
            page_w - 2 * border_inset, page_h - 2 * border_inset,
            stroke=1, fill=0,
        )

    def draw_header(cv) -> None:  # type: ignore[no-untyped-def]
        y_top = page_h - margin
        cv.setFillColor(black)

        # left: logo
        if company.get("show_logo", True) and _LOGO_PATH.exists():
            cv.drawImage(
                str(_LOGO_PATH), x_logo0, y_top - logo_size,
                width=logo_size, height=logo_size, mask="auto", preserveAspectRatio=True,
            )

        # name block: brand, subtitle, tagline, badges, identity, contact
        cy = y_top
        for kind, payload, font, size, gap in name_lines:
            if kind == "text":
                cy -= size
                cv.setFont(font, size)
                cv.setFillColor(black)
                cv.drawString(x_name0, cy, payload)
                cy -= gap
            elif kind == "badges":
                draw_badge_row(cv, x_name0, cy, payload)
                cy -= size
                cy -= gap
            elif kind == "contact":
                cy -= size
                draw_contact_line(cv, x_name0, cy, payload, font, size)
                cy -= gap

        # right: QR code, top-right corner (barcode, if on, prints in the
        # title row below instead — see the title-row block)
        if show_qr_col and qr_drawing is not None:
            qr_top = y_top - (row1_h - qr_block_h) / 2
            ry = qr_top - qr_size
            renderPDF.draw(qr_drawing, cv, x_qr1 - qr_size, ry)
            ry -= qr_caption_gap
            ry -= qr_caption_font
            cv.setFont("Helvetica-Oblique", qr_caption_font)
            cv.setFillColor(black)
            cv.drawCentredString(x_qr1 - qr_size / 2, ry, qr_caption)

        # single rule below the letterhead, then the big centred title, with
        # the barcode (if enabled) right-aligned in that same row
        row_bottom = y_top - row1_h
        rule_y = row_bottom - gap_to_rule
        cv.setLineWidth(0.8)
        cv.line(margin, rule_y, page_w - margin, rule_y)

        title_baseline = rule_y - title_pad_top - title_ascent
        cv.setFont("Helvetica-Bold", title_font)
        cv.setFillColor(black)
        cv.drawCentredString(page_w / 2, title_baseline, title_text)

        if title_barcode is not None:
            barcode_top = rule_y - title_pad_top
            barcode_x = (page_w - margin) - title_barcode.width
            barcode_y = barcode_top - title_bar_height
            title_barcode.drawOn(cv, barcode_x, barcode_y)

            num_y = barcode_y - barcode_num_gap - barcode_num_font
            cv.setFont("Helvetica-Bold", barcode_num_font)
            cv.setFillColor(black)
            cv.drawCentredString(barcode_x + title_barcode.width / 2, num_y, invoice.invoice_number)

    footer_lines: list[tuple[str, str, float]] = []
    if company.get("footer"):
        footer_lines.append((" ".join(str(company["footer"]).split()), "Helvetica", 7))
    footer_lines.append((f"Thank you for choosing {company_name}.", "Helvetica-Bold", 7.5))
    if contact_bits:
        footer_lines.append(("For appointments:   " + "   |   ".join(contact_bits), "Helvetica", 7))
    footer_lines.append(
        ("This is a Computer Generated Invoice — No Signature Required.", "Helvetica-Oblique", 7)
    )
    footer_height = sum(size + 3 for _, _, size in footer_lines) + 14

    def draw_footer(cv, page_num: int, page_count: int) -> None:  # type: ignore[no-untyped-def]
        y = margin + footer_height - 8
        cv.setLineWidth(0.6)
        cv.line(margin, y, page_w - margin, y)
        y -= 4
        for text, font, size in footer_lines:
            y -= size
            cv.setFont(font, size)
            cv.drawCentredString(page_w / 2, y, text)
            y -= 3
        cv.setFont("Helvetica", 7)
        cv.drawRightString(page_w - margin, margin - 4, f"Page {page_num} of {page_count}")
        cv.drawString(margin, margin - 4, f"Invoice {invoice.invoice_number}")

    def draw_watermark(cv) -> None:  # type: ignore[no-untyped-def]
        """Rubber-stamp style 'CANCELLED' seal over the top-right corner of
        the letterhead — that corner is empty by default (the QR code is an
        opt-in layout option), so the stamp reads clearly without covering
        the invoice number, dates or figures underneath."""
        stamp_text = "CANCELLED"
        stamp_font = 16.0
        pad_x, pad_y = 8.0, 5.5
        text_w = stringWidth(stamp_text, "Helvetica-Bold", stamp_font)
        box_w = text_w + 2 * pad_x
        box_h = stamp_font + 2 * pad_y

        stamp_cx = page_w - margin - 32 * mm
        stamp_cy = (page_h - margin) - row1_h / 2

        cv.saveState()
        cv.translate(stamp_cx, stamp_cy)
        cv.rotate(-18)
        stamp_color = colors.Color(0.75, 0.05, 0.05, alpha=0.75)
        cv.setFillColor(stamp_color)
        cv.setStrokeColor(stamp_color)
        cv.setLineWidth(1.6)
        cv.roundRect(-box_w / 2, -box_h / 2, box_w, box_h, 3, stroke=1, fill=0)
        cv.setLineWidth(0.6)
        cv.roundRect(-box_w / 2 + 2.5, -box_h / 2 + 2.5, box_w - 5, box_h - 5, 2, stroke=1, fill=0)
        cv.setFont("Helvetica-Bold", stamp_font)
        cv.drawCentredString(0, -stamp_font * 0.32, stamp_text)
        cv.restoreState()

    class InvoiceCanvas(pdfcanvas.Canvas):
        """Two-pass canvas so the footer can print 'Page X of Y'."""

        def __init__(self, *args, **kwargs):  # type: ignore[no-untyped-def]
            super().__init__(*args, **kwargs)
            self._saved_states: list[dict] = []

        def showPage(self):  # type: ignore[no-untyped-def]
            self._saved_states.append(dict(self.__dict__))
            self._startPage()

        def save(self):  # type: ignore[no-untyped-def]
            count = len(self._saved_states)
            for state in self._saved_states:
                self.__dict__.update(state)
                draw_border(self)
                draw_header(self)
                draw_footer(self, self._pageNumber, count)
                if is_cancelled:
                    draw_watermark(self)
                super().showPage()
            super().save()

    # ── styles ────────────────────────────────────────────────────────────────
    base = ParagraphStyle("base", fontName="Helvetica", fontSize=8.5, leading=11, textColor=black)
    bold = ParagraphStyle("bold", parent=base, fontName="Helvetica-Bold")
    small = ParagraphStyle("small", parent=base, fontSize=7.5, leading=9.5)
    right = ParagraphStyle("right", parent=base, alignment=TA_RIGHT)
    right_bold = ParagraphStyle("right_bold", parent=bold, alignment=TA_RIGHT)
    center = ParagraphStyle("center", parent=base, alignment=TA_CENTER)
    section = ParagraphStyle(
        "section", parent=base, fontName="Helvetica-Bold", fontSize=8.5, spaceBefore=0, spaceAfter=0
    )

    thin_box = TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.8, black),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ])

    def label_value(label: str, value, style: ParagraphStyle = base) -> Paragraph:  # type: ignore[no-untyped-def]
        display = "—" if value in (None, "") else str(value)
        return Paragraph(f"<b>{label}</b> : {display}", style)

    def section_bar(text: str) -> Table:
        bar = Table([[Paragraph(text.upper(), section)]], colWidths=[body_w])
        bar.setStyle(TableStyle([
            ("LINEBELOW", (0, 0), (-1, -1), 0.8, black),
            ("LINEABOVE", (0, 0), (-1, -1), 0.8, black),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#EFEFEF")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ]))
        return bar

    story: list = [Spacer(1, 2 * mm)]

    # ── invoice / booking meta ────────────────────────────────────────────────
    collection = {"home": "Home Collection", "lab": "Lab Visit"}.get(
        (customer.get("collection_type") or "").lower(), customer.get("collection_type") or "—"
    )
    payment_status = (payment.get("status") or "paid").upper()
    meta_style = ParagraphStyle("meta", parent=base, fontSize=8.0, leading=10.0)
    meta_rows = [
        [label_value("Invoice No", invoice.invoice_number, meta_style),
         label_value("Invoice Date", fmt_date(invoice.issued_at, with_time=True), meta_style),
         label_value("Booking No", customer.get("booking_reference"), meta_style),
         label_value("Status", payment_status, meta_style)],
        [label_value("Booking Date", fmt_date(customer.get("booking_date")), meta_style),
         label_value("Registration No", customer.get("patient_id"), meta_style),
         label_value("Sample Collection", collection, meta_style),
         label_value("Payment Status", payment_status, meta_style)],
    ]
    meta = Table(meta_rows, colWidths=[body_w * 0.25] * 4)
    meta.setStyle(thin_box)
    story.append(meta)
    story.append(Spacer(1, 3 * mm))

    # ── patient information ───────────────────────────────────────────────────
    age = customer.get("age")
    gender = (customer.get("gender") or "")[:1].upper()
    age_sex = " / ".join(filter(None, [f"{age} Yrs" if age is not None else None, gender or None])) or None

    patient_rows = [
        [label_value("Patient Name", customer.get("patient_name") or customer.get("name")),
         label_value("Age / Sex", age_sex)],
        [label_value("Mobile No", customer.get("phone")),
         label_value("Email", customer.get("email"))],
    ]
    patient_rows.append([label_value("Patient ID", customer.get("patient_id")), Paragraph("", base)])
    if opt("show_patient_address") and customer.get("address"):
        patient_rows.append([label_value("Address", customer.get("address")), Paragraph("", base)])

    patient_box = Table(patient_rows, colWidths=[body_w * 0.5, body_w * 0.5])
    patient_box.setStyle(thin_box)
    story.append(KeepTogether([section_bar("Patient Information"), patient_box]))
    story.append(Spacer(1, 3 * mm))

    # ── test / package details table ─────────────────────────────────────────
    items = invoice.line_items or []
    story.append(section_bar("Test Details"))
    # The column-head row repeats when the table splits across pages (so
    # page 1 is never left half-empty by a long list, unlike a KeepTogether
    # around the whole table).
    head = [
        Paragraph("<b>SN</b>", center),
        Paragraph("<b>Test / Package Description</b>", base),
        Paragraph("<b>Sample</b>", base),
        Paragraph("<b>Qty</b>", right),
        Paragraph(f"<b>Rate ({symbol})</b>", right),
        Paragraph(f"<b>Amount ({symbol})</b>", right),
    ]
    item_rows: list[list] = [head]
    for idx, item in enumerate(items, start=1):
        desc: list = [Paragraph(str(item.get("label") or "Item"), bold)]
        if item.get("item_type") == "package":
            if item.get("package_original_price"):
                saved = float(item["package_original_price"]) - float(item.get("amount", 0))
                desc.append(Paragraph(
                    f"Health Package — MRP {symbol} {money(item['package_original_price'])}"
                    f" (package discount {symbol} {money(saved)})", small))
            included = item.get("package_tests") or []
            if included:
                desc.append(Paragraph("Includes: " + ", ".join(included), small))
        qty = int(item.get("qty") or 1)
        amount = float(item.get("amount") or 0)
        item_rows.append([
            Paragraph(str(idx), center),
            desc,
            Paragraph(str(item.get("sample_type") or "—"), base),
            Paragraph(str(qty), right),
            Paragraph(money(amount / qty if qty else amount), right),
            Paragraph(money(amount), right),
        ])

    items_table = Table(
        item_rows,
        colWidths=[
            body_w * 0.06, body_w * 0.46, body_w * 0.13,
            body_w * 0.07, body_w * 0.14, body_w * 0.14,
        ],
        repeatRows=1,
    )
    items_table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, black),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EFEFEF")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 3 * mm))

    # ── price summary (right-aligned) ─────────────────────────────────────────
    summary_rows: list[tuple[str, str, bool]] = [("Subtotal", money(invoice.subtotal), False)]
    for adj in invoice.adjustments or []:
        amount = money(adj.get("amount", 0))
        if adj.get("kind") == "discount":
            summary_rows.append((f"Less: {adj.get('label', 'Discount')}", f"(−) {amount}", False))
        else:
            summary_rows.append((f"Add: {adj.get('label', 'Charge')}", f"(+) {amount}", False))
    if float(invoice.gst_amount or 0) or float(invoice.gst_rate or 0):
        if float(invoice.discount_total or 0) or float(invoice.charge_total or 0):
            taxable = float(invoice.subtotal) - float(invoice.discount_total) + float(invoice.charge_total)
            summary_rows.append(("Taxable Amount", money(max(taxable, 0)), False))
        summary_rows.append((f"GST @ {float(invoice.gst_rate):g}%", money(invoice.gst_amount), False))
    summary_rows.append((f"Grand Total ({symbol})", money(invoice.total), True))
    summary_rows.append(("Amount Paid", money(invoice.amount_paid), False))
    balance = float(invoice.total) - float(invoice.amount_paid)
    if abs(balance) >= 0.01:
        summary_rows.append(("Balance Due" if balance > 0 else "Refundable", money(abs(balance)), True))

    summary_cells = [
        [Paragraph(f"<b>{label}</b>" if strong else label, right),
         Paragraph(f"<b>{value}</b>" if strong else value, right)]
        for label, value, strong in summary_rows
    ]
    summary_inner = Table(summary_cells, colWidths=[42 * mm, 32 * mm])
    grand_row = next(i for i, (label, _, _) in enumerate(summary_rows) if label.startswith("Grand Total"))
    summary_inner.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 1.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
        ("LINEABOVE", (0, grand_row), (-1, grand_row), 0.8, black),
        ("LINEBELOW", (0, grand_row), (-1, grand_row), 0.8, black),
    ]))

    words_box = Table(
        [[Paragraph(f"<b>Amount in Words</b> : {amount_in_words(float(invoice.total))}", base)]],
        colWidths=[body_w * 0.55],
    )
    words_box.setStyle(thin_box)

    summary_row = Table(
        [[words_box, summary_inner]],
        colWidths=[body_w * 0.57, body_w * 0.43],
    )
    summary_row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(KeepTogether([summary_row]))
    story.append(Spacer(1, 3 * mm))

    # ── technician details ────────────────────────────────────────────────────
    if opt("show_technician") and technician:
        tech_rows = [
            [label_value("Technician Name", technician.get("name")),
             label_value("Employee ID", technician.get("employee_id"))],
            [label_value("Contact", technician.get("phone")),
             label_value("Collection Date / Time", fmt_date(technician.get("collected_at"), with_time=True))],
            [label_value("Signature", "________________________"), Paragraph("", base)],
        ]
        tech_table = Table(tech_rows, colWidths=[body_w * 0.5, body_w * 0.5])
        tech_table.setStyle(thin_box)
        story.append(KeepTogether([section_bar("Home Collection — Technician Details"), tech_table]))
        story.append(Spacer(1, 3 * mm))

    if opt("show_report_info"):
        report_rows = [
            [label_value("Report Status", customer.get("report_status") or "Pending"),
             label_value("Generated Date", None)],
            [label_value("Verified By", None),
             label_value("Authorized Pathologist", "________________________")],
        ]
        report_table = Table(report_rows, colWidths=[body_w * 0.5, body_w * 0.5])
        report_table.setStyle(thin_box)
        story.append(KeepTogether([section_bar("Report Information"), report_table]))
        story.append(Spacer(1, 3 * mm))

    if opt("show_signature"):
        signature = Table(
            [[Paragraph("E. & O. E.", small),
              [Paragraph(f"For {company_name}", right_bold),
               Spacer(1, 12 * mm),
               Paragraph("Authorised Signatory", right)]]],
            colWidths=[body_w * 0.5, body_w * 0.5],
        )
        signature.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(KeepTogether([signature]))

    # ── important notice ──────────────────────────────────────────────────────
    notice_title = ParagraphStyle(
        "notice_title", parent=small, fontName="Helvetica-Bold", fontSize=7.5, textColor=black,
    )
    notice_body = ParagraphStyle("notice_body", parent=small, fontSize=7, textColor=black)
    notice_box = Table(
        [[Paragraph("Important Notice", notice_title)],
         [Paragraph(
             "This invoice will be available for download for 45 days from the invoice date. "
             "After this period, it will be permanently removed from our servers and cannot be "
             "regenerated. Please download and store this invoice safely for your future reference.",
             notice_body,
         )]],
        colWidths=[body_w],
    )
    notice_box.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.6, black),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F5F5F5")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (0, 0), 1),
        ("BOTTOMPADDING", (0, 1), (0, 1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(Spacer(1, 4 * mm))
    story.append(KeepTogether([notice_box]))

    # ── build ─────────────────────────────────────────────────────────────────
    buf = io.BytesIO()
    doc = BaseDocTemplate(
        buf,
        pagesize=A4,
        title=f"Invoice {invoice.invoice_number}",
        author=company_name,
        leftMargin=margin, rightMargin=margin, topMargin=margin, bottomMargin=margin,
    )
    frame = Frame(
        margin,
        margin + footer_height,
        body_w,
        page_h - 2 * margin - header_height - footer_height,
        leftPadding=0, rightPadding=0, topPadding=4, bottomPadding=4,
        id="body",
    )
    doc.addPageTemplates([PageTemplate(id="invoice", frames=[frame])])
    doc.build(story, canvasmaker=InvoiceCanvas)
    return buf.getvalue()


def _placeholder_pdf(invoice_number: str) -> bytes:
    """Minimal PDF without reportlab (for environments where it's not installed)."""
    content = f"BT /F1 12 Tf 100 700 Td (Invoice {invoice_number}) Tj ET"
    lines = [
        "%PDF-1.4",
        "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
        "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
        "3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Contents 4 0 R/Resources<<>>>>endobj",
        f"4 0 obj<</Length {len(content)}>>stream\n{content}\nendstream\nendobj",
        "xref\n0 5",
        "trailer<</Size 5/Root 1 0 R>>",
        "startxref\n0",
        "%%EOF",
    ]
    return "\n".join(lines).encode()
