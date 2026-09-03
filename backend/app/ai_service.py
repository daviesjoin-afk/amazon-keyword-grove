"""AI configuration and OpenAI-compatible transport helpers.

The FastAPI entrypoint owns route registration.  This module owns secret-safe
configuration reads, connectivity probes, model JSON calls and deterministic
semantic-review helper logic so transport concerns do not dominate ``main.py``.
"""

from __future__ import annotations

import hashlib
import json
import urllib.error
import urllib.request
from typing import Any

from .api_support import api_error
from .db import read_connection
from .utils import clean_text, loads, tokens


SEMANTIC_REVIEW_VERSION = "mimo-double-audit-v2"


def public_ai_config(config: dict[str, Any]) -> dict[str, Any]:
    """Return only fields that are safe to expose to the frontend."""

    api_key = clean_text(config.get("api_key"))
    return {
        "provider": clean_text(config.get("provider")) or "mimo",
        "base_url": clean_text(config.get("base_url")) or "https://api.xiaomimimo.com/v1",
        "model": clean_text(config.get("model")) or "mimo-v2.5",
        "enabled": bool(config.get("enabled")),
        "timeout_seconds": int(config.get("timeout_seconds") or 60),
        "api_key_set": bool(api_key),
        "api_key_hint": f"••••{api_key[-4:]}" if api_key else "",
    }


def load_ai_config() -> dict[str, Any]:
    with read_connection() as connection:
        row = connection.execute("SELECT value_json FROM app_settings WHERE key = 'ai_config'").fetchone()
    return loads(row["value_json"], {}) if row else {}


def require_ai_config() -> dict[str, Any]:
    """Load the persisted config and enforce the minimum secret-safe preconditions."""

    config = load_ai_config()
    if not config.get("enabled"):
        api_error(422, "ai_not_enabled", "请先启用 AI 配置")
    if not clean_text(config.get("api_key")):
        api_error(422, "missing_ai_key", "请先填写 API Key")
    return config


def _request(config: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    base_url = clean_text(config.get("base_url")).rstrip("/")
    api_key = clean_text(config.get("api_key"))
    if not base_url or not clean_text(config.get("model")):
        api_error(422, "missing_ai_config", "请先填写接口地址和模型名称")
    request = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}", "api-key": api_key},
        method="POST",
    )
    timeout = min(max(int(config.get("timeout_seconds") or 60), 5), 60)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError:
        raise
    except (urllib.error.URLError, TimeoutError, ValueError):
        raise


def test_ai_connection(config: dict[str, Any]) -> dict[str, Any]:
    """Send a minimal connectivity probe without product or keyword data."""

    model = clean_text(config.get("model"))
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a connection test. Reply with exactly: OK"},
            {"role": "user", "content": "PING"},
        ],
        "max_completion_tokens": 64,
        "reasoning": {"effort": "none"},
        "stream": False,
    }
    try:
        result = _request(config, payload)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        api_error(502, "ai_test_rejected", f"模型接口拒绝测试请求（HTTP {exc.code}）：{detail}")
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        api_error(502, "ai_test_failed", f"模型接口连接失败：{str(exc)[:300]}")

    try:
        message = result["choices"][0]["message"]
        content = clean_text(message.get("content"))
    except (KeyError, IndexError, TypeError):
        api_error(502, "ai_test_invalid_response", "模型接口返回格式无法识别")
    return {"ok": True, "provider": clean_text(config.get("provider")), "model": model, "reply": content[:200]}


def ai_json_response(config: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    """Call an OpenAI-compatible model and extract one JSON object from its reply."""

    try:
        result = _request(config, payload)
    except urllib.error.HTTPError as exc:
        api_error(502, "ai_review_rejected", f"模型接口拒绝审核请求（HTTP {exc.code}）")
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        api_error(502, "ai_review_failed", f"模型接口连接失败：{str(exc)[:300]}")
    try:
        content = clean_text(result["choices"][0]["message"]["content"])
        start, end = content.find("{"), content.rfind("}")
        if start < 0 or end < start:
            raise ValueError("JSON object not found")
        return json.loads(content[start:end + 1])
    except (KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError):
        api_error(502, "ai_review_invalid_response", "模型未返回可解析的 JSON 审核结果")


def semantic_review_signature(product: dict[str, Any], candidate: dict[str, Any]) -> str:
    """Return a stable fingerprint for a local-rule + semantic-review decision."""

    evidence = {
        "version": SEMANTIC_REVIEW_VERSION,
        "title": product.get("product_title"),
        "bullets": product.get("bullet_points", []),
        "core_terms": product.get("core_terms", []),
        "excluded_terms": product.get("excluded_terms", []),
        "keyword": candidate.get("keyword"),
        "rule_score": candidate.get("rule_score"),
        "rule_strength": candidate.get("rule_strength"),
        "rule_action": candidate.get("rule_action"),
        "monthly_search_volume": candidate.get("monthly_search_volume"),
        "source_count": candidate.get("source_count"),
    }
    serialized = json.dumps(evidence, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def semantic_reason_is_too_broad(reason: str) -> bool:
    """Detect an explicit model warning that a query is too generic."""

    text = clean_text(reason).casefold()
    markers = (
        "太宽泛",
        "过宽泛",
        "较宽泛",
        "过宽",
        "太泛",
        "泛词",
        "不够具体",
        "缺乏具体",
        "缺少具体",
        "转化率可能不如更具体",
        "too broad",
        "overly broad",
        "too generic",
        "overly generic",
        "not specific enough",
        "less specific",
    )
    return any(marker in text for marker in markers)


def is_short_generic_query(keyword: str, product: dict[str, Any]) -> bool:
    """Return whether a short generic query lacks a product anchor."""

    words = set(tokens(keyword))
    if len(words) > 2 or not words.intersection({"decor", "decoration", "decorations", "home", "gift", "supplies", "accessories"}):
        return False
    core_tokens = set(tokens(" ".join(product.get("core_terms") or []))) | {"wreath", "wreaths"}
    return not words.intersection(core_tokens)
