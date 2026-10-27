"""BookingService — business logic for booking management."""
from __future__ import annotations

import logging
import uuid
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.booking import Booking
from app.repositories.address_repository import AddressRepository
from app.repositories.booking_repository import BookingRepository
from app.repositories.package_repository import PackageRepository
from app.repositories.service_repository import ServiceAreaRepository
from app.repositories.settings_repository import SettingsRepository
from app.repositories.technician_repository import TechnicianRepository
from app.repositories.test_repository import TestRepository
from app.repositories.user_repository import FamilyMemberRepository

logger = logging.getLogger("sri.booking")


def _item_to_dict(item: object) -> dict:
    from app.models.booking import BookingItem
    i: BookingItem = item  # type: ignore[assignment]
    name = ""
    test_obj = getattr(i, "test", None)
    pkg_obj = getattr(i, "package", None)
    if test_obj is not None:
        name = getattr(test_obj, "name", "")
    elif pkg_obj is not None:
        name = getattr(pkg_obj, "name", "")
    return {
        "id": i.id,
        "booking_id": i.booking_id,
        "item_type": i.item_type,
        "item_name": name,
        "test_id": i.test_id,
        "package_id": i.package_id,
        "unit_price": float(i.unit_price),
    }


def _booking_to_dict(booking: Booking) -> dict:
    items = list(booking.items or [])
    total_amount = float(sum(float(i.unit_price) for i in items))
    return {
        "id": booking.id,
        "reference_number": booking.reference_number,
        "user_id": booking.user_id,
        "patient_id": booking.patient_id,
        "collection_type": booking.collection_type,
        "time_slot_id": booking.time_slot_id,
        "booking_date": booking.booking_date,
        "lab_branch_id": booking.lab_branch_id,
        "address_id": booking.address_id,
        "pincode": booking.pincode,
        "status": booking.status,
        "payment_status": booking.payment_status,
        "collected_at": booking.collected_at,
        "processing_started_at": booking.processing_started_at,
        "completed_at": booking.completed_at,
        "cancelled_at": booking.cancelled_at,
        "cancellation_reason": booking.cancellation_reason,
        "cancelled_by": booking.cancelled_by,
        "cancellation_fee": float(booking.cancellation_fee) if booking.cancellation_fee is not None else None,
        "cancellation_fee_type": booking.cancellation_fee_type,
        "technician_notes": booking.technician_notes,
        "total_amount": total_amount,
        "created_at": booking.created_at,
        "updated_at": booking.updated_at,
        "items": [_item_to_dict(i) for i in items],
    }


