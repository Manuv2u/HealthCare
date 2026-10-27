"""BookingRepository — atomic booking operations."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.booking import Booking, BookingItem, BookingSlotCount, BookingStatusHistory
from app.models.payment import Payment, Refund
from app.models.report import Report
from app.models.service import TimeSlot
from app.utils import timezone as lab_tz


# Valid state machine transitions (technician/sequential flow)
# Admin can bypass these and set any status
_VALID_TRANSITIONS: dict[str, list[str]] = {
    "booked": ["technician_assigned", "cancelled"],
    "technician_assigned": ["accepted", "on_the_way", "cancelled"],
    "accepted": ["on_the_way", "cancelled"],
    "on_the_way": ["sample_collected", "unable_to_collect"],
    # "completed" was previously reachable directly from here, letting a booking
    # skip report_ready entirely — a report must exist before completion (see
    # the REPORT_REQUIRED check in update_status), so the only forward path is
    # through the lab-processing steps below.
    "sample_collected": ["reached_lab"],
    "reached_lab": ["sample_delivered"],
    "sample_delivered": ["processing"],
    "processing": ["report_ready"],
    "report_ready": ["completed"],
    # Technician could not collect the sample — terminal, admin may reassign
    "unable_to_collect": ["technician_assigned", "cancelled"],
    # Legacy statuses for backwards compatibility
    "collected": ["processing"],
    "completed": [],
    "cancelled": [],
}

# Statuses from which user cancellation is allowed
_CANCELLABLE_STATUSES = {"booked", "technician_assigned", "accepted"}

# Timestamp field to set per status
_TRANSITION_TIMESTAMPS: dict[str, str] = {
    "sample_collected": "collected_at",
    "collected": "collected_at",
    "processing": "processing_started_at",
    "completed": "completed_at",
    "cancelled": "cancelled_at",
}

ALL_VALID_STATUSES = {
    "booked", "technician_assigned", "accepted", "on_the_way",
    "sample_collected", "reached_lab", "sample_delivered",
    "processing", "report_ready", "completed", "cancelled",
    "unable_to_collect",
    # legacy
    "collected",
}


class BookingRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── helpers ──────────────────────────────────────────────────────────────

    async def _get_booking_with_items(self, booking_id: uuid.UUID) -> Booking | None:
        result = await self.db.execute(
            select(Booking)
            .options(selectinload(Booking.items))
            .where(Booking.id == booking_id)
        )
        return result.scalar_one_or_none()

    async def _get_slot(self, time_slot_id: uuid.UUID) -> TimeSlot | None:
        result = await self.db.execute(
            select(TimeSlot).where(TimeSlot.id == time_slot_id)
        )
        return result.scalar_one_or_none()

    async def _check_cancellation_window(
        self, booking: Booking, slot: TimeSlot
    ) -> None:
        """Raise 422 if the booking is within 2 hours of the slot start."""
        slot_dt = lab_tz.to_utc(booking.booking_date, slot.start_time)
        if datetime.now(timezone.utc) + timedelta(hours=2) >= slot_dt:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error_code": "CANCELLATION_WINDOW_EXPIRED",
                    "message": "Cancellation/reschedule must be at least 2 hours before the slot",
                },
            )

    # ── create ────────────────────────────────────────────────────────────────

    async def create_booking_atomic(
        self,
        user_id: uuid.UUID,
        patient_id: uuid.UUID | None,
        collection_type: str,
        time_slot_id: uuid.UUID,
        booking_date: date,
        lab_branch_id: uuid.UUID | None,
        pincode: str | None,
        items: list[dict],
        total_amount: float | None = None,
        gst_amount: float = 0.0,
        address_id: uuid.UUID | None = None,
    ) -> Booking:
        """
        Atomically create a booking with slot capacity enforcement.
        Uses SELECT FOR UPDATE on booking_slot_counts.
        """
        # Lock the slot count row (or create it)
        result = await self.db.execute(
            text(
                "SELECT confirmed_count FROM booking_slot_counts "
                "WHERE time_slot_id = :ts_id AND booking_date = :bd "
                "FOR UPDATE"
            ),
            {"ts_id": str(time_slot_id), "bd": booking_date},
        )
        row = result.fetchone()

        if row is None:
            await self.db.execute(
                text(
                    "INSERT INTO booking_slot_counts (time_slot_id, booking_date, confirmed_count) "
                    "VALUES (:ts_id, :bd, 0) "
                    "ON CONFLICT (time_slot_id, booking_date) DO NOTHING"
                ),
                {"ts_id": str(time_slot_id), "bd": booking_date},
            )
            result = await self.db.execute(
                text(
                    "SELECT confirmed_count FROM booking_slot_counts "
                    "WHERE time_slot_id = :ts_id AND booking_date = :bd "
                    "FOR UPDATE"
                ),
                {"ts_id": str(time_slot_id), "bd": booking_date},
            )
            row = result.fetchone()

        confirmed_count = row[0]

        # Check capacity
        slot_result = await self.db.execute(
            select(TimeSlot).where(TimeSlot.id == time_slot_id)
        )
        slot = slot_result.scalar_one_or_none()
        if slot is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "SLOT_NOT_FOUND", "message": "Time slot not found"},
            )

        if lab_tz.to_utc(booking_date, slot.start_time) <= datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error_code": "SLOT_IN_PAST",
                    "message": "This time slot has already passed and can no longer be booked",
                },
            )

        if confirmed_count >= slot.slot_capacity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error_code": "SLOT_CAPACITY_EXCEEDED",
                    "message": "No available capacity for the selected time slot",
                },
            )

        # Increment slot count
        await self.db.execute(
            text(
                "UPDATE booking_slot_counts SET confirmed_count = confirmed_count + 1 "
                "WHERE time_slot_id = :ts_id AND booking_date = :bd"
            ),
            {"ts_id": str(time_slot_id), "bd": booking_date},
        )

        # Generate reference number
        ref_result = await self.db.execute(
            text(
                "SELECT 'SRI-' || EXTRACT(YEAR FROM NOW())::text || '-' || "
                "LPAD(nextval('booking_reference_seq')::text, 6, '0')"
            )
        )
        reference_number: str = ref_result.scalar_one()

        # Insert booking
        booking_id = uuid.uuid4()
        booking = Booking(
            id=booking_id,
            reference_number=reference_number,
            user_id=user_id,
            patient_id=patient_id,
            collection_type=collection_type,
            time_slot_id=time_slot_id,
            booking_date=booking_date,
            lab_branch_id=lab_branch_id,
            address_id=address_id,
            pincode=pincode,
            status="booked",
            payment_status="pending",
        )
        self.db.add(booking)
        await self.db.flush()

        # Insert booking items
        items_subtotal = 0.0
        for item in items:
            bi = BookingItem(
                id=uuid.uuid4(),
                booking_id=booking_id,
                item_type=item["item_type"],
                test_id=item.get("test_id"),
                package_id=item.get("package_id"),
                unit_price=item["unit_price"],
            )
            self.db.add(bi)
            items_subtotal += float(item["unit_price"])

        await self.db.flush()

        # Insert payment. `amount` is the gross bill (GST inclusive) as computed
        # by the billing engine; callers that don't pass totals get the plain
        # item subtotal with no GST (used by tests exercising slot logic only).
        payment = Payment(
            id=uuid.uuid4(),
            booking_id=booking_id,
            method="pending",
            status="pending",
            amount=total_amount if total_amount is not None else items_subtotal,
            gst_amount=gst_amount,
        )
        self.db.add(payment)

        # Insert status history
        history = BookingStatusHistory(
            id=uuid.uuid4(),
            booking_id=booking_id,
            from_status=None,
            to_status="booked",
            changed_by=user_id,
            changed_at=datetime.now(timezone.utc),
        )
        self.db.add(history)

        await self.db.flush()
        await self.db.refresh(booking)

        return await self._get_booking_with_items(booking_id)  # type: ignore[return-value]

    # ── read ──────────────────────────────────────────────────────────────────

    async def get_by_id(self, booking_id: uuid.UUID) -> Booking | None:
        return await self._get_booking_with_items(booking_id)

    async def list_by_user(
        self,
        user_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Booking], int]:
        count_result = await self.db.execute(
            select(func.count()).where(Booking.user_id == user_id)
        )
        total = count_result.scalar_one()

        offset = (page - 1) * page_size
        result = await self.db.execute(
            select(Booking)
            .options(selectinload(Booking.items))
            .where(Booking.user_id == user_id)
            .order_by(Booking.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        return list(result.scalars().all()), total

    async def list_all(
        self,
        page: int = 1,
        page_size: int = 20,
        date_from: date | None = None,
        date_to: date | None = None,
        status: str | None = None,
        collection_type: str | None = None,
        technician_id: uuid.UUID | None = None,
        lab_branch_id: uuid.UUID | None = None,
        search: str | None = None,
    ) -> tuple[list[Booking], int]:
        from app.models.service import TechnicianAssignment
        from app.models.user import FamilyMember, User

        conditions = []
        if date_from is not None:
            conditions.append(Booking.booking_date >= date_from)
        if date_to is not None:
            conditions.append(Booking.booking_date <= date_to)
        if status:
            conditions.append(Booking.status == status)
        if collection_type:
            conditions.append(Booking.collection_type == collection_type)
        if lab_branch_id:
            conditions.append(Booking.lab_branch_id == lab_branch_id)

        base_query = select(Booking.id)
        count_query = select(func.count(func.distinct(Booking.id))).select_from(Booking)

        if technician_id:
            base_query = base_query.join(
                TechnicianAssignment, TechnicianAssignment.booking_id == Booking.id
            )
            count_query = count_query.join(
                TechnicianAssignment, TechnicianAssignment.booking_id == Booking.id
            )
            conditions.append(TechnicianAssignment.technician_id == technician_id)

        if search:
            term = f"%{search.strip()}%"
            base_query = base_query.outerjoin(User, User.id == Booking.user_id).outerjoin(
                FamilyMember, FamilyMember.id == Booking.patient_id
            )
            count_query = count_query.outerjoin(User, User.id == Booking.user_id).outerjoin(
                FamilyMember, FamilyMember.id == Booking.patient_id
            )
            conditions.append(
                (Booking.reference_number.ilike(term))
                | (User.name.ilike(term))
                | (User.phone.ilike(term))
                | (FamilyMember.name.ilike(term))
            )

        for cond in conditions:
            base_query = base_query.where(cond)
            count_query = count_query.where(cond)

        count_result = await self.db.execute(count_query)
        total = count_result.scalar_one()

        offset = (page - 1) * page_size
        id_result = await self.db.execute(
            base_query.order_by(Booking.created_at.desc()).offset(offset).limit(page_size)
        )
        ids = [row[0] for row in id_result.all()]
        if not ids:
            return [], total

        result = await self.db.execute(
            select(Booking)
            .options(selectinload(Booking.items))
            .where(Booking.id.in_(ids))
            .order_by(Booking.created_at.desc())
        )
        return list(result.scalars().all()), total

    # ── cancel ────────────────────────────────────────────────────────────────

    async def cancel_booking(
        self,
        booking_id: uuid.UUID,
        cancelled_by: uuid.UUID,
        cancellation_reason: str,
        cancellation_charge: float = 0.0,
        cancellation_fee_type: str | None = None,
        is_admin: bool = False,
    ) -> Booking:
        booking = await self._get_booking_with_items(booking_id)
        if booking is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "BOOKING_NOT_FOUND", "message": "Booking not found"},
            )
        if booking.status not in _CANCELLABLE_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error_code": "INVALID_STATUS_TRANSITION",
                    "message": f"Cannot cancel a booking with status '{booking.status}'",
                },
            )

        slot = await self._get_slot(booking.time_slot_id)
        if slot and not is_admin:
            await self._check_cancellation_window(booking, slot)

        now = datetime.now(timezone.utc)
        update_values: dict = {
            "status": "cancelled",
            "cancelled_at": now,
            "cancellation_reason": cancellation_reason,
            "cancelled_by": cancelled_by,
        }
        if cancellation_charge > 0:
            update_values["cancellation_fee"] = cancellation_charge
            update_values["cancellation_fee_type"] = cancellation_fee_type or "fixed"

        await self.db.execute(
            update(Booking).where(Booking.id == booking_id).values(**update_values)
        )

        # Decrement slot count
        await self.db.execute(
            text(
                "UPDATE booking_slot_counts SET confirmed_count = GREATEST(confirmed_count - 1, 0) "
                "WHERE time_slot_id = :ts_id AND booking_date = :bd"
            ),
            {"ts_id": str(booking.time_slot_id), "bd": booking.booking_date},
        )

        # Handle refund if there was a payment
        if cancellation_charge >= 0:
            payment_result = await self.db.execute(
                select(Payment).where(Payment.booking_id == booking_id)
            )
            payment = payment_result.scalar_one_or_none()
            if payment and payment.status == "paid":
                # payment.amount is the gross amount collected (GST inclusive) —
                # adding gst_amount here would double-count GST and inflate the refund.
                total_paid = float(payment.amount)
                refund_amount = max(total_paid - cancellation_charge, 0.0)
                charge_desc = f"Cancellation charge: ₹{cancellation_charge:.2f}" if cancellation_charge > 0 else "Full refund"
                # A cancellation charge that consumes the whole payment leaves
                # nothing to refund — record it as already-completed (audit
                # trail only) rather than "initiated", so it never reaches the
                # gateway or shows up as an actionable item for admins.
                is_nothing_to_refund = refund_amount <= 0
                refund = Refund(
                    id=uuid.uuid4(),
                    payment_id=payment.id,
                    amount=refund_amount,
                    reason=f"Booking cancelled. {charge_desc}",
                    status="completed" if is_nothing_to_refund else "initiated",
                    initiated_by=cancelled_by,
                    initiated_at=now,
                    completed_at=now if is_nothing_to_refund else None,
                    remarks="Cancellation charge covered the full payment — nothing to refund." if is_nothing_to_refund else None,
                )
                self.db.add(refund)

        # Status history
        self.db.add(
            BookingStatusHistory(
                id=uuid.uuid4(),
                booking_id=booking_id,
                from_status=booking.status,
                to_status="cancelled",
                changed_by=cancelled_by,
                changed_at=now,
                reason=cancellation_reason,
            )
        )
        await self.db.flush()
        return await self._get_booking_with_items(booking_id)  # type: ignore[return-value]

    # ── reschedule ────────────────────────────────────────────────────────────

    async def reschedule_booking(
        self,
        booking_id: uuid.UUID,
        new_time_slot_id: uuid.UUID,
        new_booking_date: date,
        rescheduled_by: uuid.UUID,
    ) -> Booking:
        booking = await self._get_booking_with_items(booking_id)
        if booking is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "BOOKING_NOT_FOUND", "message": "Booking not found"},
            )
        if booking.status != "booked":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error_code": "INVALID_STATUS_TRANSITION",
                    "message": f"Cannot reschedule a booking with status '{booking.status}'",
                },
            )

        old_slot = await self._get_slot(booking.time_slot_id)
        if old_slot:
            await self._check_cancellation_window(booking, old_slot)

        # Lock new slot count
        result = await self.db.execute(
            text(
                "SELECT confirmed_count FROM booking_slot_counts "
                "WHERE time_slot_id = :ts_id AND booking_date = :bd FOR UPDATE"
            ),
            {"ts_id": str(new_time_slot_id), "bd": new_booking_date},
        )
        row = result.fetchone()

        if row is None:
            await self.db.execute(
                text(
                    "INSERT INTO booking_slot_counts (time_slot_id, booking_date, confirmed_count) "
                    "VALUES (:ts_id, :bd, 0) ON CONFLICT (time_slot_id, booking_date) DO NOTHING"
                ),
                {"ts_id": str(new_time_slot_id), "bd": new_booking_date},
            )
            result = await self.db.execute(
                text(
                    "SELECT confirmed_count FROM booking_slot_counts "
                    "WHERE time_slot_id = :ts_id AND booking_date = :bd FOR UPDATE"
                ),
                {"ts_id": str(new_time_slot_id), "bd": new_booking_date},
            )
            row = result.fetchone()

        new_slot_result = await self.db.execute(
            select(TimeSlot).where(TimeSlot.id == new_time_slot_id)
        )
        new_slot = new_slot_result.scalar_one_or_none()
        if new_slot is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "SLOT_NOT_FOUND", "message": "New time slot not found"},
            )

        if lab_tz.to_utc(new_booking_date, new_slot.start_time) <= datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error_code": "SLOT_IN_PAST",
                    "message": "This time slot has already passed and can no longer be booked",
                },
            )

        if row[0] >= new_slot.slot_capacity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error_code": "SLOT_CAPACITY_EXCEEDED",
                    "message": "No available capacity for the new time slot",
                },
            )

        # Decrement old slot count
        await self.db.execute(
            text(
                "UPDATE booking_slot_counts SET confirmed_count = GREATEST(confirmed_count - 1, 0) "
                "WHERE time_slot_id = :ts_id AND booking_date = :bd"
            ),
            {"ts_id": str(booking.time_slot_id), "bd": booking.booking_date},
        )

        # Increment new slot count
        await self.db.execute(
            text(
                "UPDATE booking_slot_counts SET confirmed_count = confirmed_count + 1 "
                "WHERE time_slot_id = :ts_id AND booking_date = :bd"
            ),
            {"ts_id": str(new_time_slot_id), "bd": new_booking_date},
        )

        now = datetime.now(timezone.utc)
        await self.db.execute(
            update(Booking)
            .where(Booking.id == booking_id)
            .values(
                time_slot_id=new_time_slot_id,
                booking_date=new_booking_date,
                status="booked",
            )
        )

        self.db.add(
            BookingStatusHistory(
                id=uuid.uuid4(),
                booking_id=booking_id,
                from_status="booked",
                to_status="booked",
                changed_by=rescheduled_by,
                changed_at=now,
                reason="Booking rescheduled",
            )
        )
        await self.db.flush()
        return await self._get_booking_with_items(booking_id)  # type: ignore[return-value]

    # ── update status ─────────────────────────────────────────────────────────

    async def update_status(
        self,
        booking_id: uuid.UUID,
        new_status: str,
        changed_by: uuid.UUID,
        is_admin: bool = False,
        reason: str | None = None,
    ) -> Booking:
        booking = await self._get_booking_with_items(booking_id)
        if booking is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "BOOKING_NOT_FOUND", "message": "Booking not found"},
            )

        if new_status not in ALL_VALID_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error_code": "INVALID_STATUS",
                    "message": f"'{new_status}' is not a valid booking status",
                },
            )

        # Admins can force any status transition; others must follow the state machine
        if not is_admin:
            valid_next = _VALID_TRANSITIONS.get(booking.status, [])
            if new_status not in valid_next:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        "error_code": "INVALID_STATUS_TRANSITION",
                        "message": (
                            f"Cannot transition from '{booking.status}' to '{new_status}'. "
                            f"Valid next: {valid_next}"
                        ),
                    },
                )

        # A booking can never be completed without an uploaded report — enforced
        # here (not only in BookingService) so there is no bypass path, including
        # for admins. report_service.upload_report() calls this method directly
        # for its own "report_ready" transition, so this is the single choke point.
        if new_status == "completed":
            report_count_result = await self.db.execute(
                select(func.count()).select_from(Report).where(Report.booking_id == booking_id)
            )
            if report_count_result.scalar_one() == 0:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        "error_code": "REPORT_REQUIRED",
                        "message": "A report must be uploaded before this booking can be completed",
                    },
                )

        now = datetime.now(timezone.utc)
        update_values: dict = {"status": new_status}
        ts_field = _TRANSITION_TIMESTAMPS.get(new_status)
        if ts_field:
            update_values[ts_field] = now

        await self.db.execute(
            update(Booking).where(Booking.id == booking_id).values(**update_values)
        )

        # Re-assigning/re-confirming the same status (e.g. clicking "Assign
        # Technician" again) must not pile up duplicate timeline entries —
        # update the existing most-recent entry for this status in place.
        latest_history = None
        if booking.status == new_status:
            latest_history_result = await self.db.execute(
                select(BookingStatusHistory)
                .where(BookingStatusHistory.booking_id == booking_id)
                .order_by(BookingStatusHistory.changed_at.desc())
                .limit(1)
            )
            latest_history = latest_history_result.scalar_one_or_none()

        if latest_history is not None and latest_history.to_status == new_status:
            latest_history.changed_by = changed_by
            latest_history.changed_at = now
            latest_history.reason = reason
        else:
            self.db.add(
                BookingStatusHistory(
                    id=uuid.uuid4(),
                    booking_id=booking_id,
                    from_status=booking.status,
                    to_status=new_status,
                    changed_by=changed_by,
                    changed_at=now,
                    reason=reason,
                )
            )
        await self.db.flush()
        return await self._get_booking_with_items(booking_id)  # type: ignore[return-value]

    # ── payment sync ─────────────────────────────────────────────────────────

    async def sync_payment_status(self, booking_id: uuid.UUID, payment_status: str) -> None:
        """Mirror a Payment's status onto its Booking.payment_status.

        Payment.status and Booking.payment_status are two separate columns;
        nothing previously kept them in sync (a paid Payment could sit next to
        a Booking still reporting payment_status="pending" forever). This is
        the single place that should be called whenever a payment is confirmed.
        """
        await self.db.execute(
            update(Booking).where(Booking.id == booking_id).values(payment_status=payment_status)
        )
        await self.db.flush()
