"""Pydantic request models kept intentionally permissive for local API clients."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    name: str = Field(min_length=1)
    site: str = Field(min_length=1)
    language: str = "en_US"
    asin: str | None = None
    brand: str | None = None
    category: str | None = None
    product_title: str | None = None
    title: str | None = None
    bullet_points: list[str] | str | None = None
    five_points: list[str] | str | None = None
    product_description: str | None = None
    description: str | None = None
    search_terms: str | None = None
    core_terms: list[str] = Field(default_factory=list)
    excluded_terms: list[str] = Field(default_factory=list)
    settings: dict[str, Any] = Field(default_factory=dict)
    status: Literal["preparing", "active", "on_sale", "archived"] = "preparing"


class ProductUpdate(BaseModel):
    name: str | None = None
    site: str | None = None
    language: str | None = None
    asin: str | None = None
    brand: str | None = None
    category: str | None = None
    product_title: str | None = None
    title: str | None = None
    bullet_points: list[str] | str | None = None
    five_points: list[str] | str | None = None
    product_description: str | None = None
    description: str | None = None
    search_terms: str | None = None
    core_terms: list[str] | None = None
    excluded_terms: list[str] | None = None
    settings: dict[str, Any] | None = None
    status: Literal["preparing", "active", "on_sale", "archived"] | None = None


class KeywordUpdate(BaseModel):
    category: str | None = None
    manual_category: str | None = None
    match_strength: str | None = None
    manual_match_strength: str | None = None
    status: str | None = None
    manual_status: str | None = None
    action: str | None = None
    manual_action: str | None = None
    tags: list[str] | None = None
    manual_tags: list[str] | None = None
    notes: str | None = None
    locked: bool | None = None
    manual_locked: bool | None = None


class MappingPreview(BaseModel):
    mapping: dict[str, str] = Field(default_factory=dict)


class AIConfigUpdate(BaseModel):
    provider: str = "mimo"
    base_url: str = "https://api.xiaomimimo.com/v1"
    model: str = "mimo-v2.5"
    api_key: str | None = None
    enabled: bool = False
    timeout_seconds: int = Field(default=60, ge=5, le=300)


class SemanticReviewRequest(BaseModel):
    keyword_ids: list[int] = Field(default_factory=list)
    # `limit` is the total number of keywords to review. The endpoint sends
    # them to MiMo in bounded batches so the full product library is audited.
    limit: int = Field(default=10000, ge=1, le=10000)
    batch_size: int = Field(default=40, ge=10, le=100)
    # Only independent network calls run concurrently. Database writes remain
    # deterministic and single-threaded in route orchestration.
    concurrency: int = Field(default=4, ge=1, le=8)
