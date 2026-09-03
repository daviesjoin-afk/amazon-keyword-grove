# Contributing to Keyword Grove

感谢你帮助改进 Keyword Grove。这个项目处理亚马逊关键词、竞品 ASIN 和广告建议草稿，因此维护时优先保证 **数据安全、可审查性和不自动执行广告动作**。

## 开发环境

- Python 3.11+
- Node.js 20+
- pnpm 9.15.x（项目通过 `packageManager` 固定版本）

```powershell
git clone https://github.com/daviesjoin-afk/amazon-keyword-grove.git
cd amazon-keyword-grove

python -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt

corepack enable
Push-Location frontend
pnpm install --frozen-lockfile
Pop-Location
```

## 本地验证

提交 PR 前至少运行：

```powershell
backend\.venv\Scripts\python.exe -m compileall -q backend
backend\.venv\Scripts\python.exe -m pip check
backend\.venv\Scripts\python.exe -m pytest backend\tests -q

Push-Location frontend
pnpm test
pnpm build
Pop-Location
```

GitHub Actions 会重复执行这些关键检查。不要通过跳过测试、放宽断言或使用 `--passWithNoTests` 来让 CI 人为变绿。

## 数据与密钥

不要提交以下内容：

- SellerSprite 或其他来源的真实业务导出文件
- SQLite 数据库、日志、临时分析文件
- AI / OpenAI-compatible API Key
- 客户或竞品相关的非公开业务数据

需要演示时，请使用合成数据或仓库内的 mock 数据。发现疑似密钥泄漏时，请按照 [SECURITY.md](./SECURITY.md) 处理，不要在公开 Issue 中粘贴密钥。

## 业务安全边界

广告建议必须保持为 **待审批草稿**。任何变更都不应：

1. 自动调用 Amazon Ads 执行投放、调价或否词；
2. 绕过人工锁定（manual lock）覆盖人工判断；
3. 把低相关度、低覆盖或低搜索量词静默升级为高置信度投放；
4. 在 API 响应、日志或前端状态中回显完整 AI API Key。

如果确实要改变这些边界，PR 必须显式说明风险、迁移方案和回滚方式。

## Pull Request 约定

- 一次 PR 尽量只解决一个主题；避免把重构、功能和依赖升级混在一起。
- 描述用户可见影响、数据格式影响、测试证据和回滚方式。
- 新增规则或修复回归时，应补对应测试。
- 修改持久化结构时，必须说明兼容性与迁移路径。
- 保持 `CHANGELOG.md` 的 `[Unreleased]` 区域同步。

推荐提交前缀：`feat:`、`fix:`、`test:`、`docs:`、`refactor:`、`chore:`。

## 项目结构

架构与关键数据流见 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)。
