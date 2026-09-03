# Keyword Grove · 亚马逊关键词库管理工具

**Version 0.2.1 · MIT License**

Keyword Grove 是一个本地优先的亚马逊 SellerSprite 关键词反查表管理工具。它面向多个产品和竞品 ASIN，使用产品标题、五点、核心词根、内置规则和 MiMo 语义审核生成可下载的广告建议草稿。

真实导入数据只保存在本地：示例批次包含 20 个竞品 ASIN、2,000 条关键词；这些业务数据不会提交到 GitHub。

## 功能

- 多产品隔离的关键词库、竞品 ASIN 来源和增量导入批次
- 动态识别 SellerSprite `.xlsx`、`.xlsm`、`.csv` 表头，保留原始值和扩展字段
- 产品资料维护：自定义名称、标题、五点和自动推断的多词核心词根
- 强/中/弱/不相关分类、词根分析、月搜索量默认降序排序
- 双重审核：内置规则预审 + MiMo v2.5 语义审核；支持全量审核和增量审核，审核结果持久化
- 广告建议分为精准投放、广泛投放、否定精准、否定词组和观察；投放不提供词组匹配
- 低相关度、低竞品覆盖或低搜索量词会被降级为观察；否定词组保留更严格的冲突检查
- 审核理由、相关度、置信度、风险、竞品覆盖和证据详情；各类建议均可导出 CSV
- MiMo 接口在工作台的“AI 语义设置”中配置，API Key 只写入本地数据库且不会回显
- 所有广告动作都是待审批草稿，不连接 Amazon Ads，也不会自动执行投放或否词

## 技术栈

- Backend: FastAPI、SQLite、openpyxl
- Frontend: React、TypeScript、Vite、Vitest
- 本地服务：前端 `5173`，后端 `8765`

## 快速开始

需要 Python 3.11+、Node.js 20+ 和 pnpm。

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

## 验证

```powershell
backend\.venv\Scripts\python.exe -m pytest backend\tests -q
Push-Location frontend
pnpm test
pnpm build
Pop-Location
```

产品需求文档见 [PRD-亚马逊关键词库管理工具.md](./PRD-亚马逊关键词库管理工具.md)。发布记录见 [CHANGELOG.md](./CHANGELOG.md)。

## 许可证

本项目采用 [MIT License](./LICENSE)。
