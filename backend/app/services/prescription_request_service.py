"""PrescriptionRequestService — Upload Prescription lead capture.

Public flow: send OTP → verify OTP (returns a short-lived signed token) →
submit patient details + prescription files (token required). Admin flow:
list/search, view with signed download URLs, update status/assignment,
delete (removes stored files), stats, and Excel/PDF export.
"""
from __future__ import annotations

import io
import logging
import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, UploadFile, status
from jose import JWTError, jwt as jose_jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.repositories.prescription_request_repository import PrescriptionRequestRepository
from app.services.notification_providers import get_email_client, get_sms_client
from app.services.otp_service import OTPService
from app.services.storage_service import get_storage_backend
from app.utils.timezone import LAB_TZ, local_now

logger = logging.getLogger("sri.prescriptions")

_EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")

MAX_FILES = 3
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_TYPES: dict[str, str] = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
}
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}

OTP_TTL_MINUTES = 5
VERIFY_TOKEN_TTL_MINUTES = 30

# OTP_DISABLED: mobile-OTP verification is turned off for now — the public
# upload form no longer gates submission on a verified mobile number. Flip
# back to True (and re-enable the OTP step in upload-prescription-modal.component.ts)
# to restore it.
PRESCRIPTION_OTP_REQUIRED = False


def _bad_request(error_code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"error_code": error_code, "message": message},
    )


