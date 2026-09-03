"""Small serialization and text-normalization helpers shared by the API."""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Iterable


INVISIBLE_RE = re.compile(r"[\u0000-\u001f\u007f\u00ad\u200b-\u200f\u202a-\u202e\u2060\ufeff]")
SEPARATOR_RE = re.compile(r"[\/,，、;；|]+")
SPACE_RE = re.compile(r"\s+")
TOKEN_RE = re.compile(r"[a-z0-9]+(?:['-][a-z0-9]+)?", re.I)


def json_default(value: Any) -> str:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    return str(value)


def dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=json_default, separators=(",", ":"))


def loads(value: Any, default: Any) -> Any:
    if value is None or value == "":
        return default
    try:
        result = json.loads(value)
    except (TypeError, ValueError):
        return default
    return result


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = unicodedata.normalize("NFKC", str(value))
    text = INVISIBLE_RE.sub("", text)
    text = text.replace("\ufffc", "")
    return SPACE_RE.sub(" ", text).strip()


def normalize_keyword(value: Any) -> str:
    # Keep unusual full-width letters and source replacement markers distinct
    # in the keyword primary key.  The supplied Seller Sprite workbook has two
    # such source variants which are distinct keyword rows (2,000 rows must
    # remain 2,000 records); NFKC cleanup is intentionally applied by
    # ``tokens`` for the analysis/word-root layer instead.  Common punctuation
    # and whitespace are still canonicalized for safe search and de-duping.
    if value is None:
        return ""
    text = str(value).replace("\u00a0", " ")
    text = INVISIBLE_RE.sub("", text.replace("\ufffc", "\ufffc"))
    punctuation = str.maketrans({"，": ",", "、": ",", "；": ";", "／": "/", "｜": "|", "－": "-"})
    return SPACE_RE.sub(" ", text.translate(punctuation)).strip().casefold()


def keyword_display_text(value: Any) -> str:
    """Preserve source keyword spelling while trimming only transport noise."""

    if value is None:
        return ""
    text = str(value).replace("\u00a0", " ")
    # Unlike general product text, keep full-width letters and the rare source
    # replacement marker so distinct Seller Sprite rows remain auditable.
    return SPACE_RE.sub(" ", INVISIBLE_RE.sub("", text)).strip()


def tokens(value: Any) -> list[str]:
    text = clean_text(value).casefold()
    return TOKEN_RE.findall(text)


def split_values(value: Any) -> list[str]:
    text = clean_text(value)
    if not text or text == "-":
        return []
    return [item for item in (clean_text(x) for x in SEPARATOR_RE.split(text)) if item]


def as_text(value: Any) -> str | None:
    text = clean_text(value)
    return text if text else None


def as_number(value: Any) -> float | None:
    """Parse a plain numeric cell; invalid and dash values remain unknown."""

    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = clean_text(value).replace(",", "")
    if not text or text == "-":
        return None
    try:
        return float(text)
    except (TypeError, ValueError):
        return None


def as_int(value: Any) -> int | None:
    number = as_number(value)
    if number is None:
        return None
    if number != int(number):
        return None
    return int(number)


def as_percent(value: Any) -> tuple[float | None, str | None, str | None]:
    """Return (normalized, raw, warning).

    Seller Sprite exports percentages as decimal values in [0, 1].  Values
    such as the sample's ``79`` are retained as raw data but are deliberately
    not allowed into the normalized metric.
    """

    raw = None if value is None else clean_text(value)
    if raw == "":
        raw = None
    number = as_number(value)
    if number is None:
        return None, raw, "invalid_percentage" if raw is not None else None
    if number < 0 or number > 1:
        return None, raw, "percentage_out_of_range"
    return number, raw, None


def as_currency(value: Any) -> tuple[float | None, str | None, str | None]:
    """Parse a USD currency cell, preserving non-currency values as warnings."""

    raw = None if value is None else clean_text(value)
    if raw == "":
        raw = None
    if raw is None or raw == "-":
        return None, raw, None
    # A bare numeric value (for example 79 in the fixture) is intentionally
    # not considered a valid currency value.
    match = re.fullmatch(r"\$\s*([0-9]+(?:\.[0-9]+)?)", raw)
    if not match:
        return None, raw, "invalid_currency"
    return float(match.group(1)), raw, None


def as_currency_range(value: Any) -> tuple[float | None, float | None, str | None, str | None]:
    raw = None if value is None else clean_text(value)
    if raw == "":
        raw = None
    if raw is None or raw == "-":
        return None, None, raw, None
    match = re.fullmatch(
        r"\$\s*([0-9]+(?:\.[0-9]+)?)\s*-\s*\$\s*([0-9]+(?:\.[0-9]+)?)",
        raw,
    )
    if not match:
        return None, None, raw, "invalid_currency_range"
    return float(match.group(1)), float(match.group(2)), raw, None


def canonical_scalar(value: Any) -> Any:
    """Make spreadsheet values JSON-safe while retaining their original shape."""

    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)


def canonical_row(headers: Iterable[Any], row: Iterable[Any]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for index, header in enumerate(headers):
        key = clean_text(header) or f"未命名列{index + 1}"
        result[key] = canonical_scalar(row[index] if index < len(row) else None)
    return result
