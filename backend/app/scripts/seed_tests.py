"""
Reset & seed script for Sri Health Plus, a diagnostic laboratory & health care platform.

Usage (inside backend container or with DATABASE_URL set):
    python -m app.scripts.seed_tests [--reset]

    --reset   Truncate all data tables before seeding (keeps schema intact).
              Without this flag, existing tests/packages are skipped (upsert-safe).
"""
from __future__ import annotations

import asyncio
import sys
import os
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.models.test import Package, PackageTest, Test

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+asyncpg://sri:sri_secret@localhost:5432/sri_lab"
)

# ── Truncation order (leaf → root to respect FK constraints) ─────────────────
TRUNCATE_ORDER = [
    "bookings_archive",
    "payments_archive",
    "audit_logs",
    "notifications",
    "refunds",
    "reports",
    "technician_assignments",
    "booking_status_history",
    "booking_slot_counts",
    "booking_items",
    "bookings",
    "payments",
    "service_requests",
    "technician_service_areas",
    "technicians",
    "family_members",
    "sessions",
    "feature_flags",
    "package_tests",
    "packages",
    "tests",
    # Keep users last — admin is re-seeded by app startup, not here
    # Uncomment below only if you want to wipe users too:
    # "users",
]

# ── 25 Realistic Tests ────────────────────────────────────────────────────────
TESTS: list[dict] = [
    # ── Haematology ──────────────────────────────────────────────────────────
    {
        "name": "Complete Blood Count (CBC)",
        "category": "Haematology",
        "description": "Measures RBC, WBC, haemoglobin, haematocrit and platelets. Essential for detecting anaemia, infection and blood disorders.",
        "price": 350,
        "discount_percentage": 10,
        "turnaround_hours": 6,
    },
    {
        "name": "Erythrocyte Sedimentation Rate (ESR)",
        "category": "Haematology",
        "description": "Non-specific marker of inflammation, infection and autoimmune conditions. Often ordered alongside CRP.",
        "price": 150,
        "discount_percentage": 0,
        "turnaround_hours": 4,
    },
    {
        "name": "Peripheral Blood Smear",
        "category": "Haematology",
        "description": "Microscopic examination of blood cell morphology to detect malaria parasites, abnormal cells and platelet clumping.",
        "price": 280,
        "discount_percentage": 0,
        "turnaround_hours": 8,
    },
    # ── Biochemistry ─────────────────────────────────────────────────────────
    {
        "name": "Blood Sugar Fasting (BSF)",
        "category": "Diabetes",
        "description": "Measures plasma glucose after a minimum 8-hour fast. Primary screening test for Type 2 diabetes and pre-diabetes.",
        "price": 120,
        "discount_percentage": 0,
        "turnaround_hours": 4,
    },
    {
        "name": "HbA1c (Glycated Haemoglobin)",
        "category": "Diabetes",
        "description": "Reflects average blood glucose over the past 2–3 months. Gold standard for long-term diabetes monitoring and diagnosis.",
        "price": 480,
        "discount_percentage": 10,
        "turnaround_hours": 6,
    },
    {
        "name": "Insulin Fasting",
        "category": "Diabetes",
        "description": "Measures fasting insulin levels to assess insulin resistance and beta-cell function. Used in PCOS and metabolic syndrome evaluation.",
        "price": 650,
        "discount_percentage": 10,
        "turnaround_hours": 8,
    },
    {
        "name": "Lipid Profile",
        "category": "Cardiac",
        "description": "Comprehensive panel: Total cholesterol, LDL, HDL, VLDL and triglycerides. Essential for cardiovascular risk assessment.",
        "price": 580,
        "discount_percentage": 15,
        "turnaround_hours": 6,
    },
    {
        "name": "Troponin I (High Sensitivity)",
        "category": "Cardiac",
        "description": "Highly sensitive cardiac biomarker for early detection of myocardial injury and acute myocardial infarction.",
        "price": 1200,
        "discount_percentage": 0,
        "turnaround_hours": 4,
    },
    {
        "name": "D-Dimer",
        "category": "Cardiac",
        "description": "Fibrin degradation product used to rule out deep vein thrombosis (DVT), pulmonary embolism and DIC.",
        "price": 1400,
        "discount_percentage": 0,
        "turnaround_hours": 6,
    },
    {
        "name": "Liver Function Test (LFT)",
        "category": "Biochemistry",
        "description": "Panel of 10 tests: bilirubin (total/direct), ALT, AST, ALP, GGT, albumin, total protein and globulin.",
        "price": 680,
        "discount_percentage": 10,
        "turnaround_hours": 6,
    },
    {
        "name": "Kidney Function Test (KFT)",
        "category": "Biochemistry",
        "description": "Creatinine, blood urea nitrogen, uric acid, eGFR and electrolytes (Na, K, Cl). Evaluates renal health.",
        "price": 620,
        "discount_percentage": 10,
        "turnaround_hours": 6,
    },
    {
        "name": "C-Reactive Protein (CRP)",
        "category": "Biochemistry",
        "description": "Acute-phase protein that rises sharply with systemic inflammation, bacterial infection and tissue injury.",
        "price": 320,
        "discount_percentage": 0,
        "turnaround_hours": 4,
    },
    {
        "name": "Iron Studies (Serum Iron, TIBC, Ferritin)",
        "category": "Biochemistry",
        "description": "Comprehensive iron status panel including serum iron, total iron-binding capacity and ferritin for anaemia workup.",
        "price": 780,
        "discount_percentage": 10,
        "turnaround_hours": 8,
    },
    # ── Thyroid ───────────────────────────────────────────────────────────────
    {
        "name": "Thyroid Profile (T3, T4, TSH)",
        "category": "Thyroid",
        "description": "Complete thyroid function panel measuring total T3, total T4 and TSH. Screens for hypothyroidism and hyperthyroidism.",
        "price": 720,
        "discount_percentage": 15,
        "turnaround_hours": 8,
    },
    {
        "name": "TSH (Thyroid Stimulating Hormone)",
        "category": "Thyroid",
        "description": "Single most sensitive test for thyroid dysfunction. Elevated in hypothyroidism; suppressed in hyperthyroidism.",
        "price": 360,
        "discount_percentage": 0,
        "turnaround_hours": 6,
    },
    # ── Hormones / Vitamins ───────────────────────────────────────────────────
    {
        "name": "Vitamin D (25-OH)",
        "category": "Hormones",
        "description": "Measures 25-hydroxyvitamin D3 levels. Deficiency linked to bone loss, immune dysfunction and fatigue.",
        "price": 950,
        "discount_percentage": 10,
        "turnaround_hours": 12,
    },
    {
        "name": "Vitamin B12",
        "category": "Hormones",
        "description": "Detects cobalamin deficiency associated with megaloblastic anaemia, peripheral neuropathy and cognitive decline.",
        "price": 720,
        "discount_percentage": 10,
        "turnaround_hours": 8,
    },
    {
        "name": "PSA (Prostate Specific Antigen)",
        "category": "Hormones",
        "description": "Screening marker for prostate cancer and benign prostatic hyperplasia. Recommended for men over 50.",
        "price": 850,
        "discount_percentage": 0,
        "turnaround_hours": 12,
    },
    # ── Urine Analysis ────────────────────────────────────────────────────────
    {
        "name": "Urine Routine & Microscopy",
        "category": "Urine Test",
        "description": "Physical, chemical and microscopic examination of urine. Detects UTI, kidney disease, diabetes and liver disorders.",
        "price": 150,
        "discount_percentage": 0,
        "turnaround_hours": 3,
    },
    {
        "name": "Urine Culture & Sensitivity",
        "category": "Urine Test",
        "description": "Identifies causative organisms of urinary tract infections and determines antibiotic sensitivity profile.",
        "price": 520,
        "discount_percentage": 0,
        "turnaround_hours": 48,
    },
    {
        "name": "Pregnancy Test (Beta-HCG)",
        "category": "Urine Test",
        "description": "Quantitative serum beta-HCG for early pregnancy confirmation and monitoring. More sensitive than urine strip tests.",
        "price": 380,
        "discount_percentage": 0,
        "turnaround_hours": 4,
    },
    # ── Serology / Infectious Disease ─────────────────────────────────────────
    {
        "name": "Dengue NS1 Antigen + IgM/IgG",
        "category": "Serology",
        "description": "Combo rapid test detecting NS1 antigen (early phase) and IgM/IgG antibodies (late phase) for dengue fever.",
        "price": 850,
        "discount_percentage": 10,
        "turnaround_hours": 4,
    },
    {
        "name": "Malaria Parasite Test (MP)",
        "category": "Serology",
        "description": "Rapid antigen test detecting Plasmodium falciparum and P. vivax antigens. Results in under 30 minutes.",
        "price": 280,
        "discount_percentage": 0,
        "turnaround_hours": 2,
    },
    {
        "name": "Widal Test (Typhoid)",
        "category": "Serology",
        "description": "Tube agglutination test for Salmonella typhi and paratyphi antibodies. Used in typhoid fever diagnosis.",
        "price": 220,
        "discount_percentage": 0,
        "turnaround_hours": 4,
    },
    {
        "name": "Allergy Panel (IgE — 20 Allergens)",
        "category": "Serology",
        "description": "Measures specific IgE antibodies against 20 common allergens including dust mites, pollen, food and pet dander.",
        "price": 3200,
        "discount_percentage": 10,
        "turnaround_hours": 24,
    },
]

