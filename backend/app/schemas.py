"""Pydantic request models kept intentionally permissive for local API clients."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from .ai_defaults import OPENROUTER_DEFAULT_FALLBACK_MODEL, OPENROUTER_DEFAULT_MODEL


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
    provider: str = "openrouter"
    base_url: str = "https://openrouter.ai/api/v1"
    model: str = OPENROUTER_DEFAULT_MODEL
    fallback_model: str = OPENROUTER_DEFAULT_FALLBACK_MODEL
    api_key: str | None = None
    clear_api_key: bool = False
    enabled: bool = False
    timeout_seconds: int = Field(default=60, ge=5, le=300)


class SemanticReviewRequest(BaseModel):
    keyword_ids: list[int] = Field(default_factory=list)
    # Incremental review only selects pending rows.  Full review resets
    # unlocked rows first and then re-runs the same bounded pipeline.
    review_mode: Literal["incremental", "full"] = "incremental"
    # `limit` is the total number of keywords to review. The endpoint sends
    # them to the configured AI provider in bounded batches so the full product library is audited.
    limit: int = Field(default=10000, ge=1, le=10000)
    # Keep an individual model response small enough to complete reliably.
    # Concurrency still allows multiple batches to run at the same time.
    batch_size: int = Field(default=10, ge=10, le=100)
    # Only independent network calls run concurrently. Database writes remain
    # deterministic and single-threaded in route orchestration.
    concurrency: int = Field(default=4, ge=1, le=8)
    # The UI uses a background job so progress remains queryable after a page
    # refresh.  The default stays synchronous for existing API clients/tests.
    background: bool = False
