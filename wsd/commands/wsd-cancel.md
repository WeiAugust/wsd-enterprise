---
description: 取消需求 — 将需求标记为已取消，保留历史记录
---

# /wsd:cancel

**用法**：`/wsd:cancel <req-id> <取消原因>`

需求可在任何阶段取消，但需记录原因（用于统计和追溯）。

## 执行流程

1. 需 team-lead 确认（不可自行取消他人的需求）
2. 记录取消原因（业务调整/重复/优先级变化/技术不可行）
3. 如有进行中的实现代码，提示处理方式（保留分支/删除/合并为其他需求）
4. 状态设为 `CANCELLED`，从活跃看板移除，保留于归档区

## 取消原因分类

```json
{ "cancelReason": "BUSINESS_CHANGE | DUPLICATE | DEPRIORITIZED | TECH_INFEASIBLE | OTHER" }
```

## 重新激活

已取消需求可重新激活：`/wsd:reactivate <req-id>`
→ 状态回到 `PROPOSED`，保留原有文档作为历史参考
