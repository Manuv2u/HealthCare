"""Admin router — user/customer management, service requests, audit logs, analytics."""
from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date as _date
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import JSONResponse
from fastapi.responses import Response as _Response
from pydantic import BaseModel, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.middleware.auth import require_roles
from app.models.service import ServiceRequest
from app.models.user import User
from app.schemas.admin_users import (
    AdminNoteOut,
    AdminUserDetail,
    AdminUserListResponse,
    AdminUserRow,
    BlockUserRequest,
    CreateNoteRequest,
    LoginActivityResponse,
    LoginEventOut,
    NotifyUserRequest,
    SetTagsRequest,
    UpdateUserRequest,
)
from app.schemas.service_areas import ServiceRequestOut
from app.schemas.users import ChangeUserRoleRequest, FamilyMemberOut, UserAddressOut
from app.services.admin_user_service import AdminUserService, UserFilters
from app.utils.audit import audit

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Legacy schemas (kept for backward compatibility) ──────────────────────────

class UserAdminOut(BaseModel):
    id: uuid.UUID
    name: str
    phone: Optional[str]
    email: Optional[str]
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogOut(BaseModel):
    id: uuid.UUID
    actor_id: Optional[uuid.UUID]
    actor_role: Optional[str]
    action_type: str
    entity_type: str
    entity_id: str
    outcome: str
    source_ip: Optional[str]
    metadata: Optional[dict]
    created_at: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def _map_orm(cls, data):
        # The AuditLog ORM attribute is `extra_data` (DB column is "metadata"); a bare
        # `.metadata` would resolve to SQLAlchemy's MetaData, so map explicitly.
        from app.models.audit import AuditLog

        if isinstance(data, AuditLog):
            return {
                "id": data.id,
                "actor_id": data.actor_id,
                "actor_role": data.actor_role,
                "action_type": data.action_type,
                "entity_type": data.entity_type,
                "entity_id": data.entity_id,
                "outcome": data.outcome,
                "source_ip": str(data.source_ip) if data.source_ip is not None else None,
                "metadata": data.extra_data,
                "created_at": data.created_at,
            }
        return data


class AuditLogListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[AuditLogOut]


# ── helpers ───────────────────────────────────────────────────────────────────

async def _avatar_url(user: User) -> Optional[str]:
    """Return a signed download URL for a user's avatar, or None if unset."""
    if not user.avatar_key:
        return None
    from app.services.storage_service import get_storage_backend

    storage = get_storage_backend()
    return await storage.generate_signed_url(
        key=user.avatar_key,
        report_id=user.id,
        user_id=user.id,
        file_name=user.avatar_key.rsplit("/", 1)[-1],
    )


async def _get_user_or_404(db: AsyncSession, user_id: uuid.UUID) -> User:
    result = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def _build_filters(**kwargs) -> UserFilters:
    return UserFilters(**kwargs)


# ── User list / stats / export ────────────────────────────────────────────────

