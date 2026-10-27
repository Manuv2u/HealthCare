"""Invoice QR code (scan-to-view) and letterhead website hyperlink.

Covers the two additions from the QR-code feature:
  - the letterhead prints a QR code (linking to the public invoice PDF) and
    grows the header to fit it, only when `show_qr_code` is enabled;
  - the letterhead website line is a clickable hyperlink.

Rendering is pure attribute-access over an Invoice instance (never touches
the DB — see InvoiceService.render_pdf), so these instantiate Invoice
directly without persisting it.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest

from app.models.billing import Invoice
from app.services.invoice_service import _OPTION_DEFAULTS, InvoiceService, invoice_verify_url


def _make_invoice(**option_overrides) -> Invoice:
    return Invoice(
        id=uuid.uuid4(),
        invoice_number="INV-2026-000099",
        payment_id=uuid.uuid4(),
        booking_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        subtotal=500.0,
        discount_total=0,
        charge_total=0,
        gst_rate=18.0,
        gst_amount=90.0,
        total=590.0,
        amount_paid=590.0,
        payment_method="upi",
        company={
            "name": "SRI HEALTH PLUS",
            "website": "srihealthplus.com",
            "show_logo": True,
            "options": {**_OPTION_DEFAULTS, **option_overrides},
        },
        customer={"name": "Test Patient", "collection_type": "lab"},
        line_items=[{"label": "CBC", "item_type": "test", "qty": 1, "amount": 500.0}],
        adjustments=[],
        payment_details={},
        technician=None,
        issued_at=datetime.now(timezone.utc),
    )


class TestQrCodeDefault:
    def test_show_qr_code_defaults_off(self):
        """Existing installs/invoices must render unchanged unless an admin
        opts in — the toggle defaults to False."""
        assert _OPTION_DEFAULTS["show_qr_code"] is False


class TestInvoiceVerifyUrl:
    def test_encodes_the_public_pdf_route_for_this_invoice_id(self):
        invoice_id = uuid.uuid4()
        url = invoice_verify_url(invoice_id)
        assert url.endswith(f"/api/v1/invoices/public/{invoice_id}/pdf")
        assert url.startswith("http")


class TestQrCodeRendering:
    def test_renders_without_qr_by_default(self):
        pdf = InvoiceService.__new__(InvoiceService).render_pdf(_make_invoice())
        assert pdf.startswith(b"%PDF")

    def test_renders_with_qr_when_enabled(self):
        """The header must grow to fit the QR and still produce a valid PDF —
        this is the exact opt-in path an admin flips on in Billing Settings."""
        pdf = InvoiceService.__new__(InvoiceService).render_pdf(
            _make_invoice(show_qr_code=True)
        )
        assert pdf.startswith(b"%PDF")

    def test_qr_render_is_larger_than_without(self):
        """Sanity check that enabling the QR actually adds content to the PDF,
        rather than silently no-op'ing."""
        without = InvoiceService.__new__(InvoiceService).render_pdf(_make_invoice())
        with_qr = InvoiceService.__new__(InvoiceService).render_pdf(
            _make_invoice(show_qr_code=True)
        )
        assert len(with_qr) > len(without)


class TestWebsiteHyperlink:
    def test_website_link_annotation_present_and_absolute(self):
        """A PDF URI-action annotation embeds `/URI (<url>)` as plain (non
        compressed) PDF object syntax, so a raw byte search is a reliable,
        dependency-free way to confirm the hyperlink was created."""
        pdf = InvoiceService.__new__(InvoiceService).render_pdf(_make_invoice())
        assert b"/URI (https://srihealthplus.com)" in pdf

    def test_bare_domain_gets_https_scheme(self):
        """Admins type the website without a scheme (e.g. "srihealthplus.com");
        the PDF link must still be an absolute, clickable URL."""
        pdf = InvoiceService.__new__(InvoiceService).render_pdf(_make_invoice())
        assert b"/URI (srihealthplus.com)" not in pdf
