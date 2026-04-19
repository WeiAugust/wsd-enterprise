---
description: 列出所有需求 — 支持按状态、负责人、标签过滤
---

# /wsd:list

**用法**：`/wsd:list [--status <status>] [--owner <name>] [--tag <tag>] [--limit <n>]`

**示例**：
```
/wsd:list                          # 所有活跃需求
/wsd:list --status EXECUTING       # 执行中的需求
/wsd:list --owner weizhen          # 我负责的需求
/wsd:list --tag backend            # 后端相关需求
/wsd:list --status ARCHIVED        # 已归档需求
```

## 输出格式

```
📋 需求列表（共 8 条，显示 8 条）

ID                  状态          负责人      标题                      更新时间
─────────────────────────────────────────────────────────────────────────────
REQ-20260414-001  🔄 EXECUTING  weizhen    用户认证系统重构           2小时前
REQ-20260414-002  📝 PROPOSED   xiaoming   支付流程优化               1天前
REQ-20260413-001  ✅ SPEC_OK    weizhen    搜索功能增强               2天前
REQ-20260412-001  🔴 BLOCKED    lihua      消息推送系统               3天前  ⚠️
REQ-20260410-001  ✅ DONE       weizhen    用户头像上传               5天前
─────────────────────────────────────────────────────────────────────────────

💡 使用 /wsd:show <req-id> 查看详情
   使用 /wsd:status 查看看板视图
```