@router.get("/users", response_model=AdminUserListResponse)
async def list_users(
    q: Optional[str] = Query(default=None, description="Name / email / mobile / user-id / booking-id"),
    role: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),  # legacy param, mapped to account_status
    account_status: Optional[list[str]] = Query(default=None),
    is_online: Optional[bool] = Query(default=None),
    email_verified: Optional[bool] = Query(default=None),
    phone_verified: Optional[bool] = Query(default=None),
    city: Optional[list[str]] = Query(default=None),
    state: Optional[list[str]] = Query(default=None),
    pincode: Optional[str] = Query(default=None),
    collection_type: Optional[str] = Query(default=None),
    has_bookings: Optional[bool] = Query(default=None),
    report_status: Optional[str] = Query(default=None),
    registered_from: Optional[datetime] = Query(default=None),
    registered_to: Optional[datetime] = Query(default=None),
    last_login_from: Optional[datetime] = Query(default=None),
    last_login_to: Optional[datetime] = Query(default=None),
    last_active_from: Optional[datetime] = Query(default=None),
    last_active_to: Optional[datetime] = Query(default=None),
    min_spent: Optional[float] = Query(default=None),
    max_spent: Optional[float] = Query(default=None),
    sort: str = Query(default="created_at"),
    order: str = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> AdminUserListResponse:
    """Server-side filtered, sorted, paginated customer list with per-user aggregates."""
    # Backward compat: the old ?is_active=true/false param maps onto account_status.
    if account_status is None and is_active is not None:
        account_status = ["active"] if is_active else ["inactive", "blocked"]

    filters = _build_filters(
        q=q, role=role, account_status=account_status, is_online=is_online,
        email_verified=email_verified, phone_verified=phone_verified,
        city=city, state=state, pincode=pincode, collection_type=collection_type,
        has_bookings=has_bookings, report_status=report_status,
        registered_from=registered_from, registered_to=registered_to,
        last_login_from=last_login_from, last_login_to=last_login_to,
        last_active_from=last_active_from, last_active_to=last_active_to,
        min_spent=min_spent, max_spent=max_spent,
    )
    svc = AdminUserService(db)
    rows, total = await svc.list_users(filters, sort=sort, order=order, page=page, page_size=page_size)

    from app.services.storage_service import get_storage_backend

    storage = get_storage_backend()
    items: list[AdminUserRow] = []
    for row in rows:
        avatar_url = None
        if row["avatar_key"]:
            avatar_url = await storage.generate_signed_url(
                key=row["avatar_key"], report_id=row["id"], user_id=row["id"],
                file_name=row["avatar_key"].rsplit("/", 1)[-1],
            )
        items.append(AdminUserRow(avatar_url=avatar_url, **{k: v for k, v in row.items() if k != "avatar_key"}))

    return AdminUserListResponse(total=total, page=page, page_size=page_size, items=items)


