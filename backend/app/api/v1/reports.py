"""Reports router."""
from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.middleware.auth import require_roles
from app.schemas.reports import DownloadUrlResponse, ReportListResponse, ReportOut
from app.services.report_service import ReportService
from app.services.storage_service import LocalStorage, get_storage_backend

router = APIRouter(tags=["reports"])


@router.post("/reports/upload", response_model=ReportOut, status_code=201)
async def upload_report(
    booking_id: uuid.UUID,
    file: UploadFile,
    current_user: dict = Depends(require_roles("admin", "technician")),
    db: AsyncSession = Depends(get_db_session),
) -> ReportOut:
    svc = ReportService(db)
    result = await svc.upload_report(
        booking_id=booking_id,
        file=file,
        uploaded_by=uuid.UUID(current_user["user_id"]),
        uploader_role=current_user["role"],
    )
    return ReportOut.model_validate(result)


@router.get("/reports/{report_id}/download-url", response_model=DownloadUrlResponse)
async def get_download_url(
    report_id: uuid.UUID,
    disposition: Literal["attachment", "inline"] = "attachment",
    current_user: dict = Depends(require_roles("admin", "user", "technician")),
    db: AsyncSession = Depends(get_db_session),
) -> DownloadUrlResponse:
    """`disposition=inline` returns a URL the browser renders in place, for
    previewing a report without downloading it."""
    svc = ReportService(db)
    url = await svc.get_download_url(
        report_id=report_id,
        requesting_user_id=uuid.UUID(current_user["user_id"]),
        requesting_role=current_user["role"],
        disposition=disposition,
    )
    return DownloadUrlResponse(download_url=url)


@router.get("/reports", response_model=ReportListResponse)
async def list_reports(
    page: int = 1,
    page_size: int = 20,
    current_user: dict = Depends(require_roles("admin", "user", "technician")),
    db: AsyncSession = Depends(get_db_session),
) -> ReportListResponse:
    svc = ReportService(db)
    result = await svc.list_by_user(
        user_id=uuid.UUID(current_user["user_id"]),
        page=page,
        page_size=page_size,
    )
    return ReportListResponse.model_validate(result)


@router.get("/files/download/{token}")
async def download_file(token: str) -> FileResponse:
    """Local storage JWT-signed file download endpoint."""
    svc = ReportService.__new__(ReportService)  # no DB needed for token validation
    svc.storage = get_storage_backend()

    payload = svc.validate_download_token(token)

    if not isinstance(svc.storage, LocalStorage):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "NOT_LOCAL_STORAGE", "message": "Direct download not available"},
        )

    file_path = svc.storage.resolve_path(payload["key"])
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "FILE_NOT_FOUND", "message": "File not found"},
        )

    # Infer the content type from the stored key so non-PDF assets (e.g. avatar
    # images) are served with the correct type; reports keep resolving to PDF.
    import mimetypes

    media_type = mimetypes.guess_type(payload["key"])[0] or "application/pdf"
    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=payload.get("file_name") or file_path.name,
        # Tokens minted for a preview carry disposition="inline" so the browser
        # renders the PDF instead of downloading it. Tokens predating this field
        # (and every plain download link) fall back to "attachment".
        content_disposition_type=(
            "inline" if payload.get("disposition") == "inline" else "attachment"
        ),
    )
