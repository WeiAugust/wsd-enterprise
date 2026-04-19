---
description: 验收阶段 Bug 修复 — 在 VERIFYING 阶段发现 bug 时，追踪修复过程并重新验收
---

# /wsd:bugfix

**用法**：`/wsd:bugfix <req-id> <bug描述>`

**触发时机**：`/wsd:verify` 报告发现 FAIL/PARTIAL 条件时自动提示，或手动触发。

## 与普通阻塞的区别

| | wsd:block | wsd:bugfix |
|---|---------|-----------|
| 阶段 | EXECUTING | VERIFYING |
| 原因 | 外部阻塞（依赖缺失、需求不清） | 实现缺陷（代码逻辑错误） |
| 状态 | BLOCKED | BUGFIX |
| 解决后 | 继续执行 | 重新验收 |

## 执行流程

### Step 1 — Bug 分类

`wsd-verifier` 自动分类：

| 类型 | 说明 | 处理 |
|------|------|------|
| **实现缺陷** | 代码逻辑错误 | bugfix → 重新验收 |
| **规格遗漏** | 规格中未覆盖此场景 | amend 补规格 → bugfix |
| **测试误报** | 测试用例本身写错了 | 修正测试 → 重新验收 |
| **环境问题** | CI/部署环境差异导致 | 环境修复 → 重新验收 |

### Step 2 — 创建 Bug 记录

在 `.wsd/requirements/<req-id>/bugs/` 下创建：

```markdown
# BUG-001: 并发登录限制未生效

> 对应验收条件：AC-003
> 发现于：VERIFYING 阶段
> 严重度：HIGH

## 现象
同一账号第4个设备登录时，第1个设备未被踢出

## 根因分析
`session.service.ts:45` 的并发检查查询条件错误，
使用了 `createdAt` 而非 `lastActiveAt`

## 修复方案
修改查询条件，补充边界测试
```

### Step 3 — 执行修复（wsd-executor）

创建针对性的修复任务，在隔离子代理中执行。

### Step 4 — 自动重新验收

修复完成后，**仅重新验收**失败的验收条件（不重跑全部）：

```
🔬 重新验收失败条件（1/10）

AC-003: 并发登录限制
  之前：❌ FAIL
  现在：✅ PASS

所有条件已通过，需求可以标记为 DONE
运行：/wsd:approve-verify <req-id>
```

## Bug 统计

归档时，bug 记录计入需求质量指标：
- bug 数量、严重度分布
- 修复周期
- 是否源于规格遗漏（用于改进提案质量）