@router.get("/users/stats")
async def user_stats(
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Dashboard summary cards + legacy fields (total/active/inactive/by_role)."""
    return await AdminUserService(db).get_stats()


@router.get("/users/export")
async def export_users(
    fmt: str = Query(default="csv", alias="format", pattern="^(csv|xlsx)$"),
    q: Optional[str] = Query(default=None),
    role: Optional[str] = Query(default=None),
    account_status: Optional[list[str]] = Query(default=None),
    is_online: Optional[bool] = Query(default=None),
    email_verified: Optional[bool] = Query(default=None),
    phone_verified: Optional[bool] = Query(default=None),
    city: Optional[list[str]] = Query(default=None),
    state: Optional[list[str]] = Query(default=None),
    pincode: Optional[str] = Query(default=None),
    collection_type: Optional[str] = Query(default=None),
    has_bookings: Optional[bool] = Query(default=None),
    report_status: Optional[str] = Query(default=None),
    min_spent: Optional[float] = Query(default=None),
    max_spent: Optional[float] = Query(default=None),
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> _Response:
    """Export the filtered user list as CSV or XLSX."""
    filters = _build_filters(
        q=q, role=role, account_status=account_status, is_online=is_online,
        email_verified=email_verified, phone_verified=phone_verified,
        city=city, state=state, pincode=pincode, collection_type=collection_type,
        has_bookings=has_bookings, report_status=report_status,
        min_spent=min_spent, max_spent=max_spent,
    )
    content, media_type, filename = await AdminUserService(db).export(filters, fmt)
    return _Response(
        content=content, media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── User detail + sub-resources ───────────────────────────────────────────────

@router.get("/users/{user_id}", response_model=AdminUserDetail)
async def get_user(
    user_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> AdminUserDetail:
    user = await _get_user_or_404(db, user_id)
    detail = await AdminUserService(db).get_detail(user)
    avatar_url = await _avatar_url(user)
    return AdminUserDetail(avatar_url=avatar_url, **{k: v for k, v in detail.items() if k != "avatar_key"})


@router.get("/users/{user_id}/bookings")
async def get_user_bookings(
    user_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    await _get_user_or_404(db, user_id)
    items, total = await AdminUserService(db).list_user_bookings(user_id, page, page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/users/{user_id}/payments")
async def get_user_payments(
    user_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    await _get_user_or_404(db, user_id)
    items, total = await AdminUserService(db).list_user_payments(user_id, page, page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/users/{user_id}/reports")
async def get_user_reports(
    user_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    await _get_user_or_404(db, user_id)
    from app.repositories.report_repository import ReportRepository
    from app.services.storage_service import get_storage_backend

    reports, total = await ReportRepository(db).list_by_user(user_id, page, page_size)
    storage = get_storage_backend()
    items = []
    for report, ref in reports:
        download_url = await storage.generate_signed_url(
            key=report.storage_key, report_id=report.id,
            user_id=uuid.UUID(current_user["user_id"]),
            file_name=f"{ref}.pdf" if ref else report.file_name,
        )
        items.append({
            "id": report.id,
            "booking_id": report.booking_id,
            "booking_reference": ref,
            "file_name": f"{ref}.pdf" if ref else report.file_name,
            "file_size_bytes": report.file_size_bytes,
            "uploaded_by": report.uploaded_by,
            "uploader_role": report.uploader_role,
            "uploaded_at": report.uploaded_at,
            "download_url": download_url,
        })
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/users/{user_id}/addresses", response_model=list[UserAddressOut])
async def get_user_addresses(
    user_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> list[UserAddressOut]:
    await _get_user_or_404(db, user_id)
    from app.repositories.address_repository import AddressRepository

    addresses = await AddressRepository(db).list_by_user(user_id)
    return [UserAddressOut.model_validate(a) for a in addresses]


@router.get("/users/{user_id}/family", response_model=list[FamilyMemberOut])
async def get_user_family(
    user_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> list[FamilyMemberOut]:
    await _get_user_or_404(db, user_id)
    from app.repositories.user_repository import FamilyMemberRepository

    members = await FamilyMemberRepository(db).list_by_user(user_id)
    return [FamilyMemberOut.model_validate(m) for m in members]


@router.get("/users/{user_id}/login-events", response_model=LoginActivityResponse)
async def get_user_login_events(
    user_id: uuid.UUID,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> LoginActivityResponse:
    await _get_user_or_404(db, user_id)
    from app.repositories.user_repository import LoginEventRepository

    repo = LoginEventRepository(db)
    events, total = await repo.list_by_user(user_id, limit=limit, offset=offset)
    ip_history = await repo.distinct_ips(user_id)
    return LoginActivityResponse(
        events=[
            LoginEventOut(
                id=e.id, event_type=e.event_type,
                ip_address=str(e.ip_address) if e.ip_address is not None else None,
                browser=e.browser, os=e.os, device_type=e.device_type, created_at=e.created_at,
            )
            for e in events
        ],
        total=total,
        ip_history=ip_history,
    )


@router.get("/users/{user_id}/audit-logs", response_model=AuditLogListResponse)
async def get_user_audit_logs(
    user_id: uuid.UUID,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> AuditLogListResponse:
    await _get_user_or_404(db, user_id)
    items, total = await AdminUserService(db).user_audit_logs(user_id, limit=limit, offset=offset)
    return AuditLogListResponse(
        total=total, limit=limit, offset=offset,
        items=[AuditLogOut.model_validate(i) for i in items],
    )


@router.get("/users/{user_id}/notes", response_model=list[AdminNoteOut])
async def get_user_notes(
    user_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> list[AdminNoteOut]:
    await _get_user_or_404(db, user_id)
    from app.repositories.user_repository import AdminNoteRepository

    notes = await AdminNoteRepository(db).list_by_user(user_id)
    # Resolve author names in one query.
    author_ids = list({n.author_id for n in notes})
    names: dict[uuid.UUID, str] = {}
    if author_ids:
        for uid, name in (
            await db.execute(select(User.id, User.name).where(User.id.in_(author_ids)))
        ).all():
            names[uid] = name
    return [
        AdminNoteOut(
            id=n.id, note=n.note, is_internal=n.is_internal,
            author_id=n.author_id, author_name=names.get(n.author_id), created_at=n.created_at,
        )
        for n in notes
    ]


@router.post("/users/{user_id}/notes", response_model=AdminNoteOut, status_code=201)
async def add_user_note(
    user_id: uuid.UUID,
    body: CreateNoteRequest,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> AdminNoteOut:
    await _get_user_or_404(db, user_id)
    from app.repositories.user_repository import AdminNoteRepository

    actor_id = uuid.UUID(current_user["user_id"])
    note = await AdminNoteRepository(db).create(
        user_id=user_id, author_id=actor_id, note=body.note, is_internal=body.is_internal
    )
    await audit(
        db, action_type="ADMIN_USER_NOTE_ADDED", entity_type="user", entity_id=str(user_id),
        outcome="success", actor_id=actor_id, actor_role="admin",
    )
    return AdminNoteOut(
        id=note.id, note=note.note, is_internal=note.is_internal,
        author_id=note.author_id, author_name=current_user.get("name"), created_at=note.created_at,
    )


@router.get("/users/{user_id}/export")
async def export_user_data(
    user_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    """Download a full JSON snapshot of a user's data (GDPR-style export)."""
    user = await _get_user_or_404(db, user_id)
    svc = AdminUserService(db)
    detail = await svc.get_detail(user)
    bookings, _ = await svc.list_user_bookings(user_id, page=1, page_size=1000)
    payments, _ = await svc.list_user_payments(user_id, page=1, page_size=1000)

    from app.repositories.address_repository import AddressRepository
    from app.repositories.user_repository import FamilyMemberRepository

    addresses = await AddressRepository(db).list_by_user(user_id)
    family = await FamilyMemberRepository(db).list_by_user(user_id)

    detail.pop("avatar_key", None)
    payload = {
        "profile": detail,
        "bookings": bookings,
        "payments": payments,
        "addresses": [UserAddressOut.model_validate(a).model_dump(mode="json") for a in addresses],
        "family": [FamilyMemberOut.model_validate(m).model_dump(mode="json") for m in family],
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }
    await audit(
        db, action_type="ADMIN_USER_DATA_EXPORTED", entity_type="user", entity_id=str(user_id),
        outcome="success", actor_id=uuid.UUID(current_user["user_id"]), actor_role="admin",
    )
    import json

    return JSONResponse(
        content=json.loads(json.dumps(payload, default=str)),
        headers={"Content-Disposition": f"attachment; filename=user_{user_id}.json"},
    )


# ── User actions ──────────────────────────────────────────────────────────────

@router.patch("/users/{user_id}")
async def update_user(
    user_id: uuid.UUID,
    body: UpdateUserRequest,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Edit a user's profile fields (admin)."""
    from app.repositories.user_repository import UserRepository

    user = await _get_user_or_404(db, user_id)
    fields = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None or k in body.model_fields_set}
    # Uniqueness guards for email/phone changes.
    repo = UserRepository(db)
    if body.email and body.email != user.email:
        existing = await repo.get_by_email(body.email)
        if existing and existing.id != user_id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"error_code": "EMAIL_TAKEN", "message": "Email already in use"})
    if body.phone and body.phone != user.phone:
        existing = await repo.get_by_phone(body.phone)
        if existing and existing.id != user_id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"error_code": "PHONE_TAKEN", "message": "Phone already in use"})
    await repo.update(user_id, **fields)
    await audit(
        db, action_type="ADMIN_USER_UPDATED", entity_type="user", entity_id=str(user_id),
        outcome="success", actor_id=uuid.UUID(current_user["user_id"]), actor_role="admin",
        metadata={"fields": list(fields.keys())},
    )
    return {"message": "User updated"}


