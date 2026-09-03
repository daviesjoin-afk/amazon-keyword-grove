# Changelog

## [Unreleased]

## [0.3.0] - 2026-09-03

### Added

- Real frontend API-client tests covering normalization, pagination, AI-key masking and HTTP failure behavior.
- UI-level AI settings safety tests covering masked-key display, blank-key preservation, plaintext clearing after save, and required-field validation.
- Architecture/trust-boundary documentation, contribution guidance and a pull-request quality checklist.
- Bounded concurrent semantic-review network batches with retries and explicit partial-failure reporting; successful batches are retained while failed batches remain pending.

### Changed

- Split reusable API support and AI transport/secret-handling logic out of `backend/app/main.py` while preserving the existing route surface and semantic-review monkeypatch seam.
- Semantic-review concurrency is limited to model network calls; SQLite writes remain deterministic and single-threaded in batch order.
- README now documents design principles, verification evidence, safety boundaries and known deployment limitations.
- Dependency automation groups routine updates and defers frontend semver-major migrations to dedicated compatibility PRs.

### Maintenance

- Hardened CI permissions, cancellation and timeouts; added dependency integrity and backend compile checks.
- Frontend CI no longer allows an empty test suite to pass.
- Enabled grouped weekly Dependabot maintenance for Python, frontend dependencies and GitHub Actions.
- Updated GitHub Actions to their current Node 24-compatible v7 releases.

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
