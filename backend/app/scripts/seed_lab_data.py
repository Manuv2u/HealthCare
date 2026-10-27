"""
Seed lab branches, service areas, and time slots.

Usage (inside backend container or with DATABASE_URL set):
    python -m app.scripts.seed_lab_data

This script is idempotent — it skips entries that already exist by name/pincode.
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.models.service import LabBranch, ServiceArea, TimeSlot

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+asyncpg://sri:sri_secret@localhost:5432/sri_lab"
)

LAB_BRANCHES = [
    {
        "name": "Sri Health Plus - Anna Nagar",
        "address": "42, 3rd Avenue, Anna Nagar, Chennai",
        "city": "Chennai",
        "pincode": "600040",
        "phone": "044-26200001",
        "operating_hours": "Mon-Sat 7:00 AM – 8:00 PM, Sun 7:00 AM – 2:00 PM",
    },
    {
        "name": "Sri Health Plus - T. Nagar",
        "address": "18, Usman Road, T. Nagar, Chennai",
        "city": "Chennai",
        "pincode": "600017",
        "phone": "044-26200002",
        "operating_hours": "Mon-Sat 7:00 AM – 8:00 PM, Sun 7:00 AM – 2:00 PM",
    },
    {
        "name": "Sri Health Plus - Velachery",
        "address": "5, 100 Feet Road, Velachery, Chennai",
        "city": "Chennai",
        "pincode": "600042",
        "phone": "044-26200003",
        "operating_hours": "Mon-Sat 7:00 AM – 7:00 PM, Sun Closed",
    },
    {
        "name": "Sri Health Plus - Tambaram",
        "address": "22, GST Road, Tambaram, Chennai",
        "city": "Chennai",
        "pincode": "600045",
        "phone": "044-26200004",
        "operating_hours": "Mon-Sat 7:00 AM – 7:00 PM",
    },
]

SERVICE_AREAS = [
    {"state": "Tamil Nadu", "district": "Chennai", "taluk": "Aminjikarai", "city": "Anna Nagar", "area": "Anna Nagar West", "pincode": "600040"},
    {"state": "Tamil Nadu", "district": "Chennai", "taluk": "Mambalam", "city": "T. Nagar", "area": "Pondy Bazaar", "pincode": "600017"},
    {"state": "Tamil Nadu", "district": "Chennai", "taluk": "Sholinganallur", "city": "Velachery", "area": "Vijayanagar", "pincode": "600042"},
    {"state": "Tamil Nadu", "district": "Chengalpattu", "taluk": "Tambaram", "city": "Tambaram", "area": "East Tambaram", "pincode": "600045"},
    {"state": "Tamil Nadu", "district": "Chennai", "taluk": "Mylapore", "city": "Adyar", "area": "Gandhi Nagar", "pincode": "600020"},
    {"state": "Tamil Nadu", "district": "Chennai", "taluk": "Egmore", "city": "Nungambakkam", "area": "Sterling Road", "pincode": "600034"},
    {"state": "Tamil Nadu", "district": "Chennai", "taluk": "Ambattur", "city": "Porur", "area": "Ramapuram", "pincode": "600116"},
    {"state": "Tamil Nadu", "district": "Chennai", "taluk": "Perambur", "city": "Perambur", "area": "Jamalia", "pincode": "600011"},
    {"state": "Tamil Nadu", "district": "Chengalpattu", "taluk": "Tambaram", "city": "Chromepet", "area": "Hasthinapuram", "pincode": "600044"},
    {"state": "Tamil Nadu", "district": "Chennai", "taluk": "Sholinganallur", "city": "Sholinganallur", "area": "OMR", "pincode": "600119"},
]

# Time slots for both home and lab collection
TIME_SLOTS = [
    # Home collection slots
    {"start_time": "07:00", "end_time": "09:00", "collection_type": "home", "days_of_week": [0,1,2,3,4,5,6], "slot_capacity": 20},
    {"start_time": "09:00", "end_time": "11:00", "collection_type": "home", "days_of_week": [0,1,2,3,4,5,6], "slot_capacity": 20},
    {"start_time": "11:00", "end_time": "13:00", "collection_type": "home", "days_of_week": [0,1,2,3,4,5], "slot_capacity": 15},
    {"start_time": "14:00", "end_time": "16:00", "collection_type": "home", "days_of_week": [0,1,2,3,4,5], "slot_capacity": 15},
    {"start_time": "16:00", "end_time": "18:00", "collection_type": "home", "days_of_week": [0,1,2,3,4,5], "slot_capacity": 10},
    # Lab visit slots
    {"start_time": "07:00", "end_time": "08:00", "collection_type": "lab", "days_of_week": [0,1,2,3,4,5,6], "slot_capacity": 30},
    {"start_time": "08:00", "end_time": "09:00", "collection_type": "lab", "days_of_week": [0,1,2,3,4,5,6], "slot_capacity": 30},
    {"start_time": "09:00", "end_time": "10:00", "collection_type": "lab", "days_of_week": [0,1,2,3,4,5,6], "slot_capacity": 30},
    {"start_time": "10:00", "end_time": "11:00", "collection_type": "lab", "days_of_week": [0,1,2,3,4,5,6], "slot_capacity": 30},
    {"start_time": "11:00", "end_time": "12:00", "collection_type": "lab", "days_of_week": [0,1,2,3,4,5,6], "slot_capacity": 25},
    {"start_time": "12:00", "end_time": "13:00", "collection_type": "lab", "days_of_week": [0,1,2,3,4,5], "slot_capacity": 20},
    {"start_time": "14:00", "end_time": "15:00", "collection_type": "lab", "days_of_week": [0,1,2,3,4,5], "slot_capacity": 25},
    {"start_time": "15:00", "end_time": "16:00", "collection_type": "lab", "days_of_week": [0,1,2,3,4,5], "slot_capacity": 25},
    {"start_time": "16:00", "end_time": "17:00", "collection_type": "lab", "days_of_week": [0,1,2,3,4,5], "slot_capacity": 20},
    {"start_time": "17:00", "end_time": "18:00", "collection_type": "lab", "days_of_week": [0,1,2,3,4,5], "slot_capacity": 15},
]


async def seed_lab_branches(session: AsyncSession) -> None:
    print("── Seeding lab branches ────────────────────────────────────")
    for b in LAB_BRANCHES:
        existing = await session.execute(
            select(LabBranch).where(LabBranch.name == b["name"])
        )
        if existing.scalar_one_or_none():
            print(f"  SKIP (exists): {b['name']}")
            continue
        branch = LabBranch(
            id=uuid.uuid4(),
            name=b["name"],
            address=b["address"],
            city=b["city"],
            pincode=b["pincode"],
            phone=b["phone"],
            operating_hours=b["operating_hours"],
            is_active=True,
        )
        session.add(branch)
        print(f"  + {b['name']}")
    await session.flush()
    print()


async def seed_service_areas(session: AsyncSession) -> None:
    print("── Seeding service areas ───────────────────────────────────")
    for a in SERVICE_AREAS:
        existing = await session.execute(
            select(ServiceArea).where(ServiceArea.pincode == a["pincode"])
        )
        if existing.scalar_one_or_none():
            print(f"  SKIP (exists): {a['city']} {a['pincode']}")
            continue
        area = ServiceArea(
            id=uuid.uuid4(),
            state=a.get("state"),
            district=a["district"],
            taluk=a.get("taluk"),
            city=a["city"],
            area=a.get("area"),
            pincode=a["pincode"],
            is_active=True,
        )
        session.add(area)
        print(f"  + {a['city']} ({a['pincode']})")
    await session.flush()
    print()


async def seed_time_slots(session: AsyncSession) -> None:
    print("── Seeding time slots ──────────────────────────────────────")
    from datetime import time as dtime
    for s in TIME_SLOTS:
        start_h, start_m = map(int, s["start_time"].split(":"))
        end_h, end_m = map(int, s["end_time"].split(":"))
        start = dtime(start_h, start_m)
        end = dtime(end_h, end_m)
        existing = await session.execute(
            select(TimeSlot).where(
                TimeSlot.start_time == start,
                TimeSlot.end_time == end,
                TimeSlot.collection_type == s["collection_type"],
            )
        )
        if existing.scalar_one_or_none():
            print(f"  SKIP (exists): {s['start_time']}-{s['end_time']} [{s['collection_type']}]")
            continue
        slot = TimeSlot(
            id=uuid.uuid4(),
            start_time=start,
            end_time=end,
            collection_type=s["collection_type"],
            days_of_week=s["days_of_week"],
            slot_capacity=s["slot_capacity"],
            is_active=True,
        )
        session.add(slot)
        print(f"  + {s['start_time']}-{s['end_time']} [{s['collection_type']}] cap={s['slot_capacity']}")
    await session.flush()
    print()


async def main() -> None:
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        await seed_lab_branches(session)
        await seed_service_areas(session)
        await seed_time_slots(session)
        await session.commit()

    await engine.dispose()
    print("── Done ────────────────────────────────────────────────────")
    print(f"  Lab branches : {len(LAB_BRANCHES)}")
    print(f"  Service areas: {len(SERVICE_AREAS)}")
    print(f"  Time slots   : {len(TIME_SLOTS)}")


if __name__ == "__main__":
    asyncio.run(main())
