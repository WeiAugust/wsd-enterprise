---
description: 标记需求为阻塞状态 — 记录阻塞原因，允许继续执行无依赖任务
---

# /wsd:block

**用法**：`/wsd:block [req-id] [task-id] <阻塞原因>`

## 执行流程

1. 更新 `tasks.md` 中对应任务状态为 `BLOCKED`
2. 在 `meta.json` 中记录阻塞信息
3. 分析任务依赖图，找出可继续执行的无依赖任务
4. 更新 `STATE.md`，标记需求为 `BLOCKED` 状态
5. 记录审计日志

## 阻塞记录格式（写入 meta.json）

```json
{
  "blockers": [{
    "taskId": "T-003",
    "reason": "外部支付API文档缺失，无法确定接口格式",
    "blockedAt": "2026-04-14T14:30:00Z",
    "blockedBy": "weizhen",
    "owner": "payment-team",
    "estimatedUnblockAt": null
  }]
}
```

## 输出

```
⚠️ T-003 已标记为阻塞

原因：外部支付API文档缺失，无法确定接口格式
阻塞所有者：@payment-team（请联系获取文档）

可继续执行的任务（无依赖 T-003）：
  T-006: 编写前端支付页面
  T-007: 文档更新

继续执行：/wsd:execute <req-id> T-006
解除阻塞：/wsd:unblock <req-id> T-003
```
