"""Pydantic v2 schemas for banner endpoints."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.coupons import CouponSummaryOut

BANNER_CATEGORIES = (
    "packages",
    "home_collection",
    "corporate",
    "health_awareness",
    "offers",
    "diagnostics",
)

# advertisement: image/marketing only.
# promotional_offer: marketing only too — may link to a Coupon (coupon_id)
# purely to display that coupon's code as a badge; the discount lives on the
# Coupon itself, not the banner.
BANNER_TYPES = ("advertisement", "promotional_offer")

# Fixed picklist for the Highlights field — no free text.
BANNER_HIGHLIGHTS = (
    "Home Collection",
    "NABL Certified",
    "Digital Reports",
    "Same-Day Results",
    "Certified Technicians",
    "No Prior Appointment Needed",
    "100% Safe & Hygienic",
    "Doorstep Service",
    "24x7 Support",
)


def _validate_highlights(v: list[str]) -> list[str]:
    invalid = set(v) - set(BANNER_HIGHLIGHTS)
    if invalid:
        raise ValueError(f"Invalid highlight(s): {sorted(invalid)}")
    return v


class BannerBase(BaseModel):
    # Nullable — an image-only banner has no content fields at all. Required
    # for banner_type == 'advertisement' (enforced below and again in
    # BannerService for partial updates).
    title: str | None = Field(default=None, max_length=200)
    subtitle: str | None = Field(default=None, max_length=400)
    description: str | None = None
    cta_text: str | None = Field(default=None, max_length=80)
    cta_link: str | None = Field(default=None, max_length=500)
    cta2_text: str | None = Field(default=None, max_length=80)
    cta2_link: str | None = Field(default=None, max_length=500)
    highlights: list[str] = Field(default_factory=list)
    category: str = "packages"
    banner_type: str = Field(default="advertisement", pattern="^(advertisement|promotional_offer)$")
    coupon_id: uuid.UUID | None = None
    display_order: int = 0
    status: str = Field(default="draft", pattern="^(draft|published)$")

    @field_validator("highlights")
    @classmethod
    def _highlights_in_range(cls, v: list[str]) -> list[str]:
        return _validate_highlights(v)


class BannerCreate(BannerBase):
    @model_validator(mode="after")
    def check_advertisement_required(self) -> "BannerCreate":
        if self.banner_type == "advertisement":
            if not (self.title or "").strip() or not (self.subtitle or "").strip():
                raise ValueError("Advertisement banners require both a title and a subtitle")
        return self


class BannerUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    subtitle: str | None = Field(default=None, max_length=400)
    description: str | None = None
    cta_text: str | None = Field(default=None, max_length=80)
    cta_link: str | None = Field(default=None, max_length=500)
    cta2_text: str | None = Field(default=None, max_length=80)
    cta2_link: str | None = Field(default=None, max_length=500)
    highlights: list[str] | None = None
    category: str | None = None
    banner_type: str | None = Field(default=None, pattern="^(advertisement|promotional_offer)$")
    coupon_id: uuid.UUID | None = None
    display_order: int | None = None
    status: str | None = Field(default=None, pattern="^(draft|published)$")

    @field_validator("highlights")
    @classmethod
    def _highlights_in_range(cls, v: list[str] | None) -> list[str] | None:
        return _validate_highlights(v) if v is not None else v


class BannerReorderItem(BaseModel):
    id: uuid.UUID
    display_order: int


class BannerReorderRequest(BaseModel):
    items: list[BannerReorderItem]


class BannerOut(BaseModel):
    """Public-facing banner shape used by the homepage carousel."""

    id: uuid.UUID
    title: str | None
    subtitle: str | None
    description: str | None
    cta_text: str | None
    cta_link: str | None
    cta2_text: str | None
    cta2_link: str | None
    highlights: list[str]
    category: str
    banner_type: str
    coupon: CouponSummaryOut | None = None
    display_order: int
    desktop_image_url: str | None = None
    mobile_image_url: str | None = None

    model_config = {"from_attributes": True}


class BannerAdminOut(BannerOut):
    """Admin view exposes the management-only fields too."""

    coupon_id: uuid.UUID | None
    status: str
    created_at: datetime
    updated_at: datetime
