"""Seed 3 Advertisement + 3 Promotional Offer homepage banners (idempotent).

Runs on startup. Banners only seed when the banners table is empty, so admins
are free to edit or delete them without them being recreated. The 3 sample
coupons backing the promotional offers are seeded independently (by code,
upsert-safe) since coupons are a standalone entity now, not owned by banners.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.banner import Banner
from app.models.coupon import Coupon, CouponPackage
from app.models.test import Package

ADVERTISEMENT_BANNERS: list[dict] = [
    {
        "title": "Complete Health Checkup at Affordable Prices",
        "subtitle": "Book preventive health packages from trusted diagnostic labs with discounts of up to 60% OFF.",
        "highlights": ["Home Collection", "NABL Certified", "Digital Reports", "Same-Day Results"],
        "category": "packages",
        "cta_text": "Book Now",
        "cta_link": "/packages",
        "cta2_text": "View Packages",
        "cta2_link": "/packages",
        "display_order": 1,
    },
    {
        "title": "Blood Sample Collection at Your Doorstep",
        "subtitle": "Our trained technicians collect blood samples safely from your home at your preferred time.",
        "highlights": ["Home Collection", "Certified Technicians", "Digital Reports", "100% Safe & Hygienic"],
        "category": "home_collection",
        "cta_text": "Book Home Visit",
        "cta_link": "/tests",
        "display_order": 2,
    },
    {
        "title": "Book Diagnostic Tests Online",
        "subtitle": "Choose from thousands of lab tests with trusted diagnostic partners.",
        "highlights": ["NABL Certified", "Digital Reports", "Same-Day Results", "Doorstep Service"],
        "category": "diagnostics",
        "cta_text": "Explore Tests",
        "cta_link": "/tests",
        "display_order": 3,
    },
]

SAMPLE_COUPONS: list[dict] = [
    {"code": "HEALTH100", "discount_type": "fixed", "discount_value": 100, "per_user_limit": 1},
    {"code": "SAVE10", "discount_type": "percentage", "discount_value": 10, "per_user_limit": 1},
    {"code": "WELCOME200", "discount_type": "fixed", "discount_value": 200, "per_user_limit": 1},
]

# One promotional_offer banner per sample coupon, in the same order.
PROMOTIONAL_OFFER_BANNERS: list[dict] = [
    {
        "title": "Save ₹100 on Your First Health Package",
        "subtitle": "Use code HEALTH100 at checkout and get ₹100 off any health package.",
        "highlights": ["Digital Reports", "NABL Certified"],
        "category": "offers",
        "cta_text": "View Packages",
        "cta_link": "/packages",
        "display_order": 4,
    },
    {
        "title": "Flat 10% Off on Diagnostic Packages",
        "subtitle": "Use code SAVE10 and save 10% on your next health package booking.",
        "highlights": ["Digital Reports", "Same-Day Results"],
        "category": "offers",
        "cta_text": "View Packages",
        "cta_link": "/packages",
        "display_order": 5,
    },
    {
        "title": "Welcome Offer: ₹200 Off Health Checkups",
        "subtitle": "New here? Use code WELCOME200 for ₹200 off your first health checkup package.",
        "highlights": ["Home Collection", "NABL Certified"],
        "category": "offers",
        "cta_text": "View Packages",
        "cta_link": "/packages",
        "display_order": 6,
    },
]


async def _seed_sample_coupons(session: AsyncSession) -> list[uuid.UUID]:
    """Upsert-safe: create any of the 3 sample coupons that don't already
    exist (by code), and return all 3 ids in SAMPLE_COUPONS order."""
    codes = [c["code"] for c in SAMPLE_COUPONS]
    existing = (
        await session.execute(select(Coupon).where(Coupon.code.in_(codes)))
    ).scalars().all()
    by_code = {c.code: c.id for c in existing}

    missing = [c for c in SAMPLE_COUPONS if c["code"] not in by_code]
    if missing:
        package_ids = list(
            (
                await session.execute(
                    select(Package.id).where(Package.deleted_at.is_(None)).limit(6)
                )
            ).scalars().all()
        )
        for i, data in enumerate(missing):
            coupon = Coupon(is_active=True, **data)
            session.add(coupon)
            await session.flush()
            by_code[coupon.code] = coupon.id
            # Best-effort: link to whatever packages already exist so the
            # coupon is immediately usable; admins can adjust later.
            for pid in package_ids[i * 2 : i * 2 + 2] or package_ids[:2]:
                session.add(CouponPackage(coupon_id=coupon.id, package_id=pid))
        await session.flush()

    return [by_code[c["code"]] for c in SAMPLE_COUPONS]


async def seed_banners(session: AsyncSession) -> None:
    existing = await session.execute(select(Banner.id).limit(1))
    if existing.scalar_one_or_none() is not None:
        return

    coupon_ids = await _seed_sample_coupons(session)

    for data in ADVERTISEMENT_BANNERS:
        session.add(Banner(status="published", banner_type="advertisement", **data))

    for coupon_id, data in zip(coupon_ids, PROMOTIONAL_OFFER_BANNERS):
        session.add(
            Banner(
                status="published",
                banner_type="promotional_offer",
                coupon_id=coupon_id,
                **data,
            )
        )
