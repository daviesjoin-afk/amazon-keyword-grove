import threading
import time

from backend.app.ai_service import (
    is_short_generic_query,
    public_ai_config,
    run_semantic_batches,
    semantic_reason_is_too_broad,
    semantic_review_signature,
)


def test_public_ai_config_masks_secret_and_never_returns_plaintext_key():
    public = public_ai_config(
        {
            "provider": "openrouter",
            "base_url": "https://api.example.com/v1",
            "model": "semantic-model",
            "api_key": "local-secret-1234",
            "enabled": True,
            "timeout_seconds": 45,
        }
    )

    assert public["api_key_set"] is True
    assert public["api_key_hint"] == "••••1234"
    assert "api_key" not in public
    assert "local-secret-1234" not in str(public)


def test_semantic_review_signature_is_stable_and_changes_with_evidence():
    product = {
        "product_title": "Artificial Boxwood Wreath for Front Door",
        "bullet_points": ["Waterproof greenery decor"],
        "core_terms": ["boxwood wreath"],
        "excluded_terms": [],
    }
    candidate = {
        "keyword": "boxwood wreath",
        "rule_score": 90,
        "rule_strength": "strong",
        "rule_action": "broad",
        "monthly_search_volume": 1200,
        "source_count": 12,
    }

    first = semantic_review_signature(product, candidate)
    second = semantic_review_signature(dict(product), dict(candidate))
    changed = semantic_review_signature({**product, "product_title": product["product_title"] + " Updated"}, candidate)

    assert first == second
    assert first != changed
    assert len(first) == 64


def test_generic_broadness_guard_recognizes_model_warning_without_overmatching():
    assert semantic_reason_is_too_broad("这个词太宽泛，建议观察") is True
    assert semantic_reason_is_too_broad("This query is too generic for exact targeting") is True
    assert semantic_reason_is_too_broad("高度相关的产品核心词") is False


def test_short_generic_query_requires_missing_product_anchor():
    product = {"core_terms": ["boxwood wreath"]}

    assert is_short_generic_query("home decor", product) is True
    assert is_short_generic_query("gift", product) is True
    assert is_short_generic_query("wreath decor", product) is False
    assert is_short_generic_query("boxwood wreath for front door", product) is False


def test_semantic_batches_overlap_network_calls_but_return_results_by_batch_index():
    active = 0
    max_active = 0
    lock = threading.Lock()

    def fake_request(_config, payload):
        nonlocal active, max_active
        candidates = __import__("json").loads(payload["messages"][1]["content"])["candidates"]
        with lock:
            active += 1
            max_active = max(max_active, active)
        time.sleep(0.04)
        with lock:
            active -= 1
        return {
            "reviews": [
                {
                    "id": item["id"],
                    "decision": "exact",
                    "relevance_score": 90,
                    "confidence": 0.9,
                    "reason_zh": "并发测试",
                }
                for item in candidates
            ]
        }

    batch_specs = [
        (0, [{"id": 1, "keyword": "one"}]),
        (1, [{"id": 2, "keyword": "two"}]),
        (2, [{"id": 3, "keyword": "three"}]),
    ]
    results, worker_count = run_semantic_batches(
        {"model": "minimax/minimax-m3:free"},
        {"product_title": "Test", "bullet_points": [], "core_terms": []},
        batch_specs,
        3,
        fake_request,
        retries=1,
    )

    assert worker_count == 3
    assert max_active >= 2
    assert sorted(results) == [0, 1, 2]
    assert results[0][1] is None
    assert results[0][0][1]["decision"] == "exact"
    assert results[2][0][3]["reason_zh"] == "并发测试"


def test_semantic_batches_keep_success_when_one_batch_fails():
    def fake_request(_config, payload):
        candidates = __import__("json").loads(payload["messages"][1]["content"])["candidates"]
        if candidates[0]["id"] == 2:
            raise RuntimeError("simulated batch failure")
        return {
            "reviews": [
                {
                    "id": item["id"],
                    "decision": "observe",
                    "relevance_score": 70,
                    "confidence": 0.7,
                    "reason_zh": "成功批次",
                }
                for item in candidates
            ]
        }

    batch_specs = [
        (0, [{"id": 1, "keyword": "one"}]),
        (1, [{"id": 2, "keyword": "two"}]),
    ]
    results, worker_count = run_semantic_batches(
        {"model": "minimax/minimax-m3:free"},
        {"product_title": "Test", "bullet_points": [], "core_terms": []},
        batch_specs,
        2,
        fake_request,
        retries=1,
    )

    assert worker_count == 2
    assert results[0][1] is None
    assert results[0][0][1]["decision"] == "observe"
    assert results[1][0] == {}
    assert "simulated batch failure" in (results[1][1] or "")