@router.post("/users/{user_id}/avatar")
async def upload_user_avatar(
    user_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    user = await _get_user_or_404(db, user_id)
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"error_code": "INVALID_FILE", "message": "Avatar must be an image"})
    from app.repositories.user_repository import UserRepository
    from app.services.storage_service import get_storage_backend

    ext = (file.filename or "avatar").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "png"
    key = f"avatars/{user_id}/{uuid.uuid4()}.{ext}"
    storage = get_storage_backend()
    await storage.upload(await file.read(), key, file.content_type or "image/png")
    # Best-effort cleanup of the previous avatar.
    if user.avatar_key:
        try:
            await storage.delete(user.avatar_key)
        except Exception:
            pass
    await UserRepository(db).update(user_id, avatar_key=key)
    await audit(
        db, action_type="ADMIN_USER_AVATAR_UPDATED", entity_type="user", entity_id=str(user_id),
        outcome="success", actor_id=uuid.UUID(current_user["user_id"]), actor_role="admin",
    )
    avatar_url = await storage.generate_signed_url(key=key, report_id=user_id, user_id=user_id, file_name=key.rsplit("/", 1)[-1])
    return {"message": "Avatar updated", "avatar_url": avatar_url}


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Trigger a password-reset link for the user (reuses the forgot-password flow).

    Email-only: PasswordResetService sends a link via email, so a phone-only
    account (no email on file) has nothing this endpoint can deliver to.
    """
    user = await _get_user_or_404(db, user_id)
    if not user.email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"error_code": "NO_EMAIL", "message": "User has no email on file to send a reset link to"})
    from app.services.password_reset_service import PasswordResetService

    await PasswordResetService(db).forgot_password(user.email)
    await audit(
        db, action_type="ADMIN_USER_PASSWORD_RESET", entity_type="user", entity_id=str(user_id),
        outcome="success", actor_id=uuid.UUID(current_user["user_id"]), actor_role="admin",
    )
    return {"message": "Password reset initiated"}


@router.post("/users/{user_id}/verify-email")
async def verify_user_email(
    user_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.repositories.user_repository import UserRepository

    user = await _get_user_or_404(db, user_id)
    if not user.email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"error_code": "NO_EMAIL", "message": "User has no email"})
    await UserRepository(db).update(user_id, email_verified_at=datetime.now(timezone.utc))
    await audit(
        db, action_type="ADMIN_USER_EMAIL_VERIFIED", entity_type="user", entity_id=str(user_id),
        outcome="success", actor_id=uuid.UUID(current_user["user_id"]), actor_role="admin",
    )
    return {"message": "Email marked verified"}


@router.post("/users/{user_id}/verify-mobile")
async def verify_user_mobile(
    user_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.repositories.user_repository import UserRepository

    user = await _get_user_or_404(db, user_id)
    if not user.phone:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"error_code": "NO_PHONE", "message": "User has no phone"})
    await UserRepository(db).update(user_id, phone_verified_at=datetime.now(timezone.utc))
    await audit(
        db, action_type="ADMIN_USER_MOBILE_VERIFIED", entity_type="user", entity_id=str(user_id),
        outcome="success", actor_id=uuid.UUID(current_user["user_id"]), actor_role="admin",
    )
    return {"message": "Mobile marked verified"}


@router.patch("/users/{user_id}/tags")
async def set_user_tags(
    user_id: uuid.UUID,
    body: SetTagsRequest,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.repositories.user_repository import UserRepository

    await _get_user_or_404(db, user_id)
    cleaned = sorted({t.strip() for t in body.tags if t.strip()})
    await UserRepository(db).update(user_id, tags=cleaned)
    await audit(
        db, action_type="ADMIN_USER_TAGS_UPDATED", entity_type="user", entity_id=str(user_id),
        outcome="success", actor_id=uuid.UUID(current_user["user_id"]), actor_role="admin",
        metadata={"tags": cleaned},
    )
    return {"message": "Tags updated", "tags": cleaned}


@router.patch("/users/{user_id}/block")
async def block_user(
    user_id: uuid.UUID,
    body: BlockUserRequest,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Block a user: account_status='blocked', is_active=false, revoke tokens."""
    from app.repositories.user_repository import UserRepository

    await _get_user_or_404(db, user_id)
    await UserRepository(db).update(
        user_id, account_status="blocked", is_active=False,
        tokens_invalidated_at=datetime.now(timezone.utc),
    )
    await audit(
        db, action_type="ADMIN_USER_BLOCKED", entity_type="user", entity_id=str(user_id),
        outcome="success", actor_id=uuid.UUID(current_user["user_id"]), actor_role="admin",
        metadata={"reason": body.reason} if body.reason else None,
    )
    return {"message": "User blocked"}