# ── 8 Health Packages ─────────────────────────────────────────────────────────
# Keys in 'test_names' must exactly match names in TESTS above.
PACKAGES: list[dict] = [
    {
        "name": "Basic Health Checkup",
        "description": "Essential screening panel for a quick annual health overview. Covers blood count, sugar, kidney and liver basics.",
        "test_names": [
            "Complete Blood Count (CBC)",
            "Blood Sugar Fasting (BSF)",
            "Kidney Function Test (KFT)",
            "Liver Function Test (LFT)",
            "Urine Routine & Microscopy",
        ],
        "original_price": 1820,
        "discounted_price": 999,
    },
    {
        "name": "Advanced Full Body Checkup",
        "description": "Comprehensive 12-test panel covering haematology, metabolic, thyroid, vitamins and cardiac markers.",
        "test_names": [
            "Complete Blood Count (CBC)",
            "Blood Sugar Fasting (BSF)",
            "HbA1c (Glycated Haemoglobin)",
            "Lipid Profile",
            "Liver Function Test (LFT)",
            "Kidney Function Test (KFT)",
            "Thyroid Profile (T3, T4, TSH)",
            "Vitamin D (25-OH)",
            "Vitamin B12",
            "C-Reactive Protein (CRP)",
            "Urine Routine & Microscopy",
            "Iron Studies (Serum Iron, TIBC, Ferritin)",
        ],
        "original_price": 6350,
        "discounted_price": 3499,
    },
    {
        "name": "Diabetes Care Package",
        "description": "Targeted panel for diabetes screening, monitoring and complication risk assessment.",
        "test_names": [
            "Blood Sugar Fasting (BSF)",
            "HbA1c (Glycated Haemoglobin)",
            "Insulin Fasting",
            "Kidney Function Test (KFT)",
            "Urine Routine & Microscopy",
            "Lipid Profile",
        ],
        "original_price": 2650,
        "discounted_price": 1499,
    },
    {
        "name": "Thyroid Profile Package",
        "description": "Complete thyroid assessment including full profile and individual TSH for accurate diagnosis.",
        "test_names": [
            "Thyroid Profile (T3, T4, TSH)",
            "TSH (Thyroid Stimulating Hormone)",
            "Complete Blood Count (CBC)",
            "Vitamin B12",
            "Vitamin D (25-OH)",
        ],
        "original_price": 2900,
        "discounted_price": 1799,
    },
    {
        "name": "Women Wellness Package",
        "description": "Designed for women's preventive health — covers hormones, thyroid, vitamins, iron and reproductive markers.",
        "test_names": [
            "Complete Blood Count (CBC)",
            "Thyroid Profile (T3, T4, TSH)",
            "Vitamin D (25-OH)",
            "Vitamin B12",
            "Iron Studies (Serum Iron, TIBC, Ferritin)",
            "Blood Sugar Fasting (BSF)",
            "Urine Routine & Microscopy",
            "Pregnancy Test (Beta-HCG)",
        ],
        "original_price": 3850,
        "discounted_price": 2199,
    },
    {
        "name": "Senior Citizen Health Package",
        "description": "Comprehensive panel tailored for adults 60+. Covers cardiac, renal, hepatic, bone and metabolic health.",
        "test_names": [
            "Complete Blood Count (CBC)",
            "Blood Sugar Fasting (BSF)",
            "HbA1c (Glycated Haemoglobin)",
            "Lipid Profile",
            "Liver Function Test (LFT)",
            "Kidney Function Test (KFT)",
            "Thyroid Profile (T3, T4, TSH)",
            "Vitamin D (25-OH)",
            "Vitamin B12",
            "PSA (Prostate Specific Antigen)",
            "Erythrocyte Sedimentation Rate (ESR)",
            "Urine Routine & Microscopy",
        ],
        "original_price": 7200,
        "discounted_price": 3999,
    },
    {
        "name": "Cardiac Risk Package",
        "description": "Advanced cardiac risk assessment combining lipid panel, high-sensitivity troponin, D-dimer and inflammatory markers.",
        "test_names": [
            "Lipid Profile",
            "Troponin I (High Sensitivity)",
            "D-Dimer",
            "C-Reactive Protein (CRP)",
            "Blood Sugar Fasting (BSF)",
            "Complete Blood Count (CBC)",
        ],
        "original_price": 3570,
        "discounted_price": 2499,
    },
    {
        "name": "Fever & Infection Panel",
        "description": "Rapid infectious disease workup for fever of unknown origin — covers dengue, malaria, typhoid and inflammation.",
        "test_names": [
            "Dengue NS1 Antigen + IgM/IgG",
            "Malaria Parasite Test (MP)",
            "Widal Test (Typhoid)",
            "Complete Blood Count (CBC)",
            "C-Reactive Protein (CRP)",
            "Erythrocyte Sedimentation Rate (ESR)",
        ],
        "original_price": 2170,
        "discounted_price": 1299,
    },
]


