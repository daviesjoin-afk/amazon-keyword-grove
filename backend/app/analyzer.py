"""Deterministic, explainable relevance and advertising recommendation rules."""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass
from typing import Any, Iterable

from .utils import clean_text, normalize_keyword, tokens


DEFAULT_CORE_WORDS = {
    "wreath",
    "wreaths",
    "boxwood",
    "artificial",
    "greenery",
    "front door",
    "door wreath",
}

ATTRIBUTE_WORDS = {
    "artificial",
    "boxwood",
    "greenery",
    "waterproof",
    "water resistant",
    "uv resistant",
    "uv-resistant",
    "large",
    "26 inch",
    "26-inch",
    "green",
    "sash",
    "round",
    "leaf",
    "leaves",
}
SCENE_WORDS = {
    "front door",
    "door",
    "wall",
    "window",
    "fireplace",
    "entryway",
    "indoor",
    "outdoor",
    "home",
    "farmhouse",
    "rustic",
    "traditional",
    "modern",
}
SEASON_WORDS = {
    "spring",
    "summer",
    "fall",
    "autumn",
    "winter",
    "christmas",
    "halloween",
    "wedding",
    "party",
    "seasonal",
    "year round",
    "year-round",
}
GENERIC_WORDS = {
    "decor",
    "decoration",
    "decorations",
    "home",
    "gift",
    "supplies",
    "accessories",
}
CONTEXT_ONLY_WORDS = {
    "room", "rooms", "bedroom", "bathroom", "classroom", "kitchen", "office", "nursery",
    "living", "decor", "decoration", "decorations",
}

# Product-title modifiers add useful targeting detail, but should not become the
# product root itself.  The remaining final noun phrase in the first title
# clause is a reliable local fallback when a user has not chosen core terms.
CORE_TITLE_MODIFIERS = {
    "artificial", "large", "small", "mini", "extra", "premium", "new", "set",
    "pack", "inch", "inches", "cm", "waterproof", "weatherproof", "uv",
    "resistant", "green", "black", "white", "round", "outdoor", "indoor",
}
CORE_TITLE_BOUNDARY = re.compile(r"\b(?:for|with|from|by|in|on|at|and)\b")
MIN_TARGETING_SEARCH_VOLUME = 300
MIN_COMPETITOR_COVERAGE_RATIO = 0.30
RULE_ENGINE_VERSION = "ad-rules-v2"
MAX_BROAD_ROOTS = 10
NEGATIVE_PHRASE_MIN_SEEDS = 2
NEGATIVE_PHRASE_MIN_AFFECTED = 2
_NEGATIVE_PHRASE_STOPWORDS = {
    "a", "an", "and", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "with",
}
# A one-word negative phrase is materially broader than a negative exact.  A
# protected root is therefore never emitted automatically, even when the
# current workbook contains only negative-exact examples for it.
_NEGATIVE_PHRASE_PROTECTED_ROOTS = {
    "room", "rooms", "home", "decor", "decoration", "decorations", "rv",
    "front", "door", "wreath", "wreaths", "artificial", "greenery", "indoor", "outdoor",
}
_NEGATIVE_PHRASE_PROTECTED_PAIRS = {
    "room decor", "home decor", "front door", "door wreath", "artificial wreath", "greenery wreath",
}


def minimum_competitor_coverage(total: int) -> int:
    """Return the minimum ASIN count for a 30% product-coverage signal."""

    return max(1, math.ceil(max(1, int(total)) * MIN_COMPETITOR_COVERAGE_RATIO))


def _competitor_coverage(row: dict[str, Any], product: dict[str, Any]) -> tuple[int | None, int]:
    """Return the observed competitor coverage and its product denominator."""

    raw_count = row.get("related_product_count")
    if raw_count is None:
        raw_count = row.get("competitor_coverage")
    count = None if raw_count is None else max(0, int(raw_count))
    raw_total = row.get("competitor_total")
    if raw_total is None:
        raw_total = product.get("competitor_total")
    # No imported competitor set means the denominator is unknown.  Preserve
    # that as 0 instead of fabricating the historical default of 20 ASINs.
    try:
        total = max(0, int(raw_total)) if raw_total is not None else 0
    except (TypeError, ValueError):
        total = 0
    return count, total


