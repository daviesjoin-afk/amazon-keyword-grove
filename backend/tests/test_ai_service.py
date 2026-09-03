from backend.app.ai_service import (
    is_short_generic_query,
    public_ai_config,
    semantic_reason_is_too_broad,
    semantic_review_signature,
)


def test_public_ai_config_masks_secret_and_never_returns_plaintext_key():
    public = public_ai_config(
        {
            "provider": "mimo",
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
