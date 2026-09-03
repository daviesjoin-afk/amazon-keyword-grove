"""Shared HTTP-facing helpers for Keyword Grove API routes.

This module keeps response shaping, request normalization and manual-edit
validation out of the FastAPI entrypoint.  It deliberately contains no route
registration so the public API surface remains centralized in ``main.py``.
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import HTTPException

from .utils import clean_text, dumps, loads


ALLOWED_KEYWORD_STATUSES = {
    "待评估",
    "Listing 已使用",
    "广告待投放",
    "广告已投放",
    "观察",
    "否定候选",
    "已否定",
    "不相关",
    "active",
    "deleted",
}
ALLOWED_ACTIONS = {
    "exact",
    "broad",
    "observe",
    "negative_exact",
    "negative_phrase",
    "manual_review",
    "insufficient_data",
}
ACTION_LABELS = {
    "exact": "建议精准投放",
    "broad": "建议广泛测试",
    "observe": "观察/暂不投放",
    "negative_exact": "建议否定精准",
    "negative_phrase": "建议否定词组",
    "manual_review": "人工复核",
    "insufficient_data": "数据不足",
}


def api_error(status_code: int, code: str, message: str) -> None:
    raise HTTPException(status_code=status_code, detail={"code": code, "message": message})


def model_dict(model: Any, *, exclude_unset: bool = False) -> dict[str, Any]:
    """Normalize Pydantic v1/v2 models without leaking version checks to routes."""

    if hasattr(model, "model_dump"):
        return model.model_dump(exclude_unset=exclude_unset)
    return model.dict(exclude_unset=exclude_unset)


def normalize_bullets(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return [clean_text(item) for item in parsed if clean_text(item)]
        except (TypeError, ValueError):
            pass
        return [clean_text(item) for item in value.splitlines() if clean_text(item)] or [clean_text(value)]
    return [clean_text(item) for item in value if clean_text(item)]


def product_response(row: Any, connection: Any) -> dict[str, Any]:
    data = dict(row)
    data["bullet_points"] = loads(data.pop("bullet_points_json", "[]"), [])
    data["core_terms"] = loads(data.pop("core_terms_json", "[]"), [])
    data["excluded_terms"] = loads(data.pop("excluded_terms_json", "[]"), [])
    data["settings"] = loads(data.pop("settings_json", "{}"), {})
    product_id = int(data["id"])
    stats = connection.execute(
        """SELECT COUNT(*) AS keywords,
                  SUM(CASE WHEN COALESCE(manual_match_strength, match_strength_auto) = 'strong' THEN 1 ELSE 0 END) AS strong_keywords,
                  COUNT(DISTINCT pa.asin) AS source_asins
           FROM keywords k LEFT JOIN keyword_sources pa ON pa.keyword_id = k.id
           WHERE k.product_id = ? AND k.deleted_at IS NULL""",
        (product_id,),
    ).fetchone()
    data["keyword_count"] = int(stats["keywords"] or 0)
    data["strong_keyword_count"] = int(stats["strong_keywords"] or 0)
    data["source_asin_count"] = int(stats["source_asins"] or 0)
    data["deleted"] = bool(data.get("deleted_at"))
    return data


def keyword_response(row: Any, connection: Any | None = None) -> dict[str, Any]:
    data = dict(row)
    for key in (
        "traffic_types_json",
        "related_asins_json",
        "top_10_asins_json",
        "matched_terms_json",
        "conflicting_terms_json",
        "classification_reason_json",
        "advice_data_basis_json",
        "manual_tags_json",
    ):
        output_key = key.removesuffix("_json")
        data[output_key] = loads(data.pop(key, "[]"), [])
    data["raw_data"] = loads(data.pop("raw_data_json", "{}"), {})
    data["data_quality_flags"] = loads(data.pop("data_quality_flags_json", "[]"), [])
    data["negative_impact"] = loads(data.pop("negative_impact_json", "{}"), {})
    data["manual_locked"] = bool(data.get("manual_locked"))
    data["category"] = data.get("manual_category") or data.get("category_auto")
    data["match_strength"] = data.get("manual_match_strength") or data.get("match_strength_auto")
    data["status_resolved"] = data.get("manual_status") or data.get("status")
    action = data.get("manual_action") or data.get("suggested_action_auto")
    data["suggested_action"] = action
    data["suggested_action_label"] = ACTION_LABELS.get(action, action)
    data["suggested_match_type_resolved"] = data.get("manual_action") or data.get("suggested_match_type")
    if connection is not None:
        source_rows = connection.execute(
            "SELECT asin, first_import_id, last_import_id, first_seen_at, last_seen_at FROM keyword_sources WHERE keyword_id = ? ORDER BY asin",
            (data["id"],),
        ).fetchall()
        data["sources"] = [dict(source) for source in source_rows]
    else:
        data["sources"] = []
    return data


def get_product(connection: Any, product_id: int, *, include_deleted: bool = False) -> Any:
    row = connection.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if row is None or (row["deleted_at"] and not include_deleted):
        api_error(404, "product_not_found", "产品不存在")
    return row


def parse_mapping(mapping_json: str | None) -> dict[str, Any] | None:
    if not mapping_json:
        return None
    try:
        parsed = json.loads(mapping_json)
    except (TypeError, ValueError):
        api_error(400, "invalid_mapping", "mapping_json 不是有效 JSON")
    if not isinstance(parsed, dict):
        api_error(400, "invalid_mapping", "字段映射必须是对象")
    return parsed


def keyword_filters(
    product_id: int,
    *,
    search: str | None,
    include_root: str | None,
    exclude_root: str | None,
    match_strength: str | None,
    category: str | None,
    traffic_type: str | None,
    source_asin: str | None,
    action: str | None,
    status: str | None,
    min_search_volume: int | None,
    max_search_volume: int | None,
    include_deleted: bool,
) -> tuple[str, list[Any]]:
    conditions = ["k.product_id = ?"]
    params: list[Any] = [product_id]
    if not include_deleted:
        conditions.append("k.deleted_at IS NULL")
    if search:
        term = f"%{clean_text(search)}%"
        conditions.append("(k.keyword_normalized LIKE ? OR LOWER(COALESCE(k.keyword_translation, '')) LIKE ?)")
        params.extend([term.casefold(), term.casefold()])
    if include_root:
        conditions.append("k.keyword_normalized LIKE ?")
        params.append(f"%{clean_text(include_root).casefold()}%")
    if exclude_root:
        conditions.append("k.keyword_normalized NOT LIKE ?")
        params.append(f"%{clean_text(exclude_root).casefold()}%")
    if match_strength:
        conditions.append("COALESCE(k.manual_match_strength, k.match_strength_auto) = ?")
        params.append(match_strength)
    if category:
        conditions.append("COALESCE(k.manual_category, k.category_auto) = ?")
        params.append(category)
    if traffic_type:
        conditions.append("LOWER(k.traffic_types_json) LIKE ?")
        params.append(f"%{clean_text(traffic_type).casefold()}%")
    if source_asin:
        conditions.append("EXISTS (SELECT 1 FROM keyword_sources ks WHERE ks.keyword_id = k.id AND ks.asin = ?)")
        params.append(clean_text(source_asin).upper())
    if action:
        conditions.append("COALESCE(k.manual_action, k.suggested_action_auto) = ?")
        params.append(action)
    if status:
        conditions.append("COALESCE(k.manual_status, k.status) = ?")
        params.append(status)
    if min_search_volume is not None:
        conditions.append("k.monthly_search_volume >= ?")
        params.append(min_search_volume)
    if max_search_volume is not None:
        conditions.append("k.monthly_search_volume <= ?")
        params.append(max_search_volume)
    return " AND ".join(conditions), params


def keyword_update_parts(values: dict[str, Any]) -> tuple[list[str], list[Any]]:
    """Validate and translate a manual keyword edit into SQL assignments."""

    category = values.get("manual_category", values.get("category"))
    strength = values.get("manual_match_strength", values.get("match_strength"))
    status = values.get("manual_status", values.get("status"))
    action = values.get("manual_action", values.get("action"))
    tags = values.get("manual_tags", values.get("tags"))
    lock_value = values.get("manual_locked", values.get("locked"))
    if action is not None and action not in ALLOWED_ACTIONS:
        api_error(422, "invalid_action", "不支持的广告动作")
    if status is not None and status not in ALLOWED_KEYWORD_STATUSES:
        api_error(422, "invalid_keyword_status", "不支持的关键词状态")
    if strength is not None and strength not in {"strong", "medium", "weak", "irrelevant"}:
        api_error(422, "invalid_match_strength", "不支持的匹配强度")
    assignments: list[str] = []
    params: list[Any] = []
    if category is not None:
        assignments.append("manual_category = ?")
        params.append(clean_text(category) or None)
    if strength is not None:
        assignments.append("manual_match_strength = ?")
        params.append(strength)
    if status is not None:
        assignments.append("manual_status = ?")
        params.append(status)
    if action is not None:
        assignments.append("manual_action = ?")
        params.append(action)
    if tags is not None:
        assignments.append("manual_tags_json = ?")
        params.append(dumps(tags))
    if "notes" in values:
        assignments.append("notes = ?")
        params.append(values["notes"])
    if lock_value is not None:
        assignments.append("manual_locked = ?")
        params.append(1 if lock_value else 0)
    return assignments, params
