---
description: 解除阻塞 — 记录解决方案，恢复任务执行
---

# /wsd:unblock

**用法**：`/wsd:unblock [req-id] [task-id] <解决方案说明>`

## 执行流程

1. 更新 `tasks.md` 中对应任务状态从 `BLOCKED` 回到 `TODO`
2. 在 `meta.json` 的 blockers 记录中追加解决信息
3. 展示可继续执行的任务
4. 记录审计日志

## 解除记录追加

```json
{
  "resolvedAt": "2026-04-14T16:00:00Z",
  "resolvedBy": "weizhen",
  "resolution": "payment-team提供了API文档，接口为POST /api/v1/payment/charge"
}
```
