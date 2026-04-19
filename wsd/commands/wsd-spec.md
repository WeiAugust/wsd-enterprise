---
description: 生成行为规格 — 将提案转化为BDD格式的可验证规格文档
---

# /wsd:spec

**用法**：`/wsd:spec [req-id]`

**参数**：
- `$ARGUMENTS`：需求ID（可选，不传则使用当前活跃需求）

## 前置条件

需求状态必须为 `PROPOSED`。否则提示：
- `SPEC_APPROVED` 及之后：规格已存在，如需修改请先 `/wsd:rollback`
- 其他状态：展示当前状态，说明不符合条件

## 执行流程

### Step 1 — 读取提案

读取 `.wsd/requirements/<req-id>/proposal.md`，提取：
- 核心功能范围
- 验收标准草稿
- 技术约束
- 边界条件

### Step 2 — 代码库分析（调用子代理）

调用 `code-explorer` 代理，分析当前代码库：
- 与需求相关的现有模块
- 可复用的接口和数据模型
- 潜在的影响范围

### Step 3 — 生成行为规格（调用 wsd-analyst）

调用 `wsd-analyst` 代理，基于提案和代码分析结果，生成：

1. **functional.md** — 功能规格（GIVEN/WHEN/THEN 格式）
2. **acceptance.md** — 验收规格（可测试的验收条件）

### Step 4 — 生成技术方案初稿（调用 wsd-architect）

调用 `wsd-architect` 代理，生成：
- **design.md** — 技术方案（架构选型、接口定义、数据模型）

### Step 5 — 暂停等待人工确认

展示生成的三份文档，并提示：

```
📋 规格文档已生成，请审查后确认：

  .wsd/requirements/<req-id>/specs/functional.md
  .wsd/requirements/<req-id>/specs/acceptance.md
  .wsd/requirements/<req-id>/design.md

⚠️  规格确认后将锁定需求范围。执行以下命令确认：
  /wsd:approve-spec <req-id>   — 确认规格，进入规划阶段
  /wsd:rollback <req-id>       — 需要重新访谈
```

**不要**自动推进状态，必须等待用户运行 `/wsd:approve-spec`。

## 产物格式

### functional.md

```markdown
# 功能规格 — REQ-YYYYMMDD-NNN

> 版本：1.0 | 状态：DRAFT | 生成于：YYYY-MM-DD

## Feature: <功能名称>

### Scenario 1: <场景名称>

**Given** <前置条件>
**When** <触发动作>
**Then** <期望结果>
**And** <附加期望>

### Scenario 2: <边界场景>

**Given** <前置条件>
**When** <触发动作>
**Then** <期望结果>

### Scenario 3: <错误场景>

**Given** <前置条件>
**When** <错误触发>
**Then** <错误处理结果>

## 数据规格

### 输入数据

| 字段 | 类型 | 必填 | 约束 | 说明 |
|------|------|------|------|------|
| ...  | ...  | ...  | ...  | ...  |

### 输出数据

| 字段 | 类型 | 说明 |
|------|------|------|
| ...  | ...  | ...  |

## 非功能规格

- 性能：<响应时间要求>
- 安全：<权限和鉴权要求>
- 兼容性：<版本兼容要求>
```

### acceptance.md

```markdown
# 验收规格 — REQ-YYYYMMDD-NNN

> 以下每条验收条件都必须通过，才能标记需求为 DONE

## 验收清单

### 功能验收

- [ ] AC-001：<具体可验证的验收条件>
- [ ] AC-002：<具体可验证的验收条件>

### 性能验收

- [ ] AC-P01：<性能指标>

### 安全验收

- [ ] AC-S01：<安全要求>

### 边界验收

- [ ] AC-B01：<边界条件处理>

## 自动化测试要求

- 单元测试覆盖率：≥ 80%
- E2E 测试：覆盖主流程和关键边界场景
```
