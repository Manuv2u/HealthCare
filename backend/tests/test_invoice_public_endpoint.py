"""Public (unauthenticated) invoice PDF endpoint.

This is what the letterhead QR code links to — scanning it must open the
invoice without requiring a login. Exercised at the router-function level
(rather than a full ASGI+auth-middleware round trip, which this test suite
does not otherwise set up) so it stays independent of the DB/dependency
plumbing while still proving the endpoint's actual control flow: no auth
dependency, 404 on an unknown id, inline PDF response on a known one.
"""
from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from app.api.v1.invoices import get_public_invoice_pdf


class TestPublicInvoicePdf:
    @pytest.mark.asyncio
    async def test_returns_inline_pdf_for_a_known_invoice_with_no_auth_dependency(self):
        invoice = SimpleNamespace(id=uuid.uuid4(), invoice_number="INV-2026-000099")
        fake_repo = AsyncMock()
        fake_repo.get_by_id.return_value = invoice
        fake_service = AsyncMock()
        fake_service.get_pdf_for_invoice.return_value = b"%PDF-1.4 fake invoice bytes"

        with patch("app.api.v1.invoices.InvoiceRepository", return_value=fake_repo), \
             patch("app.api.v1.invoices.InvoiceService", return_value=fake_service):
            response = await get_public_invoice_pdf(invoice_id=invoice.id, db=AsyncMock())

        assert response.media_type == "application/pdf"
        assert response.body == b"%PDF-1.4 fake invoice bytes"
        assert response.headers["content-disposition"] == (
            'inline; filename="INV-2026-000099.pdf"'
        )
        fake_repo.get_by_id.assert_awaited_once_with(invoice.id)

    @pytest.mark.asyncio
    async def test_unknown_invoice_id_returns_404_not_a_leak(self):
        fake_repo = AsyncMock()
        fake_repo.get_by_id.return_value = None

        with patch("app.api.v1.invoices.InvoiceRepository", return_value=fake_repo):
            with pytest.raises(HTTPException) as exc_info:
                await get_public_invoice_pdf(invoice_id=uuid.uuid4(), db=AsyncMock())

        assert exc_info.value.status_code == 404
        assert exc_info.value.detail["error_code"] == "INVOICE_NOT_FOUND"

    def test_route_requires_no_auth_dependency(self):
        """Guards against a future refactor accidentally adding `require_roles`
        (or any Depends) to this route — that would break QR scans from a
        phone that isn't logged in."""
        import inspect

        sig = inspect.signature(get_public_invoice_pdf)
        assert list(sig.parameters) == ["invoice_id", "db"]
