"""Pydantic schemas for reports."""
from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel


class ReportOut(BaseModel):
    id: uuid.UUID
    booking_id: uuid.UUID
    file_name: str
    file_size_bytes: int
    uploaded_by: uuid.UUID
    uploader_role: str
    uploaded_at: datetime
    retention_until: date

    model_config = {"from_attributes": True}


class ReportListResponse(BaseModel):
    items: list[ReportOut]
    total: int
    page: int
    page_size: int


class DownloadUrlResponse(BaseModel):
    download_url: str
    expires_in_seconds: int = 86400
