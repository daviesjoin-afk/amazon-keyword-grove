from __future__ import annotations

import io
import json
import os
import tempfile
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook

os.environ.setdefault("KEYWORD_DB_PATH", str(Path(tempfile.gettempdir()) / f"keyword-grove-test-{uuid.uuid4().hex}.db"))

from backend.app.analyzer import analyze_keyword, infer_core_terms, recommendation_for
from backend.app.main import app
import backend.app.main as main_module
from backend.app.utils import as_currency, as_currency_range, as_percent, normalize_keyword


TITLE = "Artificial Boxwood Wreath for Front Door, Waterproof Greenery Decor for Indoor and Outdoor Use"
BULLETS = [
    "Full Display - Dense artificial boxwood leaves create a natural-looking wreath for everyday decorating.",
    "Lifelike Greenery - Layered green leaves add a fresh look to farmhouse, rustic, and modern spaces.",
    "Weather Resistant - Waterproof materials support indoor and outdoor display.",
]


def test_clean_numeric_anomalies_are_unknown_not_zero():
    assert normalize_keyword("  Front  Door ") == "front door"
    assert as_percent(79) == (None, "79", "percentage_out_of_range")
    assert as_percent(0.1359)[0] == pytest.approx(0.1359)
    assert as_currency(79) == (None, "79", "invalid_currency")
    assert as_currency("$0.53")[0] == pytest.approx(0.53)
    assert as_currency_range("-") == (None, None, "-", None)
    assert as_currency_range("$0.32 - $0.64")[:2] == pytest.approx((0.32, 0.64))


def test_relevance_and_safe_ad_recommendation_rules():
    product = {"product_title": TITLE, "bullet_points": BULLETS, "core_terms": ["boxwood wreath", "front door wreath"]}
    strong = analyze_keyword("artificial boxwood wreath for front door", product)
    assert strong.score >= 80
    assert strong.strength == "strong"
    advice = recommendation_for("artificial boxwood wreath for front door", strong, {"monthly_search_volume": 1000, "aba_weekly_rank": 10, "ppc_bid": 0.5}, product)
    assert advice["action"] == "exact"
    assert advice["approval_required"] is True

    # Only the complete, high-volume product root enters the broad discovery
    # pool; a long-tail query containing the same root remains exact.
    root = analyze_keyword("boxwood wreath", product)
    root_advice = recommendation_for("boxwood wreath", root, {"monthly_search_volume": 1000}, product)
    assert root_advice["action"] == "broad"
    long_tail = analyze_keyword("boxwood wreath for front door", product)
    long_tail_advice = recommendation_for("boxwood wreath for front door", long_tail, {"monthly_search_volume": 1000}, product)
    assert long_tail_advice["action"] == "exact"

    product["excluded_terms"] = ["iphone case"]
    conflict = analyze_keyword("iphone case", product)
    conflict_advice = recommendation_for("iphone case", conflict, {}, product)
    assert conflict_advice["action"] == "negative_exact"
    assert conflict_advice["action"] != "negative_phrase"

    medium = analyze_keyword("front door greenery decor", product)
    medium_advice = recommendation_for("front door greenery decor", medium, {}, product)
    if medium.strength == "medium":
        assert medium_advice["action"] == "exact"
        assert "广泛只使用产品级抓词根池" in medium_advice["reason"]
    low_coverage_keyword = analyze_keyword("farmhouse", product)
    low_coverage_advice = recommendation_for("farmhouse", low_coverage_keyword, {"monthly_search_volume": 1000, "related_product_count": 3}, product)
    assert low_coverage_advice["action"] == "observe"

    generic_decor = analyze_keyword("room decor", product)
    assert recommendation_for("room decor", generic_decor, {}, product)["action"] == "negative_exact"
    broad_generic = analyze_keyword("home decor", product)
    assert recommendation_for("home decor", broad_generic, {"monthly_search_volume": 1000}, product)["action"] == "observe"
    for generic_term in ("fall decor", "fall decorations for home", "farmhouse decor"):
        assert recommendation_for(generic_term, analyze_keyword(generic_term, product), {"monthly_search_volume": 1000}, product)["action"] == "observe"
    room_root = analyze_keyword("room", product)
    assert recommendation_for("room", room_root, {}, product)["action"] != "negative_phrase"

    low_volume = analyze_keyword("boxwood wreath for front door", product)
    assert recommendation_for("boxwood wreath for front door", low_volume, {"monthly_search_volume": 200}, product)["action"] == "observe"


