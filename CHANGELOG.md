# Changelog

## [Unreleased]

### Changed

- 广告建议规则进入 v2 本地实现：审核队列按月搜索量、竞品覆盖率、规则/语义分数和关键词 ID 稳定排序。
- 精准/广泛投放继续受月搜索量 300 与竞品覆盖率 30% 双硬门槛约束；没有真实竞品 ASIN 时不再虚构 `20` 的相关性分母。
- 广泛词根按产品级候选统一排名，最多保留 10 条可导出建议，超出项保留为“超出广泛词条上限”的观察候选。
- 否定词组改为完成否定精准审核后的产品级二次审核：支持安全的单词根和双词根，保护 `room`、`home`、`decor`、产品核心词等高误伤词根，并保存受影响关键词证据。
- 新增规则版本、动作来源、词根来源、冲突动作和否定词组证据字段；人工锁定结果不参与自动重算。
- 广告建议页将动作冲突从四类导出清单中隔离，导出文件补充竞品覆盖、规则版本和最终动作来源。
- 增加显式“重新审核”流程：仅重置未人工锁定关键词；日常“增量审核”继续跳过已完成且证据未变化的记录。
- 重复导入保持已完成语义结果；指标变化只使受影响关键词失效，竞品 ASIN 集合变化则使全部未锁定关键词重新进入队列。
- 关键词详情与批量审批改为写入后端数据库；驳回建议时清除临时人工动作，避免刷新后继续遮蔽自动审核结果。
- 广泛词根超出 10 条上限时继续保留候选排名，广告建议页会单独显示超限数量，不混入可下载清单。

### Fixed

- 产品中心三个点改为独立操作菜单，支持打开产品和归档删除，不再触发整张卡片跳转。
- 当前产品卡片增加绿色边框和 `aria-current` 标识，删除当前产品后自动切换并持久化新的选中产品。

## [0.3.2] - 2026-09-03

### Fixed

- 产品概览和产品中心的关键词总量、强匹配数量改为按唯一关键词 ID 计数，不再因同一词来自多个竞品 ASIN 而重复累加。
- 保留来源 ASIN 的独立去重统计，确保关键词总量与语义审核的总数、广告建议进度一致。

### Verification

- 本地后端回归：`17 passed, 1 skipped`；产品中心实际显示 2,000 关键词 / 20 来源 ASIN。

## [0.3.1] - 2026-09-03

### Added

- Real frontend API-client tests covering normalization, pagination, AI-key masking and HTTP failure behavior.
- UI-level AI settings safety tests covering masked-key display, blank-key preservation, plaintext clearing after save, and required-field validation.
- Architecture/trust-boundary documentation, contribution guidance and a pull-request quality checklist.
- Bounded concurrent semantic-review network batches with retries and explicit partial-failure reporting; successful batches are retained while failed batches remain pending.
- Refresh-safe MiMo background review endpoint (`POST /semantic-review` with `background=true`) and a status endpoint that reports reviewed/total, pending keywords and completed/failed batches.
- A synchronized release-version contract test covering `VERSION`, FastAPI, frontend package metadata and the README.

### Changed

- 将相关性展示统一为竞品 ASIN 占比（如 `5/20`），保留独立的 0–100 语义评分，并让接口按产品实际竞品数动态计算分母。
- 增量 MiMo 审核改为可查询的后台分批任务，广告建议页显示已审核数、总数和批次进度，刷新页面后自动恢复状态。
- MiMo 审核沿用网页端 GPT 更新后的并发 v2 边界：仅远程模型请求并发（默认 4、上限 8），SQLite 决策写入按批次顺序单线程落库；失败批次保留待审核并支持增量重试。
- 关键词、词根、广告建议和导出页统一以月搜索量降序为默认排序；广泛投放只保留产品级核心词根，投放建议不产生词组匹配。
- 远端主干的仓库治理更新已纳入本版本：最小 CI 权限、重复任务取消、超时、依赖完整性/编译门禁、真实 Vitest、分组 Dependabot，以及 API 支持层和 AI transport 的职责拆分。

### Fixed

- 新建产品在未导入关键词表时不再虚构 20 个竞品 ASIN 或显示 MiMo 审核中；导入有效关键词后自动从“准备中”转为可用状态。
- 持久化当前选中产品并防止切换产品时旧的异步关键词请求覆盖新页面，刷新后仍停留在用户选中的产品。
- 空词库概览不再显示 `NaN%`，MiMo 全量审核按钮会明确提示先导入关键词。
- 竞品相关性改为产品级 ASIN 覆盖率（例如 `5/20`），不再把固定 20 或独立语义分数当成相关性；低于 30% 的建议自动降为观察。
- `room decor` 等泛装饰完整搜索词只建议否定精准，不会把 `room` 词根升级为否定词组；低相关、低覆盖和低搜索量词不会被误投精准。
- 真实 SellerSprite 多行更新会合并关键词来源 ASIN，保留异常原始指标；人工锁定字段不会被重新导入或 MiMo 覆盖。
- 重复点击后台审核不会创建第二个任务；新产品/空词库不会显示虚假的审核进度或竞品关系。

### Verification

- Backend: `17 passed, 1 skipped`，包含 API、导入、规则、并发语义审核和刷新安全进度测试。
- Frontend: `8 passed`，并通过 TypeScript/Vite production build。
- `git diff --check` clean；公开仓库不包含真实 SellerSprite 文件、数据库或 MiMo API Key。

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
