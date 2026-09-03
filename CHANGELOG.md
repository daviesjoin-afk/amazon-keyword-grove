# Changelog

## [Unreleased]

### Added

- Real frontend API-client tests covering normalization, pagination, AI-key masking and HTTP failure behavior.
- UI-level AI settings safety tests covering masked-key display, blank-key preservation, plaintext clearing after save, and required-field validation.
- Architecture/trust-boundary documentation, contribution guidance and a pull-request quality checklist.
- Bounded concurrent semantic-review network batches with retries and explicit partial-failure reporting; successful batches are retained while failed batches remain pending.

### Changed

- 将相关性展示统一为竞品 ASIN 占比（如 `5/20`），保留独立的 0–100 语义评分，并让接口按产品实际竞品数动态计算分母。
- 增量 MiMo 审核改为可查询的后台分批任务，广告建议页显示已审核数、总数和批次进度，刷新页面后自动恢复状态。

### Fixed

- 新建产品在未导入关键词表时不再虚构 20 个竞品 ASIN 或显示 MiMo 审核中；导入有效关键词后自动从“准备中”转为可用状态。
- 持久化当前选中产品并防止切换产品时旧的异步关键词请求覆盖新页面，刷新后仍停留在用户选中的产品。
- 空词库概览不再显示 `NaN%`，MiMo 全量审核按钮会明确提示先导入关键词。

### Maintenance

- Repository hygiene baseline: fixed the clone URL, hardened CI permissions and timeouts, added dependency checks, and enabled weekly Dependabot updates.
- Updated GitHub Actions to their current Node 24-compatible v7 releases to remove runner deprecation warnings.
- Frontend CI no longer allows an empty test suite to pass; backend CI now includes a compile gate before pytest.
- README now documents design principles, verification evidence, safety boundaries and known deployment limitations.
- Split reusable API support and AI transport/secret-handling logic out of `backend/app/main.py` while preserving the existing route surface and semantic-review monkeypatch seam.
- Semantic-review concurrency is limited to model network calls; SQLite writes remain deterministic and single-threaded in batch order.

## [0.2.1] - 2026-09-03

### Fixed

- Declared the frontend workspace package in `pnpm-workspace.yaml` so frozen-lockfile installs work in GitHub Actions and fresh clones.

## [0.2.0] - 2026-09-03

### Added

- Multi-product SellerSprite keyword-library workflow with product copy, competitor ASINs and incremental imports.
- MiMo v2.5 settings, persisted full/incremental semantic review, and review evidence.
- Advertising Suggestions page with exact, broad, negative exact, negative phrase and observe exports.
- Monthly-search-volume-first sorting and stricter low-relevance/low-coverage safeguards.
- Standalone project metadata, MIT license and CI-ready verification commands.

### Changed

- Broad targeting now keeps only product core-term roots; phrase targeting is not proposed.
- Review-only advertising drafts are fail-safe and never call Amazon Ads.

## [0.1.0] - Initial MVP

- Local FastAPI + React keyword-library prototype with SellerSprite import and product workbench.
