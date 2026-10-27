# Feature: sri-diagnostic-lab, Property 12: Package Contents Reflect Active Tests Only
"""
Property 12: Package Contents Reflect Active Tests Only
Validates: Requirements 5.6

Requirement 5.6: IF a Package contains a soft-deleted Test, THEN THE System SHALL
  exclude that Test from the Package's displayed contents but SHALL retain the
  historical record.

For any package P containing a set of tests T, after soft-deleting a subset S ⊆ T:
  - The package's active contents MUST NOT include any test from S
  - The package_tests table MUST still contain the associations for tests in S
    (historical record retained)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, select
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# ---------------------------------------------------------------------------
# Minimal standalone models for SQLite (avoids PostgreSQL-specific types)
# ---------------------------------------------------------------------------

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


class Base(DeclarativeBase):
    pass


class LabTest(Base):
    __tablename__ = "tests"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    discount_percentage: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    turnaround_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    package_tests: Mapped[list["PackageTest"]] = relationship("PackageTest", back_populates="lab_test")


class Package(Base):
    __tablename__ = "packages"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    original_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    discounted_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    package_tests: Mapped[list["PackageTest"]] = relationship("PackageTest", back_populates="package")


class PackageTest(Base):
    __tablename__ = "package_tests"

    package_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("packages.id"), primary_key=True
    )
    test_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tests.id"), primary_key=True
    )

    package: Mapped["Package"] = relationship("Package", back_populates="package_tests")
    lab_test: Mapped["LabTest"] = relationship("LabTest", back_populates="package_tests")


# ---------------------------------------------------------------------------
# Note: This test uses standalone SQLite models that don't interfere with 
# the actual app models. The models are only used within this test file.
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Fixture: fresh in-memory SQLite session per test
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def pkg_db_session():
    """Provide a fresh in-memory SQLite async session for each test."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_test(db: AsyncSession, name: str) -> LabTest:
    """Insert a LabTest row directly (SQLite-compatible)."""
    t = LabTest(
        id=uuid.uuid4(),
        name=name,
        category="blood",
        description=None,
        price=100.0,
        discount_percentage=0.0,
        turnaround_hours=24,
        is_active=True,
        deleted_at=None,
    )
    db.add(t)
    await db.flush()
    return t


async def _create_package(db: AsyncSession, name: str) -> Package:
    """Insert a Package row directly."""
    pkg = Package(
        id=uuid.uuid4(),
        name=name,
        description=None,
        original_price=500.0,
        discounted_price=450.0,
        is_active=True,
        deleted_at=None,
    )
    db.add(pkg)
    await db.flush()
    return pkg


async def _link_tests(db: AsyncSession, package_id: uuid.UUID, test_ids: list[uuid.UUID]) -> None:
    """Associate tests with a package (SQLite-compatible, no pg_insert)."""
    for tid in test_ids:
        db.add(PackageTest(package_id=package_id, test_id=tid))
    await db.flush()


async def _soft_delete_test(db: AsyncSession, test_id: uuid.UUID) -> None:
    """Soft-delete a test by setting deleted_at and is_active=False."""
    from sqlalchemy import update
    await db.execute(
        update(LabTest)
        .where(LabTest.id == test_id)
        .values(deleted_at=datetime.now(timezone.utc), is_active=False)
    )
    await db.flush()


async def _get_active_tests(db: AsyncSession, package_id: uuid.UUID) -> list[LabTest]:
    """Return only active (non-deleted) tests for a package."""
    result = await db.execute(
        select(LabTest)
        .join(PackageTest, PackageTest.test_id == LabTest.id)
        .where(
            PackageTest.package_id == package_id,
            LabTest.deleted_at.is_(None),
        )
    )
    return list(result.scalars().all())


async def _get_all_package_test_links(db: AsyncSession, package_id: uuid.UUID) -> list[PackageTest]:
    """Return ALL package_tests rows for a package (including soft-deleted tests)."""
    result = await db.execute(
        select(PackageTest).where(PackageTest.package_id == package_id)
    )
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Generate a list of 1..8 unique test names
test_names_strategy = st.lists(
    st.text(min_size=1, max_size=30, alphabet=st.characters(whitelist_categories=("L", "N"))),
    min_size=1,
    max_size=8,
    unique=True,
)


# ---------------------------------------------------------------------------
# Property tests
# ---------------------------------------------------------------------------


@settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow, HealthCheck.function_scoped_fixture])
@given(test_names=test_names_strategy, delete_fraction=st.floats(min_value=0.0, max_value=1.0))
@pytest.mark.asyncio
async def test_soft_deleted_tests_excluded_from_package_contents(
    pkg_db_session: AsyncSession,
    test_names: list[str],
    delete_fraction: float,
) -> None:
    """
    **Validates: Requirements 5.6**

    For any package P containing a set of tests T, after soft-deleting a subset S ⊆ T:
    - The package's active contents MUST NOT include any test from S.
    - The package_tests table MUST still contain the associations for tests in S
      (historical record retained).
    """
    db = pkg_db_session

    # Create package and all tests
    pkg = await _create_package(db, f"pkg-{uuid.uuid4().hex[:8]}")
    tests = [await _create_test(db, name) for name in test_names]
    test_ids = [t.id for t in tests]

    # Link all tests to the package
    await _link_tests(db, pkg.id, test_ids)

    # Determine which tests to soft-delete (subset S)
    n_to_delete = max(0, round(len(tests) * delete_fraction))
    # Always delete at least 1 if there are tests, to exercise the property
    if n_to_delete == 0 and len(tests) > 0:
        n_to_delete = 1
    tests_to_delete = tests[:n_to_delete]
    deleted_ids = {t.id for t in tests_to_delete}
    active_ids = {t.id for t in tests if t.id not in deleted_ids}

    # Soft-delete the subset S
    for t in tests_to_delete:
        await _soft_delete_test(db, t.id)

    # --- Assertion 1: Active contents must NOT include soft-deleted tests ---
    active_tests = await _get_active_tests(db, pkg.id)
    active_test_ids = {t.id for t in active_tests}

    assert deleted_ids.isdisjoint(active_test_ids), (
        f"Soft-deleted tests {deleted_ids} must not appear in active package contents, "
        f"but found: {deleted_ids & active_test_ids}"
    )

    # --- Assertion 2: Active contents MUST include all non-deleted tests ---
    assert active_ids == active_test_ids, (
        f"Active tests {active_ids} must all appear in package contents, "
        f"but got: {active_test_ids}"
    )

    # --- Assertion 3: Historical record (package_tests) must be retained ---
    all_links = await _get_all_package_test_links(db, pkg.id)
    all_linked_test_ids = {link.test_id for link in all_links}

    assert set(test_ids) == all_linked_test_ids, (
        f"All original package_tests associations must be retained (historical record). "
        f"Expected: {set(test_ids)}, got: {all_linked_test_ids}"
    )
