"""Invoices router — immutable invoice records: search, metadata, PDF,
regeneration (re-render of the stored snapshot) and email delivery."""
from __future__ import annotations

import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.middleware.auth import require_roles
from app.repositories.billing_repository import InvoiceRepository
from app.schemas.invoices import InvoiceListOut, InvoiceOut
from app.services.invoice_service import InvoiceService

router = APIRouter(prefix="/invoices", tags=["invoices"])


def _to_out(invoice) -> InvoiceOut:  # type: ignore[no-untyped-def]
    data = InvoiceOut.model_validate(invoice)
    data.has_pdf = bool(invoice.pdf_storage_key)
    return data


@router.get("", response_model=InvoiceListOut)
async def search_invoices(
    q: Optional[str] = Query(default=None, description="Invoice number, payment id or booking id"),
    booking_id: Optional[uuid.UUID] = None,
    user_id: Optional[uuid.UUID] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> InvoiceListOut:
    """Admin invoice search. Free-text `q` matches invoice number and exact
    payment/booking ids; use the filters for patient or date-range views."""
    repo = InvoiceRepository(db)
    items, total = await repo.search(
        query=q, booking_id=booking_id, user_id=user_id,
        date_from=date_from, date_to=date_to, page=page, page_size=page_size,
    )
    return InvoiceListOut(
        items=[_to_out(i) for i in items], total=total, page=page, page_size=page_size,
    )


@router.get("/mine", response_model=InvoiceListOut)
async def my_invoices(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(require_roles("user", "admin")),
    db: AsyncSession = Depends(get_db_session),
) -> InvoiceListOut:
    """The authenticated patient's own invoices."""
    repo = InvoiceRepository(db)
    items, total = await repo.search(
        user_id=uuid.UUID(current_user["user_id"]), page=page, page_size=page_size,
    )
    return InvoiceListOut(
        items=[_to_out(i) for i in items], total=total, page=page, page_size=page_size,
    )


@router.get("/public/{invoice_id}/pdf")
async def get_public_invoice_pdf(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    """Unauthenticated invoice view — this is what the letterhead QR code
    links to, so scanning it opens the invoice on any phone. Safe without a
    login because `invoice_id` is a random UUID (the primary key), not the
    sequential, guessable invoice number: only someone who already holds the
    printed invoice (or its link) can reach this."""
    invoice = await InvoiceRepository(db).get_by_id(invoice_id)
    if invoice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "INVOICE_NOT_FOUND", "message": "Invoice not found"},
        )
    pdf = await InvoiceService(db).get_pdf_for_invoice(invoice)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{invoice.invoice_number}.pdf"'},
    )


@router.get("/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(
    invoice_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin", "user")),
    db: AsyncSession = Depends(get_db_session),
) -> InvoiceOut:
    invoice = await _get_checked(invoice_id, current_user, db)
    return _to_out(invoice)


@router.get("/{invoice_id}/pdf")
async def get_invoice_pdf(
    invoice_id: uuid.UUID,
    download: bool = Query(default=False),
    current_user: dict = Depends(require_roles("admin", "user")),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    """The invoice PDF — inline for the viewer/print, attachment for download."""
    invoice = await _get_checked(invoice_id, current_user, db)
    pdf = await InvoiceService(db).get_pdf_for_invoice(invoice)
    disposition = "attachment" if download else "inline"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{invoice.invoice_number}.pdf"'
        },
    )


@router.post("/{invoice_id}/regenerate-pdf")
async def regenerate_invoice_pdf(
    invoice_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    """Re-render the PDF from the immutable snapshot and replace the stored
    copy — for template updates or corrupted files. Figures never change."""
    invoice = await _get_checked(invoice_id, current_user, db)
    service = InvoiceService(db)
    is_cancelled = await service.is_booking_cancelled(invoice.booking_id)
    pdf = await service.regenerate_pdf(invoice, is_cancelled=is_cancelled)
    await db.commit()
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{invoice.invoice_number}.pdf"'},
    )


class EmailInvoiceIn(BaseModel):
    # Defaults to the email on the invoice snapshot when omitted.
    email: Optional[str] = Field(default=None, max_length=200, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class EmailInvoiceOut(BaseModel):
    sent: bool
    email: str


@router.post("/{invoice_id}/email", response_model=EmailInvoiceOut)
async def email_invoice(
    invoice_id: uuid.UUID,
    body: EmailInvoiceIn,
    current_user: dict = Depends(require_roles("admin", "user")),
    db: AsyncSession = Depends(get_db_session),
) -> EmailInvoiceOut:
    """Send the invoice PDF as an email attachment. Admins may override the
    recipient; patients always receive it at their own registered email."""
    invoice = await _get_checked(invoice_id, current_user, db)
    customer = invoice.customer or {}
    to_email = customer.get("email")
    if current_user["role"] == "admin" and body.email:
        to_email = str(body.email)
    if not to_email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error_code": "NO_EMAIL", "message": "No email address on this invoice"},
        )

    from app.services.notification_providers import get_email_client

    pdf = await InvoiceService(db).get_pdf_for_invoice(invoice)
    company = (invoice.company or {}).get("name") or "Sri Health Plus"
    patient = customer.get("patient_name") or customer.get("name") or "Patient"
    sent = await get_email_client().send(
        to_email,
        f"Invoice {invoice.invoice_number} — {company}",
        (
            f"<p>Dear {patient},</p>"
            f"<p>Please find attached your invoice <b>{invoice.invoice_number}</b> "
            f"for booking <b>{customer.get('booking_reference') or invoice.booking_id}</b>.</p>"
            f"<p>Thank you for choosing {company}.</p>"
        ),
        attachments=[(f"{invoice.invoice_number}.pdf", pdf, "pdf")],
    )
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error_code": "EMAIL_FAILED", "message": "Failed to send invoice email"},
        )
    return EmailInvoiceOut(sent=True, email=to_email)


async def _get_checked(invoice_id: uuid.UUID, current_user: dict, db: AsyncSession):  # type: ignore[no-untyped-def]
    repo = InvoiceRepository(db)
    invoice = await repo.get_by_id(invoice_id)
    if invoice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "INVOICE_NOT_FOUND", "message": "Invoice not found"},
        )
    if current_user["role"] != "admin" and str(invoice.user_id) != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error_code": "FORBIDDEN", "message": "Access denied"},
        )
    return invoice
