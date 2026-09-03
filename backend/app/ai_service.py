"""AI configuration and OpenAI-compatible transport helpers.

The FastAPI entrypoint owns route registration.  This module owns secret-safe
configuration reads, connectivity probes, model JSON calls and deterministic
semantic-review helper logic so transport concerns do not dominate ``main.py``.
"""

from __future__ import annotations

from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
import hashlib
import json
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from typing import Any

from fastapi import HTTPException

from .api_support import api_error
from .db import read_connection
from .utils import clean_text, loads, tokens


SEMANTIC_REVIEW_VERSION = "mimo-double-audit-v2"
SEMANTIC_REVIEW_RETRIES = 3
SemanticRequester = Callable[[dict[str, Any], dict[str, Any]], dict[str, Any]]


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


def semantic_batch_prompt(config: dict[str, Any], product: dict[str, Any], candidates: list[dict[str, Any]]) -> dict[str, Any]:
    """Build one bounded request so batches can be retried independently."""

    return {
        "model": clean_text(config.get("model")),
        "response_format": {"type": "json_object"},
        "reasoning": {"effort": "none"},
        "messages": [
            {
                "role": "system",
                "content": "You are an Amazon PPC semantic reviewer. Return JSON only and review every supplied id exactly once. Keep reason_zh concise (under 40 Chinese characters). The local rule score/action is evidence, not a replacement for semantic judgment. For targeting, use only exact or broad; never use phrase targeting. Never suggest a negative phrase unless the supplied keyword is a repeated root and clearly incompatible with the product. Use one decision per keyword: exact, broad, negative_exact, negative_phrase, or observe.",
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "product_title": product.get("product_title"),
                        "bullet_points": product.get("bullet_points", []),
                        "core_terms": product.get("core_terms", []),
                        "task": "Double-audit every candidate using the product copy plus the local rule evidence. Relevant long-tail terms must be exact targeting. Broad is allowed only for an exact core term. Return {reviews:[{id,decision,relevance_score,confidence,reason_zh,negative_phrase_root?}]}. Scores are 0-100. Do not omit any candidate id.",
                        "candidates": candidates,
                    },
                    ensure_ascii=False,
                ),
            },
        ],
        "max_completion_tokens": min(2000, 70 * len(candidates)),
        "stream": False,
    }


def semantic_batch_error(error: Exception) -> str:
    """Return a short, non-secret error suitable for a review summary."""

    if isinstance(error, HTTPException):
        detail = error.detail
        if isinstance(detail, dict):
            return clean_text(detail.get("message") or detail.get("code"))[:240] or f"HTTP {error.status_code}"
        return clean_text(detail)[:240] or f"HTTP {error.status_code}"
    return clean_text(str(error))[:240] or error.__class__.__name__


def run_semantic_batch(
    config: dict[str, Any],
    product: dict[str, Any],
    candidates: list[dict[str, Any]],
    request_json: SemanticRequester,
    *,
    retries: int | None = None,
) -> tuple[dict[int, dict[str, Any]], str | None]:
    """Call the model with bounded retries and require one review per candidate."""

    expected_ids = {item["id"] for item in candidates}
    prompt = semantic_batch_prompt(config, product, candidates)
    attempts = SEMANTIC_REVIEW_RETRIES if retries is None else max(1, retries)
    last_error = ""
    for attempt in range(attempts):
        try:
            result = request_json(config, prompt)
            reviews = result.get("reviews") if isinstance(result, dict) else None
            if not isinstance(reviews, list):
                raise ValueError("模型审核结果缺少 reviews 列表")
            reviews_by_id: dict[int, dict[str, Any]] = {}
            for review in reviews:
                if not isinstance(review, dict):
                    continue
                try:
                    review_id = int(review.get("id"))
                except (TypeError, ValueError):
                    continue
                if review_id in expected_ids:
                    reviews_by_id[review_id] = review
            missing_ids = expected_ids.difference(reviews_by_id)
            if missing_ids:
                raise ValueError(f"模型未返回全部关键词审核结果，缺少 {len(missing_ids)} 条")
            return reviews_by_id, None
        except Exception as error:  # one failed model request must not cancel sibling batches
            last_error = semantic_batch_error(error)
            if attempt + 1 < attempts:
                time.sleep(0.35 * (2 ** attempt))
    return {}, last_error or "MiMo 批次审核失败"


def run_semantic_batches(
    config: dict[str, Any],
    product: dict[str, Any],
    batch_specs: list[tuple[int, list[dict[str, Any]]]],
    concurrency: int,
    request_json: SemanticRequester,
    *,
    retries: int | None = None,
) -> tuple[dict[int, tuple[dict[int, dict[str, Any]], str | None]], int]:
    """Run network-bound batches concurrently while leaving SQLite writes to the caller."""

    if not batch_specs:
        return {}, 0
    worker_count = min(max(1, concurrency), len(batch_specs))
    batch_results: dict[int, tuple[dict[int, dict[str, Any]], str | None]] = {}
    with ThreadPoolExecutor(max_workers=worker_count, thread_name_prefix="mimo-review") as executor:
        remaining_batches = iter(batch_specs)
        futures: dict[Any, int] = {}

        def submit_next() -> bool:
            try:
                batch_index, candidates = next(remaining_batches)
            except StopIteration:
                return False
            futures[executor.submit(run_semantic_batch, config, product, candidates, request_json, retries=retries)] = batch_index
            return True

        for _ in range(worker_count):
            if not submit_next():
                break
        initial_batch_indexes = {batch_index for batch_index, _ in batch_specs[:worker_count]}
        initial_batch_success: dict[int, bool] = {}
        while futures:
            completed, _ = wait(futures, return_when=FIRST_COMPLETED)
            for future in completed:
                batch_index = futures.pop(future)
                try:
                    batch_results[batch_index] = future.result()
                except Exception as error:  # defensive guard around worker execution
                    batch_results[batch_index] = ({}, semantic_batch_error(error))
                if batch_index in initial_batch_indexes:
                    initial_batch_success[batch_index] = batch_results[batch_index][1] is None

            # A bad endpoint, invalid credentials, or an incompatible response
            # must not consume the entire library through queued retries. Keep the
            # first diagnostic batches and do not submit any more work.
            if len(initial_batch_success) == len(initial_batch_indexes) and not any(initial_batch_success.values()):
                break
            for _ in completed:
                if not submit_next():
                    break
    return batch_results, worker_count


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
