# 亚马逊关键词库管理工具后端 MVP

这是一个本地运行的 FastAPI + SQLite 服务。数据默认保存在 `backend/data/keyword-grove.db`；测试或部署时可通过 `KEYWORD_DB_PATH` 指定数据库文件。

## 启动

```powershell
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8765
```

健康检查：`GET http://127.0.0.1:8765/api/health`

## 导入

先创建产品，再向 `POST /api/products/{product_id}/imports` 上传 `file` 字段。支持 Seller Sprite 的 `.xlsx`/`.xlsm` 和 `.csv`。XLSX 默认寻找包含“关键词”表头的工作表，亦可通过 `sheet_name` 指定。`mapping_json` 可以传内部字段到原始列名的对象。

每次导入在一个 SQLite 事务内执行。原始行以 JSON 保存在关键词记录；无效百分比、裸数字 PPC 竞价等值保留原文并进入 `data_quality_flags`，不会被默认为零。

广告字段都是建议草稿。后端不连接 Amazon Ads，也不会自动执行否定；否定词组候选只有在用户提供排除词且当前词库通过保守安全检查时才会出现，并带高风险和人工审批标志。

## MiMo 语义审核

调用 `POST /api/products/{product_id}/semantic-review` 时，不传 `keyword_ids` 会选取当前产品全部未审核关键词。服务端默认按 40 条一批、4 批并发调用 MiMo，并对失败批次自动重试；响应会返回 `reviewed`、`successful_batches`、`failed_batches` 和 `partial`。失败批次不会标记为已审核，下一次增量审核只会重试这些未完成关键词。
