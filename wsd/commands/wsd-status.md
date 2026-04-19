---
description: 查看需求状态看板 — 展示所有需求的当前阶段和健康状态
---

# /wsd:status

**用法**：`/wsd:status [--filter <status>] [--owner <name>]`

## 执行流程

1. 读取 `.wsd/requirements/` 下所有 `meta.json`
2. 汇总状态，按阶段分组展示
3. 标记超时或阻塞的需求

## 输出格式

```
📊 WSD 需求看板 — <project-name>
更新时间：YYYY-MM-DD HH:mm

┌─────────────────────────────────────────────────────────┐
│  PROPOSED(2)  SPEC(1)  PLAN(1)  EXECUTING(2)  DONE(3)  │
└─────────────────────────────────────────────────────────┘

🟡 PROPOSED（等待生成规格）
  REQ-20260414-001  [weizhen]  用户认证系统重构     2天前
  REQ-20260413-002  [xiaoming] 支付流程优化         3天前

🔵 SPEC_APPROVED（等待规划）
  REQ-20260412-001  [weizhen]  搜索功能增强         1天前

🟠 EXECUTING（实现中）
  REQ-20260410-001  [weizhen]  消息推送系统   ████░░ 4/6任务  ⚠️ T-003阻塞
  REQ-20260409-002  [xiaoming] 报表导出功能   ██░░░░ 2/8任务

✅ DONE（等待归档）
  REQ-20260405-001  [weizhen]  用户头像上传          5天前
  REQ-20260403-001  [xiaoming] 邮件通知              7天前
  REQ-20260401-001  [lihua]    数据导出              9天前

⚡ 警告
  REQ-20260410-001: T-003 阻塞已超过 48 小时
  REQ-20260409-002: 进度缓慢，8个任务3天仅完成2个
```
