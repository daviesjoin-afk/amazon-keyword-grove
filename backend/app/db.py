"""SQLite persistence for the local keyword library.

The application deliberately uses the Python standard-library sqlite3 module
instead of an ORM.  This keeps the local MVP easy to run and makes the import
transaction boundary explicit.
"""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = BACKEND_DIR / "data" / "keyword-grove.db"


SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    asin TEXT,
    site TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'en_US',
    brand TEXT,
    category TEXT,
    product_title TEXT,
    bullet_points_json TEXT NOT NULL DEFAULT '[]',
    product_description TEXT,
    search_terms TEXT,
    core_terms_json TEXT NOT NULL DEFAULT '[]',
    excluded_terms_json TEXT NOT NULL DEFAULT '[]',
    settings_json TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'preparing',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_site ON products(site);

CREATE TABLE IF NOT EXISTS imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    filename TEXT NOT NULL,
    file_sha256 TEXT,
    sheet_name TEXT,
    status TEXT NOT NULL DEFAULT 'processing',
    total_rows INTEGER NOT NULL DEFAULT 0,
    inserted_rows INTEGER NOT NULL DEFAULT 0,
    updated_rows INTEGER NOT NULL DEFAULT 0,
    skipped_rows INTEGER NOT NULL DEFAULT 0,
    error_rows INTEGER NOT NULL DEFAULT 0,
    error_details_json TEXT NOT NULL DEFAULT '[]',
    unmapped_headers_json TEXT NOT NULL DEFAULT '[]',
    source_asins_json TEXT NOT NULL DEFAULT '[]',
    mapping_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY(product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_imports_product ON imports(product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS product_asins (
    product_id INTEGER NOT NULL REFERENCES products(id),
    asin TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'competitor',
    label TEXT,
    first_import_id INTEGER REFERENCES imports(id),
    last_import_id INTEGER REFERENCES imports(id),
    import_count INTEGER NOT NULL DEFAULT 1,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    PRIMARY KEY(product_id, asin)
);

CREATE INDEX IF NOT EXISTS idx_product_asins_asin ON product_asins(asin);

CREATE TABLE IF NOT EXISTS keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    site TEXT NOT NULL,
    keyword_raw TEXT NOT NULL,
    keyword_normalized TEXT NOT NULL,
    keyword_translation TEXT,
    traffic_share REAL,
    traffic_share_raw TEXT,
    traffic_types_json TEXT NOT NULL DEFAULT '[]',
    estimated_weekly_impressions INTEGER,
    related_product_count INTEGER,
    related_asins_json TEXT NOT NULL DEFAULT '[]',
    aba_weekly_rank INTEGER,
    monthly_search_volume INTEGER,
    monthly_purchase_volume INTEGER,
    purchase_rate REAL,
    impressions INTEGER,
    clicks INTEGER,
    spr REAL,
    title_density INTEGER,
    product_count INTEGER,
    demand_supply_ratio REAL,
    ad_competitor_count INTEGER,
    total_click_share REAL,
    total_conversion_share REAL,
    ppc_bid REAL,
    ppc_bid_raw TEXT,
    suggested_bid_min REAL,
    suggested_bid_max REAL,
    suggested_bid_raw TEXT,
    top_asin_1 TEXT,
    top_asin_1_click_share REAL,
    top_asin_1_conversion_share REAL,
    top_asin_2 TEXT,
    top_asin_2_click_share REAL,
    top_asin_2_conversion_share REAL,
    top_asin_3 TEXT,
    top_asin_3_click_share REAL,
    top_asin_3_conversion_share REAL,
    top_10_asins_json TEXT NOT NULL DEFAULT '[]',
    raw_data_json TEXT NOT NULL DEFAULT '{}',
    data_quality_flags_json TEXT NOT NULL DEFAULT '[]',
    category_auto TEXT,
    category_confidence REAL,
    classification_reason_json TEXT NOT NULL DEFAULT '[]',
    relevance_score INTEGER NOT NULL DEFAULT 0,
    match_strength_auto TEXT NOT NULL DEFAULT 'irrelevant',
    matched_terms_json TEXT NOT NULL DEFAULT '[]',
    conflicting_terms_json TEXT NOT NULL DEFAULT '[]',
    suggested_action_auto TEXT NOT NULL DEFAULT 'manual_review',
    suggested_match_type TEXT,
    advice_reason TEXT,
    advice_confidence REAL NOT NULL DEFAULT 0,
    advice_risk_level TEXT NOT NULL DEFAULT 'medium',
    advice_data_basis_json TEXT NOT NULL DEFAULT '[]',
    negative_impact_json TEXT NOT NULL DEFAULT '{}',
    manual_category TEXT,
    manual_match_strength TEXT,
    manual_status TEXT,
    manual_action TEXT,
    manual_tags_json TEXT NOT NULL DEFAULT '[]',
    notes TEXT,
    manual_locked INTEGER NOT NULL DEFAULT 0,
    semantic_reviewed INTEGER NOT NULL DEFAULT 0,
    semantic_reviewed_at TEXT,
    semantic_review_signature TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    first_import_id INTEGER REFERENCES imports(id),
    last_import_id INTEGER REFERENCES imports(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    UNIQUE(product_id, site, keyword_normalized)
);

CREATE INDEX IF NOT EXISTS idx_keywords_product ON keywords(product_id, status);
CREATE INDEX IF NOT EXISTS idx_keywords_normalized ON keywords(product_id, keyword_normalized);
CREATE INDEX IF NOT EXISTS idx_keywords_strength ON keywords(product_id, match_strength_auto);
CREATE INDEX IF NOT EXISTS idx_keywords_score ON keywords(product_id, relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_keywords_search_volume ON keywords(product_id, monthly_search_volume DESC);

CREATE TABLE IF NOT EXISTS keyword_sources (
    keyword_id INTEGER NOT NULL REFERENCES keywords(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    asin TEXT NOT NULL,
    first_import_id INTEGER REFERENCES imports(id),
    last_import_id INTEGER REFERENCES imports(id),
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    PRIMARY KEY(keyword_id, asin)
);

CREATE INDEX IF NOT EXISTS idx_keyword_sources_product_asin ON keyword_sources(product_id, asin);

CREATE TABLE IF NOT EXISTS keyword_metric_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword_id INTEGER NOT NULL REFERENCES keywords(id),
    import_id INTEGER NOT NULL REFERENCES imports(id),
    snapshot_json TEXT NOT NULL,
    captured_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_metric_history_keyword ON keyword_metric_history(keyword_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER REFERENCES products(id),
    keyword_id INTEGER REFERENCES keywords(id),
    action TEXT NOT NULL,
    details_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_product ON audit_logs(product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL
);
"""


def database_path() -> Path:
    """Resolve the database path, allowing tests and local installs to override it."""

    configured = os.getenv("KEYWORD_DB_PATH") or os.getenv("DATABASE_PATH")
    path = Path(configured).expanduser() if configured else DEFAULT_DB_PATH
    return path.resolve()


def connect() -> sqlite3.Connection:
    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(str(path), timeout=30, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    connection.execute("PRAGMA busy_timeout = 30000")
    return connection


def init_db() -> None:
    with connect() as connection:
        connection.executescript(SCHEMA)
        # Keep the MVP database upgradeable without dropping the user's
        # keyword history.  Existing databases receive the semantic audit
        # columns on the next startup.
        columns = {row[1] for row in connection.execute("PRAGMA table_info(keywords)").fetchall()}
        for name, definition in (
            ("semantic_reviewed", "INTEGER NOT NULL DEFAULT 0"),
            ("semantic_reviewed_at", "TEXT"),
            ("semantic_review_signature", "TEXT"),
        ):
            if name not in columns:
                connection.execute(f"ALTER TABLE keywords ADD COLUMN {name} {definition}")
        # Preserve audits created before the explicit status columns existed.
        # The reason prefix was the previous durable marker and is safe to
        # backfill once during migration.
        connection.execute("UPDATE keywords SET semantic_reviewed = 1, semantic_reviewed_at = COALESCE(semantic_reviewed_at, updated_at) WHERE semantic_reviewed = 0 AND advice_reason LIKE 'MiMo 语义审核：%'")
        # Product workspaces created before import-status persistence could
        # remain in ``preparing`` forever even though they already contain a
        # keyword library.  Resolve only those legacy rows; empty new products
        # stay in preparation until their first valid workbook import.
        connection.execute(
            """UPDATE products SET status = 'active'
               WHERE status = 'preparing' AND deleted_at IS NULL
                 AND EXISTS (SELECT 1 FROM keywords k WHERE k.product_id = products.id AND k.deleted_at IS NULL)""",
        )
        connection.commit()


@contextmanager
def transaction() -> Iterator[sqlite3.Connection]:
    connection = connect()
    try:
        connection.execute("BEGIN")
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


@contextmanager
def read_connection() -> Iterator[sqlite3.Connection]:
    connection = connect()
    try:
        yield connection
    finally:
        connection.close()
