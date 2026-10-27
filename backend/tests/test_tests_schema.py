"""Unit tests for the Test enrichment fields (recommended_for, sample_type,
feature_cards, faqs) added for the enhanced Test Details page.

Pure schema-layer tests (no DB, no `app.models` import). This suite's
`tests/properties/conftest.py` replaces `sys.modules["app.models"]` (and
`.base`/`.user`/`.audit`) with lightweight SQLite-friendly stand-ins for the
whole pytest session, so any module that does `from app.models.test import
Test` (e.g. `app.services.test_service`) can't be imported here without
colliding with that global stub — matching the existing project convention of
never importing the real `app.models` package alongside the property tests.
`app/schemas/tests.py` has no such dependency, so it's exercised directly.
"""
from __future__ import annotations

from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.tests import FaqItem, FeatureCardItem, TestCreate, TestOut, TestUpdate


def test_test_create_accepts_valid_recommended_for():
    body = TestCreate(
        name="CBC",
        category="Haematology",
        price=Decimal("500"),
        turnaround_hours=24,
        recommended_for=["male", "female"],
    )
    assert body.recommended_for == ["male", "female"]


def test_test_create_rejects_invalid_recommended_for_value():
    with pytest.raises(ValidationError):
        TestCreate(
            name="CBC",
            category="Haematology",
            price=Decimal("500"),
            turnaround_hours=24,
            recommended_for=["nonbinary"],
        )


def test_test_create_feature_cards_and_faqs_default_empty():
    body = TestCreate(
        name="CBC", category="Haematology", price=Decimal("500"), turnaround_hours=24
    )
    assert body.feature_cards == []
    assert body.faqs == []
    assert body.sample_type is None
    assert body.recommended_for is None


def test_feature_card_item_defaults():
    card = FeatureCardItem(title="NABL Accredited", icon="verified")
    assert card.enabled is True
    assert card.order == 0


def test_test_update_partial_dump_serializes_nested_models_to_plain_dicts():
    # TestRepository.update() passes TestUpdate.model_dump(exclude_none=True)
    # straight into SQLAlchemy's `.values(**fields)` — nested Pydantic models
    # must come out as plain dicts/lists for the JSONB column to accept them.
    body = TestUpdate(
        feature_cards=[FeatureCardItem(title="Home Collection", icon="home")],
        faqs=[FaqItem(question="Do I need fasting?", answer="No fasting required.")],
    )
    dumped = body.model_dump(exclude_none=True)
    assert dumped["feature_cards"] == [
        {"title": "Home Collection", "icon": "home", "enabled": True, "order": 0}
    ]
    assert dumped["faqs"] == [
        {"question": "Do I need fasting?", "answer": "No fasting required."}
    ]
    # Untouched fields are absent so a partial update doesn't clobber them.
    assert "sample_type" not in dumped
    assert "recommended_for" not in dumped


def test_test_out_defaults_new_fields_for_legacy_rows():
    # Mirrors the dict shape `_test_to_dict()` (app/services/test_service.py)
    # produces for a pre-migration row: sample_type/recommended_for absent,
    # feature_cards/faqs coerced to [] rather than left as None.
    legacy_row = {
        "id": "11111111-1111-1111-1111-111111111111",
        "name": "CBC",
        "category": "Haematology",
        "description": None,
        "price": Decimal("500"),
        "discount_percentage": Decimal("0"),
        "turnaround_hours": 24,
        "is_active": True,
        "effective_price": 500.0,
        "sample_type": None,
        "recommended_for": None,
        "feature_cards": [],
        "faqs": [],
    }
    out = TestOut.model_validate(legacy_row)
    assert out.sample_type is None
    assert out.recommended_for is None
    assert out.feature_cards == []
    assert out.faqs == []
