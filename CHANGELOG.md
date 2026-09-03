# Changelog

## [Unreleased]

### Added

- Real frontend API-client tests covering normalization, pagination, AI-key masking and HTTP failure behavior.
- UI-level AI settings safety tests covering masked-key display, blank-key preservation, plaintext clearing after save, and required-field validation.
- Architecture/trust-boundary documentation, contribution guidance and a pull-request quality checklist.

### Maintenance

- Repository hygiene baseline: fixed the clone URL, hardened CI permissions and timeouts, added dependency checks, and enabled weekly Dependabot updates.
- Updated GitHub Actions to their current Node 24-compatible v7 releases to remove runner deprecation warnings.
- Frontend CI no longer allows an empty test suite to pass; backend CI now includes a compile gate before pytest.
- README now documents design principles, verification evidence, safety boundaries and known deployment limitations.
- Split reusable API support and AI transport/secret-handling logic out of `backend/app/main.py` while preserving the existing route surface and semantic-review monkeypatch seam.

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
