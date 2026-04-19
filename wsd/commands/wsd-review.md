---
description: 生成技术方案 — 基于规格设计架构方案，包含接口、数据模型、关键决策
---

# /wsd:review

**用法**：`/wsd:review [req-id]`

**参数**：
- `$ARGUMENTS`：需求ID（可选，不传则使用当前活跃需求）

## 前置条件

需求状态必须为 `PROPOSED` 或 `SPEC_APPROVED`。

## 执行流程

### Step 1 — 读取规格文档

读取已有的规格文档（如有）：
- `.wsd/requirements/<req-id>/proposal.md`
- `.wsd/requirements/<req-id>/specs/functional.md`（如已生成）

### Step 2 — 代码库分析

调用 `code-explorer` 代理分析：
- 与需求相关的现有模块
- 可复用的接口和数据模型
- 当前架构模式（供方案保持一致）
- 影响范围评估

### Step 3 — 生成技术方案（调用 wsd-architect）

调用 `wsd-architect` 代理，生成 `design.md`，包含：
- 架构概述（一段话）
- 影响范围（新建/修改的文件）
- API 设计（接口定义、请求/响应格式）
- 数据模型（新表/字段、索引）
- 关键技术决策（选型理由 + 备选方案对比）
- 安全考量
- 性能预期

### Step 4 — 展示并等待确认

展示生成的 `design.md`，提示：

```
🏗️  技术方案已生成

文件：.wsd/requirements/<req-id>/design.md

请审查技术方案，确认后执行：
  /wsd:plan <req-id>  — 基于此方案拆解实现任务

如需修改：
  编辑 design.md 后直接运行 /wsd:plan
  或重新运行 /wsd:review 重新生成
```

## 产物格式

见 `wsd-architect` 代理定义中的设计文档格式。

## 与 wsd:spec 的关系

- `/wsd:spec` 同时生成规格 + 技术方案初稿
- `/wsd:review` 单独生成/刷新技术方案（当规格已存在时使用）

典型用法：
- 首次：`/wsd:spec` → 同时生成规格和技术方案
- 规格修改后：`/wsd:review` → 仅刷新技术方案