def test_core_term_inference_prefers_product_phrase_over_single_word():
    assert infer_core_terms({"product_title": TITLE, "bullet_points": BULLETS}) == ["boxwood wreath"]


def _workbook_bytes(rows: list[list[object]]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Keywords"
    for row in rows:
        sheet.append(row)
    asin_sheet = workbook.create_sheet("Asin")
    asin_sheet.append(["ASIN"])
    asin_sheet.append(["B0TEST0001"])
    asin_sheet.append(["B0TEST0002"])
    output = io.BytesIO()
    workbook.save(output)
    return output.getvalue()


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_api_create_import_filter_detail_and_manual_lock(client):
    response = client.post(
        "/api/products",
        json={"name": "Boxwood test product", "site": "US", "product_title": TITLE, "bullet_points": BULLETS, "core_terms": ["boxwood wreath", "front door wreath"]},
    )
    assert response.status_code == 201, response.text
    product_id = response.json()["id"]
    rows = [
        ["关键词", "相关ASIN", "PPC竞价", "流量占比", "流量词类型", "月搜索量", "ABA周排名"],
        ["artificial boxwood wreath for front door", "B0TEST0001/B0TEST0002", "$0.53", 0.12, "SP广告词", 1000, 10],
        ["Room Decor", "B0TEST0001", "79", 79, "SP广告词", None, None],
        ["room decor", "B0TEST0002", "$0.71", None, "自然搜索词", 500, 40],
    ]
    imported = client.post(f"/api/products/{product_id}/imports", files={"file": ("sample.xlsx", _workbook_bytes(rows), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
    assert imported.status_code == 200, imported.text
    result = imported.json()
    assert result["inserted_rows"] == 2
    assert result["updated_rows"] == 1
    assert len(result["source_asins"]) == 2

    listing = client.get(f"/api/products/{product_id}/keywords", params={"search": "room", "page_size": 10})
    assert listing.status_code == 200
    assert listing.json()["total"] == 1
    keyword = listing.json()["items"][0]
    assert keyword["ppc_bid"] is not None
    # The second row's anomaly was followed by a valid update; inspect history
    # to prove it was retained as raw data and never interpreted as a bid.
    detail = client.get(f"/api/products/{product_id}/keywords/{keyword['id']}")
    assert detail.status_code == 200
    assert any(snapshot.get("ppc_bid") is None for item in detail.json()["history"] for snapshot in [item["snapshot"]])
    default_sorted = client.get(f"/api/products/{product_id}/keywords", params={"page_size": 10}).json()["items"]
    assert [item["monthly_search_volume"] for item in default_sorted] == [1000, 500]
    locked = client.patch(f"/api/products/{product_id}/keywords/{keyword['id']}", json={"action": "exact", "notes": "保留人工判断", "locked": True})
    assert locked.status_code == 200
    assert locked.json()["manual_locked"] is True
    assert locked.json()["suggested_action"] == "exact"
    reimported = client.post(f"/api/products/{product_id}/imports", files={"file": ("sample.xlsx", _workbook_bytes(rows), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
    assert reimported.status_code == 200
    after_reimport = client.get(f"/api/products/{product_id}/keywords/{keyword['id']}").json()
    assert after_reimport["manual_locked"] is True
    assert after_reimport["suggested_action"] == "exact"
    exported = client.get(f"/api/products/{product_id}/keywords/export", params={"format": "csv"})
    assert exported.status_code == 200
    assert "关键词" in exported.content.decode("utf-8-sig")
    stats = client.get(f"/api/products/{product_id}/stats")
    assert stats.status_code == 200
    assert stats.json()["total_keywords"] == 2


def test_product_crud_and_soft_delete(client):
    created = client.post("/api/products", json={"name": "CRUD product", "site": "US"})
    assert created.status_code == 201
    assert created.json()["core_terms"] == []
    product_id = created.json()["id"]
    updated = client.patch(f"/api/products/{product_id}", json={"name": "CRUD renamed", "status": "active"})
    assert updated.status_code == 200
    assert updated.json()["name"] == "CRUD renamed"
    assert client.get(f"/api/products/{product_id}").status_code == 200
    archived = client.delete(f"/api/products/{product_id}")
    assert archived.status_code == 200
    assert client.get(f"/api/products/{product_id}").status_code == 404
    restored = client.post(f"/api/products/{product_id}/restore")
    assert restored.status_code == 200
    assert restored.json()["deleted"] is False


def test_new_product_derives_core_term_from_title(client):
    created = client.post("/api/products", json={"name": "Derived root", "site": "US", "product_title": TITLE, "bullet_points": BULLETS})
    assert created.status_code == 201
    assert created.json()["core_terms"] == ["boxwood wreath"]


def test_product_copy_and_ai_config_are_editable_without_exposing_key(client):
    created = client.post("/api/products", json={"name": "Copy product", "site": "US"})
    product_id = created.json()["id"]
    updated = client.patch(
        f"/api/products/{product_id}",
        json={"product_title": TITLE, "bullet_points": BULLETS},
    )
    assert updated.status_code == 200
    assert updated.json()["product_title"] == TITLE
    assert updated.json()["bullet_points"] == BULLETS

    configured = client.put(
        "/api/ai-config",
        json={
            "provider": "openai_compatible",
            "base_url": "https://api.example.com/v1/",
            "model": "semantic-model",
            "api_key": "local-test-key-1234",
            "enabled": True,
            "timeout_seconds": 45,
        },
    )
    assert configured.status_code == 200, configured.text
    assert configured.json()["api_key_set"] is True
    assert configured.json()["api_key_hint"] == "••••1234"
    assert "api_key" not in configured.json()
    fetched = client.get("/api/ai-config")
    assert fetched.json()["model"] == "semantic-model"
    assert "api_key" not in fetched.json()


def test_semantic_review_audits_every_keyword_in_batches(client, monkeypatch):
    configured = client.put(
        "/api/ai-config",
        json={"provider": "mimo", "base_url": "https://api.example.com/v1", "model": "mimo-v2.5", "api_key": "local-test-key-5678", "enabled": True},
    )
    assert configured.status_code == 200
    created = client.post("/api/products", json={"name": "Batch review product", "site": "US", "product_title": TITLE, "bullet_points": BULLETS, "core_terms": ["boxwood wreath"]})
    product_id = created.json()["id"]
    rows = [["关键词", "相关ASIN", "月搜索量"]] + [[f"boxwood wreath {index}", "B0TEST0001", 100 + index] for index in range(11)]
    imported = client.post(f"/api/products/{product_id}/imports", files={"file": ("batch.xlsx", _workbook_bytes(rows), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
    assert imported.status_code == 200, imported.text

    calls: list[int] = []
    first_keywords: list[str] = []

    def fake_ai(_config, request_payload):
        request_data = json.loads(request_payload["messages"][1]["content"])
        candidates = request_data["candidates"]
        calls.append(len(candidates))
        first_keywords.append(candidates[0]["keyword"])
        return {"reviews": [{"id": item["id"], "decision": "exact", "relevance_score": 90, "confidence": 0.9, "reason_zh": "测试审核"} for item in candidates]}

    monkeypatch.setattr(main_module, "_ai_json_response", fake_ai)
    reviewed = client.post(f"/api/products/{product_id}/semantic-review", json={"batch_size": 10})
    assert reviewed.status_code == 200, reviewed.text
    assert reviewed.json()["reviewed"] == 11
    assert reviewed.json()["batches"] == 2
    assert calls == [10, 1]
    assert first_keywords == ["boxwood wreath 10", "boxwood wreath 0"]
    skipped = client.post(f"/api/products/{product_id}/semantic-review", json={"batch_size": 10})
    assert skipped.status_code == 200
    assert skipped.json()["reviewed"] == 0
    assert skipped.json()["already_reviewed"] is True
    assert calls == [10, 1]
    changed = client.patch(f"/api/products/{product_id}", json={"product_title": TITLE + " Updated"})
    assert changed.status_code == 200
    rerun = client.post(f"/api/products/{product_id}/semantic-review", json={"batch_size": 10})
    assert rerun.status_code == 200
    assert rerun.json()["reviewed"] == 11
    assert calls == [10, 1, 10, 1]


def test_semantic_review_downgrades_explicitly_broad_generic_query(client, monkeypatch):
    configured = client.put(
        "/api/ai-config",
        json={"provider": "mimo", "base_url": "https://api.xiaomimimo.com/v1", "model": "mimo-v2.5", "api_key": "local-test-key-9012", "enabled": True},
    )
    assert configured.status_code == 200
    created = client.post("/api/products", json={"name": "Broad warning product", "site": "US", "product_title": TITLE, "bullet_points": BULLETS, "core_terms": ["boxwood wreath"]})
    product_id = created.json()["id"]
    imported = client.post(f"/api/products/{product_id}/imports", files={"file": ("broad.xlsx", _workbook_bytes([["关键词", "月搜索量"], ["home decor", 1000]]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
    assert imported.status_code == 200, imported.text

    def fake_ai(_config, request_payload):
        candidates = json.loads(request_payload["messages"][1]["content"])["candidates"]
        return {"reviews": [{"id": item["id"], "decision": "exact", "relevance_score": 75, "confidence": 0.9, "reason_zh": "查询过于宽泛，转化率可能不如更具体的词"} for item in candidates]}

    monkeypatch.setattr(main_module, "_ai_json_response", fake_ai)
    reviewed = client.post(f"/api/products/{product_id}/semantic-review", json={})
    assert reviewed.status_code == 200, reviewed.text
    result = client.get(f"/api/products/{product_id}/keywords", params={"page_size": 10}).json()["items"][0]
    assert result["suggested_action"] == "observe"


@pytest.mark.skipif(not os.getenv("SELLER_SPRITE_FIXTURE"), reason="set SELLER_SPRITE_FIXTURE to run the real workbook acceptance test")
def test_real_seller_sprite_workbook_import(client):
    fixture = Path(os.environ["SELLER_SPRITE_FIXTURE"])
    if not fixture.exists():
        pytest.skip(f"fixture not found: {fixture}")
    response = client.post(
        "/api/products",
        json={"name": "Real Seller Sprite competitor set", "site": "US", "product_title": TITLE, "bullet_points": BULLETS},
    )
    assert response.status_code == 201, response.text
    product_id = response.json()["id"]
    imported = client.post(f"/api/products/{product_id}/imports", files={"file": (fixture.name, fixture.read_bytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
    assert imported.status_code == 200, imported.text
    result = imported.json()
    assert result["inserted_rows"] == 2000
    assert len(result["source_asins"]) == 20
    stats = client.get(f"/api/products/{product_id}/stats").json()
    assert stats["total_keywords"] == 2000
    rows = client.get(f"/api/products/{product_id}/keywords", params={"search": "interchangeable door wreath sash", "page_size": 10}).json()["items"]
    assert rows
    assert "79" in rows[0]["data_quality_flags"] or rows[0]["ppc_bid"] is None
