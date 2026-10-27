"""Pydantic schemas for tests."""
from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict

RecommendedFor = Literal["male", "female", "other"]


class FeatureCardItem(BaseModel):
    title: str
    icon: str
    enabled: bool = True
    order: int = 0


class FaqItem(BaseModel):
    question: str
    answer: str


class TestCreate(BaseModel):
    name: str
    category: str
    description: str | None = None
    price: Decimal
    discount_percentage: Decimal = Decimal("0")
    turnaround_hours: int
    is_popular: bool = False
    sample_type: str | None = None
    recommended_for: list[RecommendedFor] | None = None
    feature_cards: list[FeatureCardItem] = []
    faqs: list[FaqItem] = []


class TestUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    description: str | None = None
    price: Decimal | None = None
    discount_percentage: Decimal | None = None
    turnaround_hours: int | None = None
    is_active: bool | None = None
    is_popular: bool | None = None
    sample_type: str | None = None
    recommended_for: list[RecommendedFor] | None = None
    feature_cards: list[FeatureCardItem] | None = None
    faqs: list[FaqItem] | None = None


class TestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    category: str
    description: str | None
    price: Decimal
    discount_percentage: Decimal
    turnaround_hours: int
    is_active: bool
    is_popular: bool = False
    effective_price: float
    sample_type: str | None = None
    recommended_for: list[str] | None = None
    feature_cards: list[FeatureCardItem] = []
    faqs: list[FaqItem] = []


class TestListResponse(BaseModel):
    items: list[TestOut]
    total: int
    page: int
    page_size: int