@router.patch("/users/{user_id}/unblock")
async def unblock_user(
    user_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.repositories.user_repository import UserRepository

    await _get_user_or_404(db, user_id)
    await UserRepository(db).update(user_id, account_status="active", is_active=True)
    await audit(
        db, action_type="ADMIN_USER_UNBLOCKED", entity_type="user", entity_id=str(user_id),
        outcome="success", actor_id=uuid.UUID(current_user["user_id"]), actor_role="admin",
    )
    return {"message": "User unblocked"}


@router.post("/users/{user_id}/notify")
async def notify_user(
    user_id: uuid.UUID,
    body: NotifyUserRequest,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Enqueue a notification / email to the user across the requested channels."""
    await _get_user_or_404(db, user_id)
    from app.services.notification_service import NotificationService

    await NotificationService(db).enqueue(
        user_id=user_id, event_type=body.event_type, channels=list(body.channels)
    )
    await audit(
        db, action_type="ADMIN_USER_NOTIFIED", entity_type="user", entity_id=str(user_id),
        outcome="success", actor_id=uuid.UUID(current_user["user_id"]), actor_role="admin",
        metadata={"event_type": body.event_type, "channels": list(body.channels)},
    )
    return {"message": "Notification enqueued"}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Soft-delete a user and revoke their access."""
    from app.repositories.user_repository import SessionRepository, UserRepository

    await _get_user_or_404(db, user_id)
    repo = UserRepository(db)
    await repo.update(user_id, is_active=False, account_status="inactive", tokens_invalidated_at=datetime.now(timezone.utc))
    await SessionRepository(db).revoke_all_user_sessions(user_id)
    await repo.soft_delete(user_id)
    await audit(
        db, action_type="ADMIN_USER_DELETED", entity_type="user", entity_id=str(user_id),
        outcome="success", actor_id=uuid.UUID(current_user["user_id"]), actor_role="admin",
    )
    return {"message": "User deleted"}


@router.patch("/users/{user_id}/activate")
async def activate_user(
    user_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.repositories.user_repository import UserRepository

    await _get_user_or_404(db, user_id)
    await UserRepository(db).update(user_id, is_active=True, account_status="active")
    await audit(
        db, action_type="ADMIN_USER_ACTIVATED", entity_type="user", entity_id=str(user_id),
        outcome="success", actor_id=uuid.UUID(current_user["user_id"]), actor_role="admin",
    )
    return {"message": "User activated"}


@router.patch("/users/{user_id}/deactivate")
async def deactivate_user(
    user_id: uuid.UUID,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.repositories.user_repository import UserRepository

    await _get_user_or_404(db, user_id)
    # Cut off already-issued access tokens immediately rather than waiting out their TTL.
    await UserRepository(db).update(
        user_id, is_active=False, account_status="inactive",
        tokens_invalidated_at=datetime.now(timezone.utc),
    )
    await audit(
        db, action_type="ADMIN_USER_DEACTIVATED", entity_type="user", entity_id=str(user_id),
        outcome="success", actor_id=uuid.UUID(current_user["user_id"]), actor_role="admin",
    )
    return {"message": "User deactivated"}


@router.patch("/users/{user_id}/change-role")
async def change_user_role(
    user_id: uuid.UUID,
    body: ChangeUserRoleRequest,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Toggle a user's role between "user" (patient) and "technician".

    Converting to technician creates (or reactivates a previously soft-deleted)
    Technician profile linked to this user. Converting back soft-deletes it so they
    drop out of assignment pools immediately.
    """
    from app.models.service import Technician
    from app.repositories.technician_repository import TechnicianRepository

    user = await _get_user_or_404(db, user_id)
    if user.role == body.new_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "ROLE_UNCHANGED", "message": f"User already has role '{body.new_role}'"},
        )
    if user.role not in ("user", "technician"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error_code": "UNSUPPORTED_ROLE_CHANGE", "message": "Only user/technician roles can be toggled here"},
        )

    tech_repo = TechnicianRepository(db)
    if body.new_role == "technician":
        existing = (
            await db.execute(select(Technician).where(Technician.user_id == user_id))
        ).scalar_one_or_none()
        if existing is not None:
            existing.is_active = True
            existing.deleted_at = None
        else:
            await tech_repo.create(user_id=user.id, name=user.name, phone=user.phone or "", email=user.email or "")
        user.role = "technician"
    else:
        tech = await tech_repo.get_by_user_id(user_id)
        if tech is not None:
            await tech_repo.soft_delete(tech.id)
        user.role = "user"

    await db.commit()
    return {"message": f"User role changed to '{body.new_role}'"}


# ── Service requests ──────────────────────────────────────────────────────────

@router.get("/service-requests")
async def list_pending_service_requests(
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """Return pending service requests grouped by pincode."""
    result = await db.execute(select(ServiceRequest).where(ServiceRequest.notified_at.is_(None)))
    requests = result.scalars().all()
    grouped: dict[str, list] = defaultdict(list)
    for req in requests:
        grouped[req.pincode].append(ServiceRequestOut.model_validate(req))
    return [{"pincode": p, "count": len(r), "requests": r} for p, r in grouped.items()]


# ── Audit logs ────────────────────────────────────────────────────────────────

@router.get("/audit-logs", response_model=AuditLogListResponse)
async def list_audit_logs(
    actor_id: Optional[uuid.UUID] = None,
    action_type: Optional[str] = None,
    entity_type: Optional[str] = None,
    outcome: Optional[str] = None,
    from_dt: Optional[datetime] = None,
    to_dt: Optional[datetime] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> AuditLogListResponse:
    from app.repositories.audit_repository import AuditLogRepository

    repo = AuditLogRepository(db)
    items, total = await repo.query(
        actor_id=actor_id, action_type=action_type, entity_type=entity_type,
        outcome=outcome, from_dt=from_dt, to_dt=to_dt, limit=limit, offset=offset,
    )
    return AuditLogListResponse(
        total=total, limit=limit, offset=offset,
        items=[AuditLogOut.model_validate(i) for i in items],
    )


# ── Analytics ─────────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def admin_dashboard(
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.services.analytics_service import AnalyticsService

    return await AnalyticsService(db).get_dashboard_summary()


@router.get("/analytics")
async def admin_analytics(
    date_from: Optional[_date] = None,
    date_to: Optional[_date] = None,
    service_area_id: Optional[uuid.UUID] = None,
    category: Optional[str] = None,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from app.services.analytics_service import AnalyticsService

    return await AnalyticsService(db).get_analytics(
        date_from=date_from, date_to=date_to, service_area_id=service_area_id, category=category,
    )


@router.get("/analytics/export")
async def export_analytics_csv(
    date_from: Optional[_date] = None,
    date_to: Optional[_date] = None,
    current_user: dict = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db_session),
) -> _Response:
    from app.services.analytics_service import AnalyticsService

    csv_bytes = await AnalyticsService(db).export_csv(date_from=date_from, date_to=date_to)
    return _Response(
        content=csv_bytes, media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=analytics.csv"},
    )
