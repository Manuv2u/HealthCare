"""BillingService — the single source of truth for money math.

Every amount a user sees (checkout summary, payment order, cancellation quote,
invoice) is computed here, server-side. The frontend only displays what these
functions return; it never computes GST, discounts or totals itself.
"""
from __future__ import annotations

import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings as env_settings
from app.repositories.billing_repository import AdjustmentRepository, BillingSettingsRepository

logger = logging.getLogger("sri.billing")

# Invoice layout defaults used when the seeded settings row is missing.
_DEFAULT_INVOICE_OPTIONS = {
    "show_barcode": True,
    "show_doctor": True,
    "show_technician": True,
    "show_patient_address": True,
    "show_signature": True,
    "show_report_info": False,
    "show_qr_code": False,
    "currency_symbol": "₹",
    "decimal_precision": 2,
    "company_website": None,
    "company_cin": None,
    "nabl_registration_number": None,
    "iso_certification": None,
}


def _round2(value: float) -> float:
    return round(value + 1e-9, 2)


class BillingService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.settings_repo = BillingSettingsRepository(db)
        self.adjustment_repo = AdjustmentRepository(db)

    # ── settings ──────────────────────────────────────────────────────────────

    async def get_settings(self) -> dict:
        """Active billing settings, falling back to historical env defaults if
        the seeded row is somehow missing."""
        row = await self.settings_repo.get_active()
        if row is None:
            return {
                "invoice_enabled": True,
                "invoice_prefix": "INV",
                "gst_enabled": True,
                "gst_percentage": env_settings.gst_rate * 100,
                "gstin": None,
                "company_name": "Sri Health Plus — Diagnostic Laboratory & Health Care",
                "company_address": None,
                "company_phone": None,
                "company_email": None,
                "invoice_footer": None,
                "show_logo": True,
                "refund_eta_text": "5–7 working days",
                **_DEFAULT_INVOICE_OPTIONS,
            }
        return {
            "invoice_enabled": row.invoice_enabled,
            "invoice_prefix": row.invoice_prefix,
            "gst_enabled": row.gst_enabled,
            "gst_percentage": float(row.gst_percentage),
            "gstin": row.gstin,
            "company_name": row.company_name,
            "company_address": row.company_address,
            "company_phone": row.company_phone,
            "company_email": row.company_email,
            "invoice_footer": row.invoice_footer,
            "show_logo": row.show_logo,
            "refund_eta_text": row.refund_eta_text,
            "show_barcode": row.show_barcode,
            "show_doctor": row.show_doctor,
            "show_technician": row.show_technician,
            "show_patient_address": row.show_patient_address,
            "show_signature": row.show_signature,
            "show_report_info": row.show_report_info,
            "show_qr_code": row.show_qr_code,
            "currency_symbol": row.currency_symbol,
            "decimal_precision": int(row.decimal_precision),
            "company_website": row.company_website,
            "company_cin": row.company_cin,
            "nabl_registration_number": row.nabl_registration_number,
            "iso_certification": row.iso_certification,
        }

    # ── totals engine ─────────────────────────────────────────────────────────

    async def compute_totals(
        self,
        item_prices: list[float],
        adjustments: list[dict] | None = None,
    ) -> dict:
        """Core money math. `adjustments` entries: {kind, label, amount}."""
        billing = await self.get_settings()
        adjustments = adjustments or []

        subtotal = _round2(sum(item_prices))
        discount_total = _round2(
            sum(float(a["amount"]) for a in adjustments if a["kind"] == "discount")
        )
        charge_total = _round2(
            sum(float(a["amount"]) for a in adjustments if a["kind"] == "charge")
        )
        taxable_amount = max(_round2(subtotal - discount_total + charge_total), 0.0)

        gst_percentage = float(billing["gst_percentage"]) if billing["gst_enabled"] else 0.0
        gst_amount = _round2(taxable_amount * gst_percentage / 100)
        total = _round2(taxable_amount + gst_amount)

        return {
            "subtotal": subtotal,
            "discount_total": discount_total,
            "charge_total": charge_total,
            "taxable_amount": taxable_amount,
            "gst_enabled": bool(billing["gst_enabled"]),
            "gst_percentage": gst_percentage,
            "gst_amount": gst_amount,
            "total": total,
            "adjustments": [
                {"kind": a["kind"], "label": a["label"], "amount": _round2(float(a["amount"]))}
                for a in adjustments
            ],
            "refund_eta_text": billing["refund_eta_text"],
        }

    async def quote_items(
        self,
        test_ids: list[uuid.UUID],
        package_ids: list[uuid.UUID],
        coupon_code: str | None = None,
        user_id: uuid.UUID | None = None,
    ) -> dict:
        """Pre-booking checkout quote: prices resolved server-side from the
        catalog, using the same effective-price rules as booking creation. A
        coupon_code is only ever applied when the caller explicitly supplies
        one — nothing auto-applies. See CouponService for validation."""
        from app.repositories.package_repository import PackageRepository
        from app.repositories.test_repository import TestRepository
        from app.services.coupon_service import CouponService

        test_repo = TestRepository(self.db)
        package_repo = PackageRepository(self.db)

        prices: list[float] = []
        package_prices: dict[uuid.UUID, float] = {}
        adjustments: list[dict] = []
        for test_id in test_ids:
            test = await test_repo.get_by_id(test_id)
            if test is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={"error_code": "TEST_NOT_FOUND", "message": f"Test {test_id} not found"},
                )
            effective = float(test.price) * (1 - float(test.discount_percentage) / 100)
            prices.append(_round2(effective))
        for package_id in package_ids:
            pkg = await package_repo.get_by_id(package_id)
            if pkg is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={"error_code": "PACKAGE_NOT_FOUND", "message": f"Package {package_id} not found"},
                )
            price = float(pkg.discounted_price)
            prices.append(price)
            package_prices[package_id] = price

        if coupon_code:
            coupon_service = CouponService(self.db)
            result = await coupon_service.validate(coupon_code, package_ids, user_id)
            if not result["valid"]:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={"error_code": result["error_code"], "message": result["message"]},
                )
            eligible_subtotal = sum(
                price for pid, price in package_prices.items() if pid in result["eligible_package_ids"]
            )
            discount_amount = coupon_service.compute_discount(result["coupon"], eligible_subtotal)
            if discount_amount > 0:
                adjustments.append(
                    {"kind": "discount", "label": f"Coupon {result['coupon'].code}", "amount": discount_amount}
                )

        return await self.compute_totals(prices, adjustments)

    async def booking_totals(self, booking) -> dict:  # type: ignore[no-untyped-def]
        """Totals for an existing booking: its items plus any manual admin
        adjustments. Used by payment initiation, the booking billing summary,
        and invoice generation so all three always agree."""
        adjustment_rows = await self.adjustment_repo.list_by_booking(booking.id)
        adjustments = [
            {"kind": a.kind, "label": a.label, "amount": float(a.amount)}
            for a in adjustment_rows
        ]
        prices = [float(item.unit_price) for item in booking.items]
        return await self.compute_totals(prices, adjustments)