class PrescriptionRequestService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = PrescriptionRequestRepository(db)
        self.storage = get_storage_backend()

    # ── OTP flow ──────────────────────────────────────────────────────────────

    async def send_otp(self, mobile: str) -> dict:
        # Storage, delivery, cooldown and per-window rate limiting all live in
        # the DB-backed OTPService now (it raises 429 on abuse), so the old
        # in-process throttle dict is gone.
        result = await OTPService(self.db).send_otp(
            mobile, purpose="prescription", ttl_minutes=OTP_TTL_MINUTES
        )
        return {
            "message": "OTP sent to your mobile number",
            "expires_in_seconds": result["expires_in_seconds"],
        }

    async def verify_otp(self, mobile: str, otp: str) -> dict:
        if not await OTPService(self.db).verify_otp(mobile, otp, purpose="prescription"):
            raise _bad_request("OTP_INVALID", "Invalid or expired OTP. Please try again.")
        token = jose_jwt.encode(
            {
                "purpose": "prescription_otp",
                "mobile": mobile,
                "exp": datetime.now(timezone.utc) + timedelta(minutes=VERIFY_TOKEN_TTL_MINUTES),
            },
            settings.jwt_secret,
            algorithm=settings.jwt_algorithm,
        )
        return {"verified": True, "verification_token": token}

    def _require_verified(self, verification_token: str, mobile: str) -> None:
        if not PRESCRIPTION_OTP_REQUIRED:
            return
        try:
            payload = jose_jwt.decode(
                verification_token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
            )
        except JWTError:
            raise _bad_request(
                "OTP_VERIFICATION_REQUIRED",
                "Mobile verification expired or invalid. Please verify the OTP again.",
            )
        if payload.get("purpose") != "prescription_otp" or payload.get("mobile") != mobile:
            raise _bad_request(
                "OTP_VERIFICATION_MISMATCH",
                "Verification does not match this mobile number. Please verify again.",
            )

    # ── Public submit ─────────────────────────────────────────────────────────

    @staticmethod
    def _validate_email(email: str | None) -> str | None:
        email = (email or "").strip()
        if not email:
            return None
        if not _EMAIL_RE.match(email):
            raise _bad_request("EMAIL_INVALID", "Enter a valid email address")
        return email

    @staticmethod
    def _safe_ext(file: UploadFile) -> str:
        name = file.filename or ""
        ext = ("." + name.rsplit(".", 1)[-1].lower()) if "." in name else ""
        if ext not in ALLOWED_EXTENSIONS or (file.content_type or "") not in ALLOWED_TYPES:
            raise _bad_request(
                "FILE_TYPE_NOT_ALLOWED",
                "Only PDF, JPG, JPEG and PNG files are allowed",
            )
        return ext

    async def create(
        self,
        patient_name: str,
        mobile: str,
        city: str,
        verification_token: str,
        email: str | None,
        callback_time: str | None,
        remarks: str | None,
        files: list[UploadFile],
    ) -> dict:
        self._require_verified(verification_token, mobile)

        patient_name = patient_name.strip()
        city = city.strip()
        if not patient_name:
            raise _bad_request("PATIENT_NAME_REQUIRED", "Patient name is required")
        if not city:
            raise _bad_request("CITY_REQUIRED", "City is required")
        email = self._validate_email(email)

        if not files:
            raise _bad_request("FILES_REQUIRED", "Upload at least one prescription file")
        if len(files) > MAX_FILES:
            raise _bad_request("TOO_MANY_FILES", f"Maximum {MAX_FILES} files allowed")

        # Validate everything (types + sizes) before any row or byte is written.
        contents: list[tuple[UploadFile, str, bytes]] = []
        for f in files:
            ext = self._safe_ext(f)
            data = await f.read()
            if len(data) > MAX_FILE_SIZE:
                raise _bad_request(
                    "FILE_TOO_LARGE",
                    f"Each file must be 10 MB or smaller ({f.filename} is too large)",
                )
            if not data:
                raise _bad_request("FILE_EMPTY", f"{f.filename} is empty")
            contents.append((f, ext, data))

        req = await self.repo.create(
            request_number=await self.repo.next_request_number(local_now()),
            patient_name=patient_name,
            mobile=mobile,
            city=city,
            email=email,
            callback_time=callback_time or None,
            remarks=(remarks or "").strip() or None,
            otp_verified=True,
        )

        for f, ext, data in contents:
            key = f"prescriptions/{req.id}/{uuid.uuid4().hex}{ext}"
            await self.storage.upload(data, key, f.content_type or "application/octet-stream")
            await self.repo.add_file(
                request_id=req.id,
                file_name=f.filename or f"prescription{ext}",
                file_path=key,
                content_type=f.content_type or "application/octet-stream",
                file_size=len(data),
            )
        await self.db.refresh(req)

        await self._send_confirmation(req.request_number, mobile, email, patient_name)
        return {
            "id": req.id,
            "request_number": req.request_number,
            "message": "Our healthcare team will contact you within 30 minutes.",
        }

    async def _send_confirmation(
        self, request_number: str, mobile: str, email: str | None, patient_name: str
    ) -> None:
        """Best-effort confirmation SMS/email — never fails the submission."""
        message = (
            f"Hi {patient_name}, we received your prescription (Ref {request_number}). "
            "Our healthcare team will call you within 30 minutes to help book your tests. "
            "— Sri Health Plus"
        )
        try:
            await get_sms_client().send(mobile, message)
        except Exception:
            logger.exception("Confirmation SMS failed for %s", request_number)
        if email:
            try:
                await get_email_client().send(
                    email, f"Prescription received — {request_number}", message
                )
            except Exception:
                logger.exception("Confirmation email failed for %s", request_number)

    # ── Admin ────────────────────────────────────────────────────────────────

    async def list(
        self,
        status_filter: str | None,
        q: str | None,
        page: int,
        page_size: int,
        sort: str,
        order: str,
    ) -> dict:
        items, total = await self.repo.list(
            status=status_filter, q=q, page=page, page_size=page_size, sort=sort, order=order
        )
        return {"items": items, "total": total, "page": page, "page_size": page_size}

    async def _get_or_404(self, request_id: uuid.UUID):
        req = await self.repo.get_by_id(request_id)
        if req is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error_code": "PRESCRIPTION_REQUEST_NOT_FOUND",
                    "message": "Prescription request not found",
                },
            )
        return req

    async def get_with_download_urls(self, request_id: uuid.UUID, admin_id: uuid.UUID) -> dict:
        req = await self._get_or_404(request_id)
        files = []
        for f in req.files:
            url = await self.storage.generate_signed_url(
                key=f.file_path, report_id=f.id, user_id=admin_id, file_name=f.file_name
            )
            files.append(
                {
                    "id": f.id,
                    "file_name": f.file_name,
                    "content_type": f.content_type,
                    "file_size": f.file_size,
                    "uploaded_at": f.uploaded_at,
                    "download_url": url,
                }
            )
        return {"request": req, "files": files}

    async def update(
        self,
        request_id: uuid.UUID,
        status_value: str | None,
        assigned_to: str | None,
        remarks: str | None,
    ):
        req = await self.repo.update(
            request_id, status=status_value, assigned_to=assigned_to, remarks=remarks
        )
        if req is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error_code": "PRESCRIPTION_REQUEST_NOT_FOUND",
                    "message": "Prescription request not found",
                },
            )
        return req

    async def delete(self, request_id: uuid.UUID) -> None:
        req = await self._get_or_404(request_id)
        for f in req.files:
            try:
                await self.storage.delete(f.file_path)
            except Exception:
                logger.exception("Failed to delete stored file %s", f.file_path)
        await self.repo.delete(request_id)

    async def stats(self) -> dict:
        today_local = local_now().replace(hour=0, minute=0, second=0, microsecond=0)
        return await self.repo.stats(today_start=today_local.astimezone(timezone.utc))

    # ── Exports ──────────────────────────────────────────────────────────────

    _EXPORT_COLUMNS = [
        ("Request ID", lambda r: r.request_number),
        ("Patient Name", lambda r: r.patient_name),
        ("Mobile", lambda r: r.mobile),
        ("Email", lambda r: r.email or ""),
        ("City", lambda r: r.city),
        ("Callback Time", lambda r: r.callback_time or ""),
        ("Files", lambda r: len(r.files)),
        ("Status", lambda r: r.status),
        ("Assigned To", lambda r: r.assigned_to or ""),
        ("Remarks", lambda r: r.remarks or ""),
        ("Created", lambda r: r.created_at.astimezone(LAB_TZ).strftime("%d %b %Y, %I:%M %p")),
    ]

    async def _export_rows(self, status_filter: str | None, q: str | None):
        items, _ = await self.repo.list(status=status_filter, q=q, page=1, page_size=10_000)
        return items

    async def export_xlsx(self, status_filter: str | None, q: str | None) -> bytes:
        from openpyxl import Workbook
        from openpyxl.styles import Font

        items = await self._export_rows(status_filter, q)
        wb = Workbook()
        ws = wb.active
        ws.title = "Prescription Requests"
        ws.append([name for name, _ in self._EXPORT_COLUMNS])
        for cell in ws[1]:
            cell.font = Font(bold=True)
        for r in items:
            ws.append([get(r) for _, get in self._EXPORT_COLUMNS])
        for column_cells in ws.columns:
            width = max(len(str(c.value or "")) for c in column_cells)
            ws.column_dimensions[column_cells[0].column_letter].width = min(width + 2, 40)
        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()

    async def export_pdf(self, status_filter: str | None, q: str | None) -> bytes:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.units import mm
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet

        items = await self._export_rows(status_filter, q)
        styles = getSampleStyleSheet()
        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf, pagesize=landscape(A4), topMargin=14 * mm, bottomMargin=14 * mm
        )
        # Remarks are dropped in the PDF to keep rows on one page width.
        columns = [c for c in self._EXPORT_COLUMNS if c[0] != "Remarks"]
        data = [[name for name, _ in columns]]
        for r in items:
            data.append([str(get(r)) for _, get in columns])
        table = Table(data, repeatRows=1)
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#16a34a")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 5),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        generated = local_now().strftime("%d %b %Y, %I:%M %p")
        doc.build(
            [
                Paragraph("Sri Health Plus — Prescription Requests", styles["Title"]),
                Paragraph(f"Generated {generated}", styles["Normal"]),
                Spacer(1, 6 * mm),
                table,
            ]
        )
        return buf.getvalue()