@dataclass
class Analysis:
    score: int
    strength: str
    category: str
    category_confidence: float
    matched_terms: list[str]
    conflicting_terms: list[str]
    reasons: list[str]


def _phrase_in_text(phrase: str, text: str) -> bool:
    normalized_phrase = normalize_keyword(phrase)
    normalized_text = normalize_keyword(text)
    if not normalized_phrase:
        return False
    return re.search(r"(?<![a-z0-9])" + re.escape(normalized_phrase) + r"(?![a-z0-9])", normalized_text) is not None


def _as_terms(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [clean_text(value)] if clean_text(value) else []
    if isinstance(value, Iterable):
        return [clean_text(item) for item in value if clean_text(item)]
    return []


def _profile(product: dict[str, Any]) -> tuple[str, list[str], list[str], list[str]]:
    title = clean_text(product.get("product_title") or product.get("title"))
    bullets = product.get("bullet_points") or product.get("bullets") or product.get("five_points") or []
    if isinstance(bullets, str):
        bullets = [bullets]
    description = clean_text(product.get("product_description") or product.get("description"))
    search_terms = clean_text(product.get("search_terms"))
    text = " ".join([title, *[clean_text(item) for item in bullets], description, search_terms]).strip()
    core = _as_terms(product.get("core_terms"))
    excluded = _as_terms(product.get("excluded_terms"))
    brand = _as_terms(product.get("brand"))
    return text, core, excluded, brand


def infer_core_terms(product: dict[str, Any]) -> list[str]:
    """Infer one conservative multi-word product root from the title.

    This is only a fallback for a newly created product without manually
    supplied core terms.  It deliberately favours a short noun phrase over
    high-frequency individual tokens, so ``Artificial Boxwood Wreath for…``
    yields ``boxwood wreath`` rather than ``boxwood`` or ``wreath``.
    """

    title = normalize_keyword(clean_text(product.get("product_title") or product.get("title")))
    if not title:
        return []
    first_clause = CORE_TITLE_BOUNDARY.split(title, maxsplit=1)[0]
    words = tokens(first_clause)
    while words and (words[0] in CORE_TITLE_MODIFIERS or words[0].isdigit()):
        words.pop(0)
    if len(words) >= 2:
        return [" ".join(words[-2:])]
    return words[:1]


def _configured_terms(product: dict[str, Any], key: str) -> list[str]:
    """Read optional product-level term lists without trusting malformed JSON."""

    values: Any = product.get(key)
    settings = product.get("settings")
    if values is None and isinstance(settings, dict):
        values = settings.get(key)
    return [normalize_keyword(term) for term in _as_terms(values) if normalize_keyword(term)]


def _product_core_terms(product: dict[str, Any]) -> list[str]:
    """Return explicit roots, falling back to the title-derived root."""

    _, explicit_core, _, _ = _profile(product)
    return [normalize_keyword(term) for term in (explicit_core or infer_core_terms(product)) if normalize_keyword(term)]


def root_candidate_metadata(keyword: str, product: dict[str, Any]) -> dict[str, str | bool | None]:
    """Classify a keyword for targeting explanations and audit fields.

    This deliberately does not make an ad decision.  It only identifies where
    a root came from so the final rule/semantic action can be explained and
    rolled back independently.
    """

    normalized = normalize_keyword(keyword)
    core_terms = _product_core_terms(product)
    configured_broad = _configured_terms(product, "broad_terms")
    if normalized in configured_broad:
        return {"candidate": True, "type": "synonym", "source": "settings.broad_terms", "root": normalized}
    if normalized in core_terms:
        source = "product.core_terms" if _as_terms(product.get("core_terms")) else "title.inferred"
        return {"candidate": True, "type": "core", "source": source, "root": normalized}
    word_count = len(tokens(normalized))
    if any(token.isdigit() for token in tokens(normalized)):
        return {"candidate": False, "type": "fitment_or_part", "source": "keyword", "root": None}
    if word_count >= 3:
        return {"candidate": False, "type": "long_tail", "source": "keyword", "root": None}
    return {"candidate": False, "type": "attribute_or_scene", "source": "keyword", "root": None}


def is_broad_root_candidate(keyword: str, product: dict[str, Any]) -> bool:
    """Return whether a complete keyword is eligible for broad discovery."""

    metadata = root_candidate_metadata(keyword, product)
    if not metadata["candidate"]:
        return False
    word_count = len(tokens(keyword))
    if word_count < 1 or word_count > 3:
        return False
    _, _, excluded, brand = _profile(product)
    normalized = normalize_keyword(keyword)
    return not any(_phrase_in_text(term, normalized) for term in [*excluded, *brand])


def rank_broad_root_candidates(
    rows: list[dict[str, Any]], product: dict[str, Any], *, limit: int = MAX_BROAD_ROOTS
) -> list[dict[str, Any]]:
    """Rank already-approved broad roots and enforce the product-level cap.

    Only rows whose current final/manual action is ``broad`` participate.  The
    helper therefore never promotes an unreviewed or exact long-tail keyword;
    it only provides deterministic ranking and metadata for reconciliation.
    """

    candidates: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in rows:
        action = clean_text(row.get("manual_action") or row.get("suggested_action_auto")).casefold()
        if action != "broad":
            continue
        keyword = normalize_keyword(row.get("keyword_normalized") or row.get("keyword_raw"))
        if not keyword or keyword in seen or not is_broad_root_candidate(keyword, product):
            continue
        volume = row.get("monthly_search_volume")
        try:
            volume_value = int(volume) if volume is not None else -1
        except (TypeError, ValueError):
            volume_value = -1
        coverage, total = _competitor_coverage(row, product)
        minimum = minimum_competitor_coverage(total) if total else 0
        if volume_value < MIN_TARGETING_SEARCH_VOLUME or total <= 0 or coverage is None or coverage < minimum:
            continue
        try:
            score = int(row.get("relevance_score") or 0)
        except (TypeError, ValueError):
            score = 0
        seen.add(keyword)
        candidates.append(
            {
                "id": int(row["id"]) if row.get("id") is not None else None,
                "keyword": keyword,
                "monthly_search_volume": volume_value,
                "coverage": coverage,
                "coverage_total": total,
                "relevance_score": max(0, min(100, score)),
                "metadata": root_candidate_metadata(keyword, product),
            }
        )
    candidates.sort(key=lambda item: (-item["monthly_search_volume"], -item["coverage"], -item["relevance_score"], item["keyword"]))
    return [{**item, "rank": index + 1, "over_limit": index >= limit} for index, item in enumerate(candidates)]


def analyze_keyword(keyword: str, product: dict[str, Any]) -> Analysis:
    """Score one keyword against a product profile without an external AI call."""

    normalized = normalize_keyword(keyword)
    text, explicit_core, excluded, brand = _profile(product)
    keyword_tokens = set(tokens(normalized))
    profile_tokens = set(tokens(text))
    core_terms = explicit_core or sorted(DEFAULT_CORE_WORDS)

    matched_terms: list[str] = []
    conflicting_terms: list[str] = []
    reasons: list[str] = []

    for term in core_terms:
        if _phrase_in_text(term, normalized):
            matched_terms.append(term)
    for term in excluded:
        if _phrase_in_text(term, normalized):
            conflicting_terms.append(term)
    for term in brand:
        if _phrase_in_text(term, normalized):
            conflicting_terms.append(term)

    overlap = keyword_tokens & profile_tokens
    coverage = len(overlap) / max(1, len(keyword_tokens))
    score = round(coverage * 48)
    if overlap:
        reasons.append(f"产品资料覆盖 {len(overlap)}/{len(keyword_tokens)} 个词根")
    if matched_terms:
        score += min(35, 18 + len(matched_terms) * 8)
        reasons.append("命中核心产品词或核心词组：" + ", ".join(matched_terms[:6]))
    phrase_hits = [term for term in (ATTRIBUTE_WORDS | SCENE_WORDS | SEASON_WORDS) if _phrase_in_text(term, normalized) and _phrase_in_text(term, text)]
    if phrase_hits:
        score += min(20, len(phrase_hits) * 5)
        matched_terms.extend(x for x in phrase_hits if x not in matched_terms)
        reasons.append("命中产品属性/用途/场景：" + ", ".join(phrase_hits[:6]))
    generic_hits = keyword_tokens & GENERIC_WORDS
    if generic_hits and len(keyword_tokens) <= 2 and not matched_terms:
        score = min(score, 58)
        reasons.append("关键词较泛，缺少明确产品限定")
    if conflicting_terms:
        score -= min(75, 55 + 8 * (len(conflicting_terms) - 1))
        reasons.append("命中产品排除词或品牌/竞品冲突：" + ", ".join(conflicting_terms[:6]))
    if not overlap and not matched_terms:
        reasons.append("未命中产品标题、五点或核心词")

    score = max(0, min(100, score))
    if score >= 80:
        strength = "strong"
    elif score >= 50:
        strength = "medium"
    elif score >= 20:
        strength = "weak"
    else:
        strength = "irrelevant"

    if conflicting_terms and score <= 35:
        category = "不相关词"
    elif any(_phrase_in_text(term, normalized) for term in brand):
        category = "品牌词"
    elif any(_phrase_in_text(term, normalized) for term in SEASON_WORDS):
        category = "季节/节日/年份词"
    elif any(_phrase_in_text(term, normalized) for term in SCENE_WORDS):
        category = "使用场景词"
    elif any(_phrase_in_text(term, normalized) for term in ATTRIBUTE_WORDS):
        category = "产品属性词"
    elif matched_terms:
        category = "核心产品词"
    elif generic_hits:
        category = "泛词"
    else:
        category = "待确认" if strength in {"weak", "medium"} else "不相关词"

    confidence = min(1.0, max(0.15, 0.35 + coverage * 0.45 + min(0.2, len(matched_terms) * 0.04)))
    if conflicting_terms:
        confidence = min(1.0, confidence + 0.15)
    return Analysis(
        score=score,
        strength=strength,
        category=category,
        category_confidence=round(confidence, 3),
        matched_terms=sorted(set(matched_terms)),
        conflicting_terms=sorted(set(conflicting_terms)),
        reasons=reasons or ["规则信息不足，建议人工复核"],
    )


def _keyword_is_specific(keyword: str, analysis: Analysis) -> bool:
    word_count = len(tokens(keyword))
    return word_count >= 3 or len(analysis.matched_terms) >= 2


def _is_exact_core_term(keyword: str, product: dict[str, Any]) -> bool:
    """Return whether the whole search term is one of the product roots.

    Broad targeting is intentionally limited to a complete, user-confirmed
    product root.  A long-tail query that merely contains a root must remain
    an exact candidate so broad expansion cannot silently absorb unrelated
    modifiers.
    """

    normalized = normalize_keyword(keyword)
    _, explicit_core, _, _ = _profile(product)
    return bool(normalized) and any(normalized == normalize_keyword(term) for term in explicit_core)


def _has_product_anchor(keyword: str, product: dict[str, Any]) -> bool:
    """Return whether a query contains any configured product anchor token."""

    _, explicit_core, _, _ = _profile(product)
    anchor_tokens = set(tokens(" ".join(explicit_core or DEFAULT_CORE_WORDS))) | {"wreath", "wreaths"}
    return bool(set(tokens(keyword)).intersection(anchor_tokens))


def _is_low_specificity_generic(keyword: str, analysis: Analysis, product: dict[str, Any]) -> bool:
    """Identify short generic queries that should not consume exact budget.

    A two-word query such as ``home decor`` can overlap with the product copy
    while still being too broad to justify exact targeting.  Keep this gate
    narrow: it only applies to short generic queries with no product-anchor
    token and a sub-80 local relevance score.  Specific long tails such as
    ``fall decorations for home`` remain eligible for semantic review.
    """

    words = set(tokens(keyword))
    if len(words) > 2 or not words.intersection(GENERIC_WORDS) or analysis.score >= 80:
        return False
    return not _has_product_anchor(keyword, product)


def _is_generic_decor_without_anchor(keyword: str, product: dict[str, Any]) -> bool:
    """Identify decor intent that lacks a product-type anchor.

    Seasonal/style queries such as ``fall decor`` and ``farmhouse decor`` can
    overlap with the listing copy while still representing a broad decor
    category rather than a wreath search.  They should remain observable, not
    exact targets.  Explicit product anchors (``wreath``, ``boxwood``,
    ``front door`` and configured core terms) are exempt.
    """

    words = set(tokens(keyword))
    if not words.intersection({"decor", "decoration", "decorations"}):
        return False
    return not _has_product_anchor(keyword, product)


def _clear_generic_decor_mismatch(keyword: str, analysis: Analysis, product: dict[str, Any]) -> bool:
    """Identify a complete generic decor query without a product anchor.

    A term such as ``room decor`` is a safe negative-exact candidate for this
    wreath, while the root ``room`` must never become a negative phrase.  The
    semantic pass still reviews the candidate; this only supplies an
    explainable first-pass signal.
    """

    words = set(tokens(keyword))
    # `decor` itself is a generic intent marker, not a room context.  Only a
    # concrete context such as `room`, `bedroom`, or `kitchen` should trigger
    # the negative-exact guard; otherwise terms like `fall decor` would be
    # mistaken for the special `room decor` case.
    context_words = CONTEXT_ONLY_WORDS - {"decor", "decoration", "decorations"}
    if not words or not words.intersection(context_words):
        return False
    if not words.intersection({"decor", "decoration", "decorations"}):
        return False
    _, explicit_core, _, _ = _profile(product)
    anchor_tokens = set(tokens(" ".join(explicit_core or DEFAULT_CORE_WORDS))) | {"wreath", "wreaths"}
    if words.intersection(anchor_tokens):
        return False
    return analysis.score <= 35 and not analysis.conflicting_terms


def recommendation_for(
    keyword: str,
    analysis: Analysis,
    row: dict[str, Any],
    product: dict[str, Any],
    *,
    safe_negative_phrase_terms: set[str] | None = None,
    negative_phrase_conflicts: dict[str, list[str]] | None = None,
) -> dict[str, Any]:
    """Return a draft ad action; this function never performs an ad mutation."""

    root_metadata = root_candidate_metadata(keyword, product)
    basis: list[str] = [f"relevance_score={analysis.score}", f"match_strength={analysis.strength}"]
    if analysis.matched_terms:
        basis.append("matched_terms=" + ",".join(analysis.matched_terms[:8]))
    if analysis.conflicting_terms:
        basis.append("conflicting_terms=" + ",".join(analysis.conflicting_terms[:8]))
    if row.get("monthly_search_volume") is not None:
        basis.append("monthly_search_volume")
    coverage_count, coverage_total = _competitor_coverage(row, product)
    if coverage_count is not None:
        basis.append("competitor_coverage")
    if row.get("aba_weekly_rank") is not None:
        basis.append("aba_weekly_rank")
    if row.get("ppc_bid") is not None:
        basis.append("ppc_bid")
    missing = [label for label, key in (("月搜索量", "monthly_search_volume"), ("ABA周排名", "aba_weekly_rank"), ("PPC竞价", "ppc_bid")) if row.get(key) is None]
    confidence = 0.35 + (0.22 if row.get("monthly_search_volume") is not None else 0) + (0.15 if row.get("aba_weekly_rank") is not None else 0) + (0.12 if row.get("ppc_bid") is not None else 0)
    confidence += 0.12 if analysis.strength in {"strong", "irrelevant"} else 0.03
    confidence = round(min(0.98, confidence), 3)

    action = "manual_review"
    match_type = None
    risk = "medium"
    reason = "语义或指标信息不足，先人工复核"
    label = "人工复核"
    approval_required = True

    if analysis.conflicting_terms and analysis.score <= 35:
        action = "negative_exact"
        match_type = "negative_exact"
        risk = "medium"
        label = "建议否定精准"
        reason = "完整搜索词命中排除词或明显冲突；仅建议否定精准，避免误伤包含相同词根的其他组合"
    elif _clear_generic_decor_mismatch(keyword, analysis, product):
        action = "negative_exact"
        match_type = "negative_exact"
        risk = "medium"
        label = "建议否定精准"
        reason = "完整搜索词是缺少花环/产品锚点的泛房间装饰查询；仅否定该完整搜索词，不否定 room 等单词根"
        approval_required = True
    elif _is_generic_decor_without_anchor(keyword, product):
        action = "observe"
        match_type = None
        risk = "medium"
        label = "观察/暂不投放"
        reason = "装饰类搜索意图过宽且未包含明确花环/产品类型锚点；不直接投放精准"
    elif _is_low_specificity_generic(keyword, analysis, product):
        action = "observe"
        match_type = None
        risk = "medium"
        label = "观察/暂不投放"
        reason = "关键词过于宽泛且未包含明确产品锚点；先观察，不直接占用精准投放预算"
    elif _is_exact_core_term(keyword, product) and row.get("monthly_search_volume") is not None and int(row["monthly_search_volume"]) >= MIN_TARGETING_SEARCH_VOLUME:
        # Product-level roots are the only safe broad seeds.  They are still
        # sent through the semantic model; this deterministic candidate makes the intended
        # broad-root pool visible even when the model conservatively answers
        # exact for the same phrase.
        action = "broad"
        match_type = "broad"
        risk = "medium"
        label = "建议广泛投放"
        reason = "完整命中产品核心词根且月搜索量达到投放门槛，适合广泛抓取新的搜索组合"
        approval_required = True
    elif analysis.strength == "strong":
        if _keyword_is_specific(keyword, analysis):
            action = "exact"
            match_type = "exact"
            risk = "low"
            label = "建议精准投放"
            reason = "强相关且意图/属性较明确，适合用精准承接高意向流量"
        else:
            action = "exact"
            match_type = "exact"
            risk = "low"
            label = "建议精准投放"
            reason = "强相关搜索词，建议以精准匹配承接；广泛仅保留给产品级核心词根"
    elif analysis.strength == "medium":
        action = "exact"
        match_type = "exact"
        risk = "medium"
        label = "建议精准测试"
        reason = "中相关长尾先用精准匹配低价测试；广泛只使用产品级抓词根池，不把该长尾直接投入广泛"
    elif analysis.strength in {"weak", "irrelevant"}:
        action = "observe"
        match_type = None
        risk = "high" if analysis.strength == "irrelevant" else "medium"
        label = "观察/暂不投放"
        reason = "弱相关或缺少明确产品匹配；不能仅凭低搜索量或卖家精灵数据自动否定"

    minimum_coverage = minimum_competitor_coverage(coverage_total) if coverage_total else 0
    low_coverage = coverage_total > 0 and coverage_count is not None and coverage_count < minimum_coverage
    if low_coverage and action in {"exact", "broad"}:
        action = "observe"
        match_type = None
        risk = "medium"
        label = "观察/暂不投放"
        reason = f"竞品覆盖仅 {coverage_count}/{coverage_total}，低于 {minimum_coverage}/{coverage_total}（30%相关性门槛）；先观察，不直接投放"

    if coverage_total <= 0 and action in {"exact", "broad"}:
        action = "observe"
        match_type = None
        risk = "medium"
        label = "观察/暂不投放"
        reason = "竞品 ASIN 覆盖数据尚未导入，无法计算相关性占比；先观察，不直接投放"

    low_volume = row.get("monthly_search_volume") is not None and int(row["monthly_search_volume"]) < MIN_TARGETING_SEARCH_VOLUME
    if low_volume and action in {"exact", "broad"}:
        action = "observe"
        match_type = None
        risk = "medium"
        label = "观察/暂不投放"
        reason = f"月搜索量仅 {int(row['monthly_search_volume'])}，低于 {MIN_TARGETING_SEARCH_VOLUME} 的投放门槛；保留观察，不占用投放预算"

    # Negative phrase is deliberately gated.  It can only be emitted by a
    # product-level review proving that all expansions of a root are weak and
    # no strong keyword would be caught.  Even then it remains high-risk and
    # requires manual approval.
    normalized = normalize_keyword(keyword)
    if safe_negative_phrase_terms:
        for term in safe_negative_phrase_terms:
            if _phrase_in_text(term, normalized) and action in {"observe", "negative_exact"}:
                affected = (negative_phrase_conflicts or {}).get(term, [])
                action = "negative_phrase"
                match_type = "negative_phrase"
                risk = "high"
                label = "建议否定词组"
                reason = "词根在本产品当前词库中普遍无效；该动作会拦截多个搜索词，必须人工确认"
                approval_required = True
                return {
                    "action": action,
                    "label": label,
                    "match_type": match_type,
                    "reason": reason,
                    "confidence": confidence,
                    "risk_level": risk,
                    "approval_required": approval_required,
                    "data_basis": basis,
                    "missing_data": missing,
                    "negative_impact": {"root": term, "affected_count": len(affected), "affected_keywords": affected[:20], "blocked": False},
                    "rule_engine_version": RULE_ENGINE_VERSION,
                    "root_candidate_type": root_metadata["type"],
                    "root_source": root_metadata["source"],
                }

    if missing and action not in {"negative_exact", "negative_phrase"}:
        reason += "；" + "、".join(missing) + "缺失，置信度已下调"
    return {
        "action": action,
        "label": label,
        "match_type": match_type,
        "reason": reason,
        "confidence": confidence,
        "risk_level": risk,
        "approval_required": approval_required,
        "data_basis": basis,
        "missing_data": missing,
        "negative_impact": {"root": None, "affected_count": 0, "affected_keywords": [], "blocked": False},
        "rule_engine_version": RULE_ENGINE_VERSION,
        "root_candidate_type": root_metadata["type"],
        "root_source": root_metadata["source"],
    }


def compute_safe_negative_phrase_terms(
    rows: list[dict[str, Any]], product: dict[str, Any]
) -> tuple[set[str], dict[str, list[str]]]:
    """Keep import-time analysis from emitting phrase negatives.

    Phrase negatives are product-level decisions that require completed
    semantic results for every affected expansion.  This compatibility hook
    remains a no-op because imports must never bypass that second audit.
    """

    return set(), {}


def _negative_phrase_roots(keyword: str) -> list[str]:
    """Return one-word and adjacent two-word roots from a search term."""

    words = tokens(keyword)
    roots = [word for word in words if word not in _NEGATIVE_PHRASE_STOPWORDS and not word.isdigit()]
    roots.extend(
        f"{words[index]} {words[index + 1]}"
        for index in range(len(words) - 1)
        if words[index] not in _NEGATIVE_PHRASE_STOPWORDS
        and words[index + 1] not in _NEGATIVE_PHRASE_STOPWORDS
        and not words[index].isdigit()
        and not words[index + 1].isdigit()
    )
    return list(dict.fromkeys(roots))


def _negative_phrase_protected_roots(product: dict[str, Any]) -> set[str]:
    protected = set(_NEGATIVE_PHRASE_PROTECTED_ROOTS)
    protected.update(tokens(" ".join(_product_core_terms(product))))
    protected.update(tokens(" ".join(_configured_terms(product, "protected_terms"))))
    return protected


def derive_negative_phrase_candidates(
    rows: list[dict[str, Any]], product: dict[str, Any]
) -> dict[str, dict[str, Any]]:
    """Derive safe phrase-negative drafts after all exact decisions are saved.

    A root must occur in at least two reviewed ``negative_exact`` rows, every
    affected row must be reviewed, and no positive or medium/high-relevance
    expansion may contain it.  Both one- and two-word roots are considered,
    but generic/protected roots (``room``, ``home``, ``decor``, product roots,
    etc.) are always blocked.  The function is pure and never mutates SQLite.
    """

    normalized_rows: list[dict[str, Any]] = []
    for raw in rows:
        keyword = normalize_keyword(raw.get("keyword_normalized") or raw.get("keyword_raw"))
        if not keyword:
            continue
        action = clean_text(raw.get("manual_action") or raw.get("suggested_action_auto")).casefold()
        try:
            score = int(raw.get("relevance_score") or 0)
        except (TypeError, ValueError):
            score = 0
        normalized_rows.append(
            {
                "raw": raw,
                "keyword": keyword,
                "action": action,
                "score": max(0, min(100, score)),
                "reviewed": bool(raw.get("semantic_reviewed")),
                "local_score": analyze_keyword(keyword, product).score,
            }
        )

    seeds = [item for item in normalized_rows if item["action"] == "negative_exact" and item["reviewed"]]
    if not seeds:
        return {}
    protected_roots = _negative_phrase_protected_roots(product)
    root_seed_counts = Counter(root for seed in seeds for root in _negative_phrase_roots(seed["keyword"]))
    candidates: dict[str, dict[str, Any]] = {}
    for root, seed_count in root_seed_counts.items():
        root_words = root.split()
        # A repeated generic/product root can still be a valid negative exact,
        # but it is never safe to broaden that decision to phrase matching.
        blocked_root = (len(root_words) == 1 and root in protected_roots) or root in _NEGATIVE_PHRASE_PROTECTED_PAIRS
        blocked_root = blocked_root or root in _product_core_terms(product)
        if seed_count < NEGATIVE_PHRASE_MIN_SEEDS or blocked_root:
            continue
        affected = [item for item in normalized_rows if _phrase_in_text(root, item["keyword"])]
        if len(affected) < NEGATIVE_PHRASE_MIN_AFFECTED or any(not item["reviewed"] for item in affected):
            continue

        protected: list[str] = []
        for item in affected:
            if item["action"] != "negative_exact" and (
                item["action"] in {"exact", "broad"}
                or item["score"] >= 50
                or (item["local_score"] >= 50 and _has_product_anchor(item["keyword"], product))
            ):
                protected.append(item["keyword"])
        if protected:
            continue

        negative_seeds = [item for item in affected if item["action"] == "negative_exact"]
        if len(negative_seeds) < NEGATIVE_PHRASE_MIN_SEEDS:
            continue
        representative = min(
            negative_seeds,
            key=lambda item: (item["keyword"] != root, len(tokens(item["keyword"])), item["keyword"]),
        )
        candidates[root] = {
            "root": root,
            "root_length": len(root_words),
            "seed_count": seed_count,
            "seed_keywords": [item["keyword"] for item in negative_seeds],
            "affected_count": len(affected),
            "affected_keywords": [item["keyword"] for item in affected],
            "protected_keywords": protected,
            "representative_id": int(representative["raw"]["id"]),
        }
    return candidates
