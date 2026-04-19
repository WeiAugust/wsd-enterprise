---
description: 回退阶段 — 将需求回退到上一阶段，允许重新执行
---

# /wsd:rollback

**用法**：`/wsd:rollback [req-id] [--to <phase>]`

## 执行流程

1. 展示当前状态和可回退的目标阶段
2. **要求用户确认**（这是破坏性操作）
3. 更新 `meta.json` 状态
4. 保留所有历史文档（不删除，仅修改状态）
5. 记录审计日志（包含回退原因）

## 回退规则

| 当前状态 | 可回退到 |
|---------|---------|
| SPECCING / SPEC_APPROVED | PROPOSED |
| PLANNING / PLAN_APPROVED | SPEC_APPROVED |
| EXECUTING / BLOCKED | PLAN_APPROVED |
| IMPLEMENTED | PLAN_APPROVED |
| VERIFYING | IMPLEMENTED |
| DONE | VERIFYING |

## 确认交互

```
⚠️ 确认回退操作

需求：REQ-20260414-001 — 用户认证系统重构
当前状态：SPEC_APPROVED
回退到：PROPOSED

影响：
  - 当前规格文档将被标记为废弃（不删除）
  - 需要重新运行 /wsd:spec 生成新规格

确认回退？(yes/no):
```