class BookingService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = BookingRepository(db)
        self.test_repo = TestRepository(db)
        self.package_repo = PackageRepository(db)
        self.service_area_repo = ServiceAreaRepository(db)
        self.address_repo = AddressRepository(db)
        self.family_member_repo = FamilyMemberRepository(db)
        self.settings_repo = SettingsRepository(db)
        self.technician_repo = TechnicianRepository(db)

    async def create_booking(
        self,
        user_id: uuid.UUID,
        patient_id: uuid.UUID | None,
        collection_type: str,
        time_slot_id: uuid.UUID,
        booking_date: date,
        lab_branch_id: uuid.UUID | None,
        pincode: str | None,
        test_ids: list[uuid.UUID],
        package_ids: list[uuid.UUID],
        address_id: uuid.UUID | None = None,
        coupon_code: str | None = None,
    ) -> dict:
        # Validate patient belongs to user
        if patient_id is not None:
            member = await self.family_member_repo.get_by_id(patient_id)
            if member is None or member.user_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error_code": "PATIENT_NOT_FOUND",
                        "message": "Patient not found or does not belong to this user",
                    },
                )

        # Validate at least one test or package
        if not test_ids and not package_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error_code": "NO_ITEMS",
                    "message": "At least one test or package is required",
                },
            )

        # Build items list
        items: list[dict] = []
        # A coupon discount (if the user applied one) is recorded as its own
        # adjustment line, not baked into unit_price, so it shows up on its
        # own on checkout and invoice.
        auto_adjustments: list[dict] = []
        package_prices: dict[uuid.UUID, float] = {}

        for test_id in test_ids:
            test = await self.test_repo.get_by_id(test_id)
            if test is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        "error_code": "TEST_NOT_FOUND",
                        "message": f"Test {test_id} not found or has been deleted",
                    },
                )
            effective_price = float(test.price) * (1 - float(test.discount_percentage) / 100)
            items.append(
                {
                    "item_type": "test",
                    "test_id": test_id,
                    "package_id": None,
                    "unit_price": round(effective_price, 2),
                }
            )

        for package_id in package_ids:
            pkg = await self.package_repo.get_by_id(package_id)
            if pkg is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        "error_code": "PACKAGE_NOT_FOUND",
                        "message": f"Package {package_id} not found or has been deleted",
                    },
                )
            unit_price = float(pkg.discounted_price)
            items.append(
                {
                    "item_type": "package",
                    "test_id": None,
                    "package_id": package_id,
                    "unit_price": unit_price,
                }
            )
            package_prices[package_id] = unit_price

        # Coupon (if the user applied one at checkout). Re-validated here from
        # scratch — never trust the earlier quote — and redeemed atomically
        # before the booking is created, inside the same transaction: a lost
        # usage-limit race raises here and nothing about this booking commits.
        coupon_id: uuid.UUID | None = None
        if coupon_code:
            from app.services.coupon_service import CouponService

            coupon_service = CouponService(self.db)
            result = await coupon_service.validate(coupon_code, package_ids, user_id)
            if not result["valid"]:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={"error_code": result["error_code"], "message": result["message"]},
                )
            coupon = result["coupon"]
            eligible_subtotal = sum(
                price for pid, price in package_prices.items() if pid in result["eligible_package_ids"]
            )
            discount_amount = coupon_service.compute_discount(coupon, eligible_subtotal)
            if discount_amount > 0:
                if not await coupon_service.redeem_atomic(coupon.id):
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail={
                            "error_code": "COUPON_USAGE_LIMIT_REACHED",
                            "message": "This coupon has just reached its usage limit",
                        },
                    )
                coupon_id = coupon.id
                auto_adjustments.append(
                    {"kind": "discount", "label": f"Coupon {coupon.code}", "amount": discount_amount}
                )

        # Validate home collection
        if collection_type == "home":
            if address_id is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        "error_code": "ADDRESS_REQUIRED",
                        "message": "A collection address is required for home collection",
                    },
                )

            # get_by_id already excludes soft-deleted addresses.
            address = await self.address_repo.get_by_id(address_id)
            if address is None or address.user_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error_code": "ADDRESS_NOT_FOUND",
                        "message": "Address not found or does not belong to this user",
                    },
                )

            # Derive the pincode from the chosen address rather than trusting the
            # client's: otherwise a serviceable pincode could be paired with an
            # address somewhere else entirely, and the technician gets sent there.
            pincode = address.pincode

            service_area = await self.service_area_repo.get_by_pincode(pincode)
            if service_area is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        "error_code": "SERVICE_AREA_NOT_FOUND",
                        "message": f"Home collection is not available for pincode {pincode}",
                    },
                )
        else:
            # A lab visit is collected at the branch; carrying an address would
            # only create a second, contradictory location on the booking.
            address_id = None

        # Money math comes from the billing engine (GST settings, not env),
        # so the pending payment row carries the same gross total the user was
        # quoted at checkout.
        from app.services.billing_service import BillingService

        totals = await BillingService(self.db).compute_totals(
            [item["unit_price"] for item in items], auto_adjustments
        )

        # Create booking atomically
        booking = await self.repo.create_booking_atomic(
            user_id=user_id,
            patient_id=patient_id,
            collection_type=collection_type,
            time_slot_id=time_slot_id,
            booking_date=booking_date,
            lab_branch_id=lab_branch_id,
            address_id=address_id,
            pincode=pincode,
            items=items,
            total_amount=totals["total"],
            gst_amount=totals["gst_amount"],
        )

        if auto_adjustments:
            from app.repositories.billing_repository import AdjustmentRepository

            adjustment_repo = AdjustmentRepository(self.db)
            for adj in auto_adjustments:
                await adjustment_repo.create(
                    booking_id=booking.id,
                    kind=adj["kind"],
                    label=adj["label"],
                    amount=adj["amount"],
                    source="coupon",
                    coupon_id=coupon_id,
                )

        logger.info(
            "booking_confirmed: booking_id=%s reference=%s user_id=%s",
            booking.id,
            booking.reference_number,
            user_id,
        )

        return _booking_to_dict(booking)

    async def get_booking(
        self,
        booking_id: uuid.UUID,
        requester_user_id: uuid.UUID,
        requester_role: str,
    ) -> dict:
        booking = await self.repo.get_by_id(booking_id)
        if booking is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "BOOKING_NOT_FOUND", "message": "Booking not found"},
            )
        if requester_role not in ("admin", "technician") and booking.user_id != requester_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error_code": "FORBIDDEN", "message": "Access denied"},
            )
        data = _booking_to_dict(booking)
        await self._enrich_detail(data, booking)
        return data

    async def _enrich_detail(self, data: dict, booking: Booking) -> None:
        """Augment a booking dict with patient, contact, address, slot, lab, payment,
        assigned technician, uploaded reports, refund status and full status-history
        timeline for the detail view."""
        from sqlalchemy import select
        from app.models.user import User, FamilyMember, UserAddress
        from app.models.service import TimeSlot, LabBranch, Technician, TechnicianAssignment
        from app.models.payment import Payment, Refund
        from app.models.booking import BookingStatusHistory
        from app.services.report_service import ReportService

        # ── Booking owner (contact) ──
        owner = (await self.db.execute(select(User).where(User.id == booking.user_id))).scalar_one_or_none()
        if owner is not None:
            data["contact_name"] = owner.name
            data["contact_phone"] = owner.phone
            data["contact_email"] = owner.email

        # ── Patient (family member, or the account holder when no patient_id) ──
        if booking.patient_id is not None:
            member = (await self.db.execute(select(FamilyMember).where(FamilyMember.id == booking.patient_id))).scalar_one_or_none()
            if member is not None:
                data["patient_name"] = member.name
                data["patient_gender"] = member.gender
                data["patient_relationship"] = member.relationship_type
        elif owner is not None:
            data["patient_name"] = owner.name
            data["patient_gender"] = owner.gender
            data["patient_relationship"] = "Self"

        # ── Address (the one this booking was actually placed for) ──
        if booking.collection_type == "home":
            if booking.address_id is not None:
                addr_q = select(UserAddress).where(UserAddress.id == booking.address_id)
            else:
                # Legacy rows (pre-0026) never recorded the chosen address, so the
                # best we can do is the default-address guess this used to apply to
                # every booking. New bookings always take the branch above.
                addr_q = (
                    select(UserAddress)
                    .where(UserAddress.user_id == booking.user_id, UserAddress.deleted_at.is_(None))
                    .order_by(UserAddress.is_default.desc(), UserAddress.created_at.desc())
                )
            addr = (await self.db.execute(addr_q)).scalars().first()
            if addr is not None:
                data["address"] = {
                    "label": addr.label,
                    "address_line1": addr.address_line1,
                    "address_line2": addr.address_line2,
                    "city": addr.city,
                    "state": addr.state,
                    "pincode": addr.pincode,
                }

        # ── Time slot ──
        slot = (await self.db.execute(select(TimeSlot).where(TimeSlot.id == booking.time_slot_id))).scalar_one_or_none()
        if slot is not None:
            data["time_slot"] = {
                "start_time": slot.start_time.strftime("%H:%M"),
                "end_time": slot.end_time.strftime("%H:%M"),
                "collection_type": slot.collection_type,
            }

        # ── Lab branch ──
        if booking.lab_branch_id is not None:
            branch = (await self.db.execute(select(LabBranch).where(LabBranch.id == booking.lab_branch_id))).scalar_one_or_none()
            if branch is not None:
                data["lab_branch"] = {
                    "name": branch.name,
                    "address": branch.address,
                    "city": branch.city,
                    "pincode": branch.pincode,
                    "phone": branch.phone,
                }

        # ── Payment ──
        payment = (await self.db.execute(select(Payment).where(Payment.booking_id == booking.id))).scalar_one_or_none()
        if payment is not None:
            data["payment"] = {
                "id": str(payment.id),
                "method": payment.method,
                "status": payment.status,
                "amount": float(payment.amount),
                "gst_amount": float(payment.gst_amount),
                "invoice_number": payment.invoice_number,
                "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
                "notes": payment.notes,
            }

            # ── Refund (latest, if any) ──
            refund = (
                await self.db.execute(
                    select(Refund)
                    .where(Refund.payment_id == payment.id)
                    .order_by(Refund.initiated_at.desc())
                )
            ).scalars().first()
            if refund is not None:
                data["refund"] = {
                    "id": str(refund.id),
                    "amount": float(refund.amount),
                    "reason": refund.reason,
                    "status": refund.status,
                    "gateway_refund_id": refund.gateway_refund_id,
                    "transaction_reference": refund.transaction_reference,
                    "remarks": refund.remarks,
                    "initiated_at": refund.initiated_at.isoformat() if refund.initiated_at else None,
                    "completed_at": refund.completed_at.isoformat() if refund.completed_at else None,
                }

        # ── Uploaded reports ──
        data["reports"] = await ReportService(self.db).list_by_booking(booking.id)

        # ── Assigned technician ──
        assignment = (
            await self.db.execute(
                select(TechnicianAssignment).where(TechnicianAssignment.booking_id == booking.id)
            )
        ).scalar_one_or_none()
        if assignment is not None:
            tech = (await self.db.execute(select(Technician).where(Technician.id == assignment.technician_id))).scalar_one_or_none()
            data["assigned_technician"] = {
                "id": str(assignment.technician_id),
                "name": tech.name if tech else None,
                "phone": tech.phone if tech else None,
                "assignment_status": assignment.status,
                "assigned_at": assignment.assigned_at.isoformat() if assignment.assigned_at else None,
            }

        # ── Status history timeline ──
        history_q = (
            select(BookingStatusHistory)
            .where(BookingStatusHistory.booking_id == booking.id)
            .order_by(BookingStatusHistory.changed_at.asc())
        )
        history = (await self.db.execute(history_q)).scalars().all()
        data["status_history"] = [
            {
                "from_status": h.from_status,
                "to_status": h.to_status,
                "reason": h.reason,
                "changed_at": h.changed_at.isoformat() if h.changed_at else None,
            }
            for h in history
        ]

    async def list_bookings(
        self,
        user_id: uuid.UUID,
        role: str,
        page: int,
        page_size: int,
        date_from: date | None = None,
        date_to: date | None = None,
        status: str | None = None,
        collection_type: str | None = None,
        technician_id: uuid.UUID | None = None,
        lab_branch_id: uuid.UUID | None = None,
        search: str | None = None,
    ) -> dict:
        if role == "admin":
            items, total = await self.repo.list_all(
                page=page,
                page_size=page_size,
                date_from=date_from,
                date_to=date_to,
                status=status,
                collection_type=collection_type,
                technician_id=technician_id,
                lab_branch_id=lab_branch_id,
                search=search,
            )
        else:
            items, total = await self.repo.list_by_user(
                user_id=user_id, page=page, page_size=page_size
            )
        dicts = [_booking_to_dict(b) for b in items]

        # Admins triage by customer and, for the calendar view, need the same
        # patient/schedule/technician detail the single-booking endpoint returns —
        # batched here (one query per related table) rather than per-row so a
        # month view listing hundreds of bookings stays cheap.
        if role == "admin" and dicts:
            from sqlalchemy import select as _select
            from app.models.user import User, FamilyMember
            from app.models.service import TimeSlot, LabBranch, Technician, TechnicianAssignment

            owner_ids = {b.user_id for b in items}
            owner_rows = await self.db.execute(
                _select(User.id, User.name, User.phone).where(User.id.in_(owner_ids))
            )
            owners = {r.id: (r.name, r.phone) for r in owner_rows}

            patient_ids = {b.patient_id for b in items if b.patient_id is not None}
            patients: dict = {}
            if patient_ids:
                patient_rows = await self.db.execute(
                    _select(FamilyMember.id, FamilyMember.name).where(FamilyMember.id.in_(patient_ids))
                )
                patients = {r.id: r.name for r in patient_rows}

            slot_ids = {b.time_slot_id for b in items if b.time_slot_id is not None}
            slots: dict = {}
            if slot_ids:
                slot_rows = await self.db.execute(_select(TimeSlot).where(TimeSlot.id.in_(slot_ids)))
                slots = {s.id: s for s in slot_rows.scalars().all()}

            branch_ids = {b.lab_branch_id for b in items if b.lab_branch_id is not None}
            branches: dict = {}
            if branch_ids:
                branch_rows = await self.db.execute(_select(LabBranch).where(LabBranch.id.in_(branch_ids)))
                branches = {b_.id: b_ for b_ in branch_rows.scalars().all()}

            booking_ids = {b.id for b in items}
            assignments_by_booking: dict = {}
            if booking_ids:
                assignment_rows = await self.db.execute(
                    _select(TechnicianAssignment).where(TechnicianAssignment.booking_id.in_(booking_ids))
                )
                assignments = list(assignment_rows.scalars().all())
                tech_ids = {a.technician_id for a in assignments}
                techs: dict = {}
                if tech_ids:
                    tech_rows = await self.db.execute(_select(Technician).where(Technician.id.in_(tech_ids)))
                    techs = {t.id: t for t in tech_rows.scalars().all()}
                for a in assignments:
                    tech = techs.get(a.technician_id)
                    assignments_by_booking[a.booking_id] = {
                        "id": str(a.technician_id),
                        "name": tech.name if tech else None,
                        "phone": tech.phone if tech else None,
                        "assignment_status": a.status,
                        "assigned_at": a.assigned_at.isoformat() if a.assigned_at else None,
                    }

            for b, d in zip(items, dicts):
                name, phone = owners.get(b.user_id, (None, None))
                d["contact_name"] = name
                d["contact_phone"] = phone
                d["patient_name"] = patients.get(b.patient_id) if b.patient_id is not None else name

                slot = slots.get(b.time_slot_id)
                if slot is not None:
                    d["time_slot"] = {
                        "start_time": slot.start_time.strftime("%H:%M"),
                        "end_time": slot.end_time.strftime("%H:%M"),
                        "collection_type": slot.collection_type,
                    }

                branch = branches.get(b.lab_branch_id)
                if branch is not None:
                    d["lab_branch"] = {
                        "name": branch.name,
                        "address": branch.address,
                        "city": branch.city,
                        "pincode": branch.pincode,
                        "phone": branch.phone,
                    }

                if b.id in assignments_by_booking:
                    d["assigned_technician"] = assignments_by_booking[b.id]

        return {
            "items": dicts,
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def _cancellation_quote(self, booking_id: uuid.UUID) -> dict:
        """What cancelling this booking costs and refunds, right now.

        The single source of truth for cancellation money: both the pre-confirm
        quote shown to the user and the actual charge applied on cancel call
        this, so the two can never disagree.

        Only a paid payment can be charged or refunded — a lab visit paying at
        the counter has nothing to deduct from, so it quotes zero.
        """
        from sqlalchemy import select

        from app.models.payment import Payment

        payment = (
            await self.db.execute(select(Payment).where(Payment.booking_id == booking_id))
        ).scalar_one_or_none()

        amount_paid = 0.0
        if payment is not None and payment.status == "paid":
            # payment.amount is the gross amount collected (GST inclusive);
            # adding gst_amount on top double-counted GST and inflated quotes.
            amount_paid = float(payment.amount)

        charge = 0.0
        fee_type: str | None = None
        charge_value: float | None = None
        setting = await self.settings_repo.get_active_cancellation_setting()

        if setting is not None and amount_paid > 0:
            charge_value = float(setting.charge_value)
            if str(setting.charge_type) == "percentage":
                charge = round(amount_paid * charge_value / 100, 2)
                fee_type = "percentage"
            else:
                charge = charge_value
                fee_type = "fixed"
            # A fixed fee can exceed what was actually paid. The refund already
            # floors at zero, so without this we would record (and quote) a fee
            # larger than the money we ever held.
            charge = min(charge, amount_paid)

        from app.services.billing_service import BillingService

        billing = await BillingService(self.db).get_settings()

        return {
            "amount_paid": round(amount_paid, 2),
            "cancellation_charge": round(charge, 2),
            "refund_amount": round(amount_paid - charge, 2),
            "fee_type": fee_type,
            "charge_value": charge_value,
            "has_charge": charge > 0,
            "payment_method": payment.method if payment is not None else None,
            "refund_eta_text": billing["refund_eta_text"],
        }

    async def get_cancellation_quote(
        self,
        booking_id: uuid.UUID,
        user_id: uuid.UUID,
        role: str,
    ) -> dict:
        """Read-only preview of the cancellation cost, for the confirm dialog."""
        booking = await self.repo.get_by_id(booking_id)
        if booking is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "BOOKING_NOT_FOUND", "message": "Booking not found"},
            )
        if role != "admin" and booking.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error_code": "FORBIDDEN", "message": "Access denied"},
            )

        quote = await self._cancellation_quote(booking_id)
        quote["collection_type"] = booking.collection_type
        return quote

    async def cancel_booking(
        self,
        booking_id: uuid.UUID,
        user_id: uuid.UUID,
        role: str,
        reason: str,
    ) -> dict:
        # Technicians cannot cancel bookings
        if role == "technician":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error_code": "FORBIDDEN", "message": "Technicians cannot cancel bookings"},
            )

        # Verify ownership unless admin
        if role != "admin":
            booking = await self.repo.get_by_id(booking_id)
            if booking is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"error_code": "BOOKING_NOT_FOUND", "message": "Booking not found"},
                )
            if booking.user_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"error_code": "FORBIDDEN", "message": "Access denied"},
                )

        # Same computation the user was quoted before confirming, so what they
        # were shown and what they are actually charged cannot drift apart.
        quote = await self._cancellation_quote(booking_id)
        charge = quote["cancellation_charge"]
        fee_type = quote["fee_type"]

        booking = await self.repo.cancel_booking(
            booking_id=booking_id,
            cancelled_by=user_id,
            cancellation_reason=reason,
            cancellation_charge=charge,
            cancellation_fee_type=fee_type,
            is_admin=(role == "admin"),
        )

        # Fire the gateway refund for online-paid bookings. Any gateway failure
        # leaves the refund row in 'initiated' with a remark for admin retry —
        # the cancellation itself is already committed and never rolls back.
        from app.services.payment_service import PaymentService

        await PaymentService(self.db).auto_refund_for_cancellation(booking_id)

        # Re-stamp the already-issued invoice PDF with "CANCELLED" so a
        # cancelled booking's bill can't be mistaken for a live one.
        from app.services.invoice_service import InvoiceService

        await InvoiceService(self.db).regenerate_for_booking(booking_id)

        logger.info(
            "booking_cancelled: booking_id=%s by user_id=%s role=%s charge=%.2f",
            booking_id, user_id, role, charge,
        )
        return _booking_to_dict(booking)

    async def reschedule_booking(
        self,
        booking_id: uuid.UUID,
        new_time_slot_id: uuid.UUID,
        new_booking_date: date,
        user_id: uuid.UUID,
        role: str,
    ) -> dict:
        if role not in ("admin",):
            booking = await self.repo.get_by_id(booking_id)
            if booking is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"error_code": "BOOKING_NOT_FOUND", "message": "Booking not found"},
                )
            if booking.user_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"error_code": "FORBIDDEN", "message": "Access denied"},
                )

        booking = await self.repo.reschedule_booking(
            booking_id=booking_id,
            new_time_slot_id=new_time_slot_id,
            new_booking_date=new_booking_date,
            rescheduled_by=user_id,
        )
        logger.info("booking_rescheduled: booking_id=%s by user_id=%s", booking_id, user_id)
        return _booking_to_dict(booking)

    async def update_booking_status(
        self,
        booking_id: uuid.UUID,
        new_status: str,
        changed_by_id: uuid.UUID,
        role: str,
        reason: str | None = None,
    ) -> dict:
        if role not in ("admin", "technician"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error_code": "FORBIDDEN", "message": "Access denied"},
            )
        if role == "technician":
            # Lab Visit bookings are performed by the patient at the lab — a field
            # technician must never drive their workflow (collect/complete/etc.).
            target = await self.repo.get_by_id(booking_id)
            if target is not None and target.collection_type == "lab":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error_code": "LAB_VISIT_NOT_ALLOWED",
                        "message": "This action is not allowed for Lab Visit bookings. The patient visits the laboratory.",
                    },
                )
            technician = await self.technician_repo.get_by_user_id(changed_by_id)
            assignment = (
                await self.technician_repo.get_assignment_by_booking(booking_id)
                if technician is not None
                else None
            )
            if technician is None or assignment is None or assignment.technician_id != technician.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error_code": "FORBIDDEN",
                        "message": "You are not assigned to this booking",
                    },
                )
        booking = await self.repo.update_status(
            booking_id=booking_id,
            new_status=new_status,
            changed_by=changed_by_id,
            is_admin=(role == "admin"),
            reason=reason,
        )
        # Enrich before returning: callers (e.g. the technician app) merge this
        # response straight into their local card model, and BookingOut declares
        # patient/contact/address/time_slot as optional — an un-enriched dict
        # would serialize those as null and wipe out the good values on merge.
        data = _booking_to_dict(booking)
        await self._enrich_detail(data, booking)
        return data
