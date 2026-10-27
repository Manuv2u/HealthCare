"""Banner service: business logic for the homepage hero carousel + admin CRUD."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.banner import Banner
from app.repositories.banner_repository import BannerRepository
from app.repositories.coupon_repository import CouponRepository
from app.schemas.banners import BannerCreate, BannerUpdate
from app.services.storage_service import get_storage_backend

_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


class BannerService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = BannerRepository(db)
        self.coupon_repo = CouponRepository(db)
        self.storage = get_storage_backend()

    # ── image URL signing ────────────────────────────────────────────────────
    async def _sign(self, key: str | None, banner_id: uuid.UUID) -> str | None:
        if not key:
            return None
        file_name = key.rsplit("/", 1)[-1]
        # generate_signed_url reuses the report download flow; report_id/user_id
        # are only echoed into the token, so the banner id is a safe filler.
        return await self.storage.generate_signed_url(
            key=key, report_id=banner_id, user_id=banner_id, file_name=file_name
        )

    async def serialize(self, banner: Banner) -> dict[str, Any]:
        # Only show the coupon badge while the coupon is actually redeemable —
        # a banner must not keep advertising a code that's since been
        # exhausted, expired or deactivated. banner.coupon_id itself (below)
        # still reflects the raw admin-configured link either way.
        coupon = None
        if banner.coupon_id:
            linked = await self.coupon_repo.get_live_by_id(banner.coupon_id)
            if linked:
                coupon = {
                    "code": linked.code,
                    "discount_type": linked.discount_type,
                    "discount_value": linked.discount_value,
                }
        return {
            "id": banner.id,
            "title": banner.title,
            "subtitle": banner.subtitle,
            "description": banner.description,
            "cta_text": banner.cta_text,
            "cta_link": banner.cta_link,
            "cta2_text": banner.cta2_text,
            "cta2_link": banner.cta2_link,
            "highlights": banner.highlights or [],
            "category": banner.category,
            "banner_type": banner.banner_type,
            "coupon": coupon,
            "coupon_id": banner.coupon_id,
            "display_order": banner.display_order,
            "desktop_image_url": await self._sign(banner.desktop_image_key, banner.id),
            "mobile_image_url": await self._sign(banner.mobile_image_key, banner.id),
            "status": banner.status,
            "created_at": banner.created_at,
            "updated_at": banner.updated_at,
        }

    # ── queries ──────────────────────────────────────────────────────────────
    async def list_live(self) -> list[dict[str, Any]]:
        banners = await self.repo.list_live()
        return [await self.serialize(b) for b in banners]

    async def list_all(self) -> list[dict[str, Any]]:
        banners = await self.repo.list_all()
        return [await self.serialize(b) for b in banners]

    async def get(self, banner_id: uuid.UUID) -> Banner:
        banner = await self.repo.get_by_id(banner_id)
        if not banner:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "BANNER_NOT_FOUND", "message": "Banner not found"},
            )
        return banner

    # ── mutations ────────────────────────────────────────────────────────────
    def _validate_type_fields(
        self, banner_type: str, title: str | None, subtitle: str | None
    ) -> None:
        if banner_type == "advertisement":
            if not (title or "").strip() or not (subtitle or "").strip():
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        "error_code": "AD_BANNER_INVALID",
                        "message": "Advertisement banners require both a title and a subtitle",
                    },
                )

    async def create(self, body: BannerCreate) -> dict[str, Any]:
        fields = body.model_dump()
        self._validate_type_fields(fields["banner_type"], fields.get("title"), fields.get("subtitle"))
        if not fields.get("display_order"):
            fields["display_order"] = await self.repo.max_display_order() + 1
        banner = await self.repo.create(**fields)
        return await self.serialize(banner)

    async def update(self, banner_id: uuid.UUID, body: BannerUpdate) -> dict[str, Any]:
        banner = await self.get(banner_id)
        fields = body.model_dump(exclude_unset=True)

        banner_type = fields.get("banner_type", banner.banner_type)
        title = fields.get("title", banner.title)
        subtitle = fields.get("subtitle", banner.subtitle)
        self._validate_type_fields(banner_type, title, subtitle)

        banner = await self.repo.update(banner, **fields)
        return await self.serialize(banner)

    async def delete(self, banner_id: uuid.UUID) -> None:
        """Hard-delete a banner. Nothing references a banner from outside this
        table anymore (coupons are independent of banners), so this always
        succeeds once the row exists."""
        banner = await self.get(banner_id)
        image_keys = [
            key for key in (banner.desktop_image_key, banner.mobile_image_key) if key
        ]
        await self.repo.delete(banner)
        for key in image_keys:
            try:
                await self.storage.delete(key)
            except Exception:  # best-effort cleanup
                pass

    async def reorder(self, items: list) -> None:
        for item in items:
            banner = await self.repo.get_by_id(item.id)
            if banner:
                await self.repo.update(banner, display_order=item.display_order)

    async def upload_image(
        self, banner_id: uuid.UUID, variant: str, file: UploadFile
    ) -> dict[str, Any]:
        if variant not in ("desktop", "mobile"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error_code": "INVALID_VARIANT", "message": "variant must be desktop or mobile"},
            )
        if (file.content_type or "") not in _ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error_code": "INVALID_FILE", "message": "Banner image must be a JPEG, PNG, WEBP or GIF"},
            )
        banner = await self.get(banner_id)
        ext = "png"
        if file.filename and "." in file.filename:
            ext = file.filename.rsplit(".", 1)[-1].lower()
        key = f"banners/{banner_id}/{variant}-{uuid.uuid4()}.{ext}"
        await self.storage.upload(await file.read(), key, file.content_type or "image/png")

        old_key = banner.desktop_image_key if variant == "desktop" else banner.mobile_image_key
        field = "desktop_image_key" if variant == "desktop" else "mobile_image_key"
        await self.repo.update(banner, **{field: key})
        if old_key:
            try:
                await self.storage.delete(old_key)
            except Exception:
                pass
        return await self.serialize(banner)
