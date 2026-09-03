# Keyword Grove · 亚马逊关键词库管理工具

[![CI](https://github.com/daviesjoin-afk/amazon-keyword-grove/actions/workflows/ci.yml/badge.svg)](https://github.com/daviesjoin-afk/amazon-keyword-grove/actions/workflows/ci.yml)

**Version 0.2.1 · MIT License · Local-first**

Keyword Grove 是一个本地优先的亚马逊 SellerSprite 关键词反查表管理工具。它面向多个产品和竞品 ASIN，使用产品标题、五点、核心词根、内置规则和 MiMo 语义审核生成可下载的广告建议草稿。

真实导入数据只保存在本地：示例批次包含 20 个竞品 ASIN、2,000 条关键词；这些业务数据不会提交到 GitHub。

> 核心边界：本项目只生成待人工审批的广告建议，不连接 Amazon Ads，也不会自动执行投放、调价或否词。

[架构说明](./docs/ARCHITECTURE.md) · [贡献指南](./CONTRIBUTING.md) · [安全策略](./SECURITY.md) · [产品需求](./PRD-亚马逊关键词库管理工具.md) · [发布记录](./CHANGELOG.md)

## 功能

- 多产品隔离的关键词库、竞品 ASIN 来源和增量导入批次
- 动态识别 SellerSprite `.xlsx`、`.xlsm`、`.csv` 表头，保留原始值和扩展字段
- 产品资料维护：自定义名称、标题、五点和自动推断的多词核心词根
- 强/中/弱/不相关分类、词根分析、月搜索量默认降序排序
- 双重审核：内置规则预审 + MiMo v2.5 语义审核；支持全量审核和增量审核，审核结果持久化
- 广告建议分为精准投放、广泛投放、否定精准、否定词组和观察；投放不提供词组匹配
- 低相关度（默认低于 30% 竞品覆盖）、低竞品覆盖或低搜索量词会被降级为观察；否定词组保留更严格的冲突检查
- 相关性按竞品 ASIN 占比显示（如 `5/20`），另保留 0–100 语义评分、审核理由、置信度、风险和证据详情；各类建议均可导出 CSV
- MiMo 接口在工作台的“AI 语义设置”中配置，API Key 只写入本地数据库且不会回显
- 所有广告动作都是待审批草稿，不连接 Amazon Ads，也不会自动执行投放或否词

## 设计原则

1. **Local-first**：真实关键词库、导入文件衍生数据和 AI 配置留在本机。
2. **Human-in-the-loop**：自动规则和语义审核只提供建议，人工判断可以锁定且不会被再次导入覆盖。
3. **Fail-safe recommendations**：低相关、低覆盖和低搜索量优先降级为观察，否定词组采用更严格的冲突检查。
4. **Auditable**：保留分类理由、置信度、风险、来源 ASIN 和历史信息，便于复核。
5. **Reproducible builds**：前端使用 frozen lockfile，CI 同时验证后端、前端测试和 production build。

## 技术栈

- Backend: FastAPI、SQLite、openpyxl、pytest
- Frontend: React、TypeScript、Vite、Vitest
- 本地服务：前端 `5173`，后端 `8765`

架构、数据流和 trust boundaries 见 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)。

## 快速开始

需要 Python 3.11+、Node.js 20+ 和 pnpm 9.15.x。

```powershell
git clone https://github.com/daviesjoin-afk/amazon-keyword-grove.git
cd amazon-keyword-grove

# 首次安装后端依赖
python -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt

# 首次安装前端依赖
corepack enable
Push-Location frontend
pnpm install --frozen-lockfile
Pop-Location

# 启动本地服务
.\start.ps1
```

启动后访问：

- 管理页面：http://127.0.0.1:5173
- API 文档：http://127.0.0.1:8765/docs

也可以分别启动后端和前端，详见 `start.ps1`。日志写入本地 `logs/`。

## 配置与数据安全

复制 `.env.example` 可查看可选配置。业务数据库默认为 `backend/data/keyword-grove.db`，也可以通过 `KEYWORD_DB_PATH` 指向其他 SQLite 文件。数据库、日志、构建产物、虚拟环境和 `.env` 已加入 `.gitignore`，不会随代码提交。

MiMo 的 API Key 请在页面的“AI 语义设置”中填写，不要写入源码、README、Issue 或提交记录。读取配置时只返回脱敏信息。

真实 SellerSprite 导出、客户数据、API Key 和本地数据库不应出现在公开仓库、Issue、PR 描述或截图中。安全问题请按 [SECURITY.md](./SECURITY.md) 处理。

## 验证

提交前建议完整执行：

```powershell
backend\.venv\Scripts\python.exe -m compileall -q backend
backend\.venv\Scripts\python.exe -m pip check
backend\.venv\Scripts\python.exe -m pytest backend\tests -q

Push-Location frontend
pnpm test
pnpm build
Pop-Location
```

前端测试不允许使用 `--passWithNoTests` 绕过测试缺失；GitHub Actions 会在 PR 和 `main` 推送时重复执行关键验证。

## 当前定位与限制

- 当前面向本地单用户工作流；SQLite 不是多租户服务端架构。
- MiMo/OpenAI-compatible 语义审核属于辅助层，关键广告判断仍保留规则保护与人工审批。
- 项目不承诺广告效果，导出的 CSV 是决策草稿，不是自动执行指令。
- 已知工程技术债与后续拆分方向记录在 [架构说明](./docs/ARCHITECTURE.md#当前技术债)。

## 许可证

本项目采用 [MIT License](./LICENSE)。
