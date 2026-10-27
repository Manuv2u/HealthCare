"""ReportService — upload, download URL generation, and file streaming."""
from __future__ import annotations

import logging
import uuid

from jose import ExpiredSignatureError, JWTError
from jose import jwt as jose_jwt
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.repositories.booking_repository import BookingRepository
from app.repositories.report_repository import ReportRepository
from app.services.storage_service import LocalStorage, get_storage_backend

logger = logging.getLogger("sri.report")

_MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


class ReportService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = ReportRepository(db)
        self.booking_repo = BookingRepository(db)
        self.storage = get_storage_backend()

    async def upload_report(
        self,
        booking_id: uuid.UUID,
        file: UploadFile,
        uploaded_by: uuid.UUID,
        uploader_role: str,
    ) -> dict:
        # Validate file type and size
        if file.content_type not in ("application/pdf",):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"error_code": "INVALID_FILE_TYPE", "message": "Only PDF files are allowed"},
            )

        file_bytes = await file.read()
        if len(file_bytes) > _MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"error_code": "FILE_TOO_LARGE", "message": "File must be ≤ 20 MB"},
            )

        # Validate booking exists
        booking = await self.booking_repo.get_by_id(booking_id)
        if booking is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "BOOKING_NOT_FOUND", "message": "Booking not found"},
            )

        # Upload to storage
        storage_key = f"reports/{booking_id}/{uuid.uuid4()}.pdf"
        await self.storage.upload(file_bytes, storage_key, "application/pdf")

        # Persist report record. Old reports for this booking are kept, not
        # deleted — a DB trigger enforces a 90-day retention period on the
        # `reports` table for audit/compliance, so a delete here would raise.
        # See list_by_booking() below, which surfaces only the newest report
        # as the booking's "current" one.
        report = await self.repo.create(
            booking_id=booking_id,
            storage_key=storage_key,
            # File name always tracks the booking's reference number, regardless
            # of what the uploader named the source file, so it stays consistent
            # for both admin and the patient.
            file_name=f"{booking.reference_number}.pdf",
            file_size_bytes=len(file_bytes),
            uploaded_by=uploaded_by,
            uploader_role=uploader_role,
        )

        # Update booking status to report_ready — but not if the report is being
        # replaced on a booking that's already completed or cancelled; otherwise
        # a routine re-upload (e.g. a corrected report) would silently revert a
        # completed booking back to report_ready.
        if booking.status not in ("completed", "cancelled"):
            await self.booking_repo.update_status(
                booking_id, "report_ready", changed_by=uploaded_by, is_admin=True,
                reason="Report uploaded"
            )

        logger.info("report_uploaded: report_id=%s booking_id=%s", report.id, booking_id)

        return _report_to_dict(report)

    async def get_download_url(
        self,
        report_id: uuid.UUID,
        requesting_user_id: uuid.UUID,
        requesting_role: str,
        disposition: str = "attachment",
    ) -> str:
        report = await self.repo.get_by_id(report_id)
        if report is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "REPORT_NOT_FOUND", "message": "Report not found"},
            )

        booking = await self.booking_repo.get_by_id(report.booking_id)
        if booking is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "BOOKING_NOT_FOUND", "message": "Booking not found"},
            )

        # Verify ownership unless admin
        if requesting_role != "admin" and booking.user_id != requesting_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error_code": "ACCESS_DENIED", "message": "Access denied"},
            )

        url = await self.storage.generate_signed_url(
            key=report.storage_key,
            report_id=report.id,
            user_id=requesting_user_id,
            # Always derive from the booking's *current* reference number, not
            # the report's stored file_name, so a later reference-number change
            # is reflected immediately for both admin and the patient.
            file_name=f"{booking.reference_number}.pdf",
            disposition=disposition,
        )

        logger.info(
            "report_download_url_generated: report_id=%s user_id=%s disposition=%s",
            report_id,
            requesting_user_id,
            disposition,
        )

        return url

    async def list_by_user(
        self, user_id: uuid.UUID, page: int, page_size: int
    ) -> dict:
        items, total = await self.repo.list_by_user(user_id, page=page, page_size=page_size)
        return {
            "items": [_report_to_dict(r, reference_number) for r, reference_number in items],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def list_by_booking(self, booking_id: uuid.UUID) -> list[dict]:
        items = await self.repo.list_by_booking(booking_id)
        # Superseded reports are kept in the DB for the retention period (see
        # upload_report) but only the most recent upload is the "current"
        # report for a booking — surface just that one.
        if items:
            items = items[:1]
        if not items:
            return []
        booking = await self.booking_repo.get_by_id(booking_id)
        reference_number = booking.reference_number if booking else None
        return [_report_to_dict(r, reference_number) for r in items]

    def validate_download_token(self, token: str) -> dict:
        """Validate JWT download token for local storage; return payload."""
        try:
            payload = jose_jwt.decode(
                token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
            )
            return payload
        except ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error_code": "TOKEN_EXPIRED", "message": "Download link has expired"},
            )
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error_code": "INVALID_TOKEN", "message": "Invalid download token"},
            )


def _report_to_dict(report, reference_number: str | None = None) -> dict:  # type: ignore[no-untyped-def]
    return {
        "id": report.id,
        "booking_id": report.booking_id,
        # Always derive from the booking's current reference number rather than
        # trusting the stored snapshot, so it stays correct even if the
        # reference number is changed after the report was uploaded.
        "file_name": f"{reference_number}.pdf" if reference_number else report.file_name,
        "file_size_bytes": report.file_size_bytes,
        "uploaded_by": report.uploaded_by,
        "uploader_role": report.uploader_role,
        "uploaded_at": report.uploaded_at,
        "retention_until": report.retention_until,
    }