async def reset(session: AsyncSession) -> None:
    print("\n── Resetting database ──────────────────────────────────────")
    for table in TRUNCATE_ORDER:
        await session.execute(text(f'TRUNCATE TABLE "{table}" RESTART IDENTITY CASCADE'))
        print(f"  TRUNCATED: {table}")
    await session.commit()
    print("  Reset complete.\n")


async def seed_tests(session: AsyncSession) -> dict[str, uuid.UUID]:
    """Insert tests, return name→id map."""
    print("── Seeding tests ───────────────────────────────────────────")
    name_to_id: dict[str, uuid.UUID] = {}
    for t in TESTS:
        tid = uuid.uuid4()
        test = Test(
            id=tid,
            name=t["name"],
            category=t["category"],
            description=t["description"],
            price=t["price"],
            discount_percentage=t["discount_percentage"],
            turnaround_hours=t["turnaround_hours"],
            is_active=True,
        )
        session.add(test)
        name_to_id[t["name"]] = tid
        print(f"  + {t['name']}  [{t['category']}]  ₹{t['price']}")
    await session.flush()
    print(f"  {len(TESTS)} tests inserted.\n")
    return name_to_id


async def seed_packages(session: AsyncSession, name_to_id: dict[str, uuid.UUID]) -> None:
    """Insert packages and their test associations."""
    print("── Seeding packages ────────────────────────────────────────")
    for p in PACKAGES:
        pid = uuid.uuid4()
        pkg = Package(
            id=pid,
            name=p["name"],
            description=p["description"],
            original_price=p["original_price"],
            discounted_price=p["discounted_price"],
            is_active=True,
        )
        session.add(pkg)
        await session.flush()

        test_ids = []
        for tname in p["test_names"]:
            tid = name_to_id.get(tname)
            if tid is None:
                print(f"  WARNING: test '{tname}' not found — skipping")
                continue
            session.add(PackageTest(package_id=pid, test_id=tid))
            test_ids.append(tid)

        savings = p["original_price"] - p["discounted_price"]
        pct = round(savings / p["original_price"] * 100)
        print(
            f"  + {p['name']}  ({len(test_ids)} tests)  "
            f"₹{p['discounted_price']} (save {pct}%)"
        )

    await session.flush()
    print(f"  {len(PACKAGES)} packages inserted.\n")


async def main(do_reset: bool) -> None:
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        if do_reset:
            await reset(session)

        name_to_id = await seed_tests(session)
        await seed_packages(session, name_to_id)
        await session.commit()

    await engine.dispose()
    print("── Done ────────────────────────────────────────────────────")
    print(f"  Tests   : {len(TESTS)}")
    print(f"  Packages: {len(PACKAGES)}")


if __name__ == "__main__":
    do_reset = "--reset" in sys.argv
    asyncio.run(main(do_reset))
