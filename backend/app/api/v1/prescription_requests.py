"""Prescription requests router: public upload-prescription lead capture + admin queue.

Public flow (no auth): send-otp → verify-otp → multipart submit with the
verification token. Admin endpoints power the Prescription Requests queue,
dashboard cards, and Excel/PDF exports.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.middleware.auth import require_roles
from app.schemas.prescription_requests import (
    PrescriptionFileOut,
    PrescriptionRequestListResponse,
    PrescriptionRequestOut,
    PrescriptionStatsOut,
    PrescriptionSubmitResponse,
    SendOtpRequest,
    SendOtpResponse,
    UpdatePrescriptionRequest,
    VerifyOtpRequest,
    VerifyOtpResponse,
)
from app.services.prescription_request_service import PrescriptionRequestService
from app.utils.timezone import local_now

router = APIRouter(prefix="/prescriptions", tags=["prescriptions"])


# ── Public endpoints ──────────────────────────────────────────────────────────

@router.post("/send-otp", response_model=SendOtpResponse)
async def send_otp(
    body: SendOtpRequest,
    db: AsyncSession = Depends(get_db_session),
) -> SendOtpResponse:
    svc = PrescriptionRequestService(db)
    result = await svc.send_otp(body.mobile)
    return SendOtpResponse(**result)


@router.post("/verify-otp", response_model=VerifyOtpResponse)
async def verify_otp(
    body: VerifyOtpRequest,
    db: AsyncSession = Depends(get_db_session),
) -> VerifyOtpResponse:
    svc = PrescriptionRequestService(db)
    result = await svc.verify_otp(body.mobile, body.otp)
    return VerifyOtpResponse(**result)


@router.post("", response_model=PrescriptionSubmitResponse, status_code=201)
async def submit_prescription(
    patient_name: str = Form(...),
    mobile: str = Form(...),
    city: str = Form(...),
    verification_token: str = Form(...),
    email: str | None = Form(default=None),
    callback_time: str | None = Form(default=None),
    remarks: str | None = Form(default=None),
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db_session),
) -> PrescriptionSubmitResponse:
    svc = PrescriptionRequestService(db)
    result = await svc.create(
        patient_name=patient_name,
        mobile=mobile,
        city=city,
        verification_token=verification_token,
        email=email,
        callback_time=callback_time,
        remarks=remarks,
        files=files,
    )
    return PrescriptionSubmitResponse(**result)


# ── Admin endpoints ───────────────────────────────────────────────────────────
# NOTE: static paths (/stats, /export) are declared before /{request_id}.

@router.get("/stats", response_model=PrescriptionStatsOut)
async def prescription_stats(
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> PrescriptionStatsOut:
    svc = PrescriptionRequestService(db)
    return PrescriptionStatsOut(**await svc.stats())


@router.get("/export")
async def export_prescriptions(
    format: str = Query(default="xlsx", pattern="^(xlsx|pdf)$"),
    status: str | None = Query(default=None),
    q: str | None = Query(default=None),
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    svc = PrescriptionRequestService(db)
    stamp = local_now().strftime("%Y%m%d_%H%M")
    if format == "pdf":
        data = await svc.export_pdf(status, q)
        media_type = "application/pdf"
        filename = f"prescription_requests_{stamp}.pdf"
    else:
        data = await svc.export_xlsx(status, q)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"prescription_requests_{stamp}.xlsx"
    return Response(
        content=data,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("", response_model=PrescriptionRequestListResponse)
async def list_prescriptions(
    status: str | None = Query(default=None),
    q: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    sort: str = Query(default="created_at"),
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> PrescriptionRequestListResponse:
    svc = PrescriptionRequestService(db)
    result = await svc.list(
        status_filter=status, q=q, page=page, page_size=page_size, sort=sort, order=order
    )
    return PrescriptionRequestListResponse(
        items=[PrescriptionRequestOut.model_validate(i) for i in result["items"]],
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
    )


@router.get("/{request_id}", response_model=PrescriptionRequestOut)
async def get_prescription(
    request_id: uuid.UUID,
    admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> PrescriptionRequestOut:
    svc = PrescriptionRequestService(db)
    result = await svc.get_with_download_urls(request_id, uuid.UUID(admin["user_id"]))
    out = PrescriptionRequestOut.model_validate(result["request"])
    out.files = [PrescriptionFileOut(**f) for f in result["files"]]
    return out


@router.put("/{request_id}", response_model=PrescriptionRequestOut)
async def update_prescription(
    request_id: uuid.UUID,
    body: UpdatePrescriptionRequest,
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> PrescriptionRequestOut:
    svc = PrescriptionRequestService(db)
    result = await svc.update(
        request_id,
        status_value=body.status,
        assigned_to=body.assigned_to,
        remarks=body.remarks,
    )
    return PrescriptionRequestOut.model_validate(result)


@router.delete("/{request_id}", status_code=204)
async def delete_prescription(
    request_id: uuid.UUID,
    _admin: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    svc = PrescriptionRequestService(db)
    await svc.delete(request_id)
