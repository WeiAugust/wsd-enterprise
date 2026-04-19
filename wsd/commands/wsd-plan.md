---
description: 拆解实现计划 — 将规格转化为原子任务清单（每任务≤2小时）
---

# /wsd:plan

**用法**：`/wsd:plan [req-id]`

**参数**：
- `$ARGUMENTS`：需求ID（可选，不传则使用当前活跃需求）

## 前置条件

需求状态必须为 `SPEC_APPROVED`。

## 执行流程

### Step 1 — 读取规格文档

读取：
- `.wsd/requirements/<req-id>/specs/functional.md`
- `.wsd/requirements/<req-id>/specs/acceptance.md`
- `.wsd/requirements/<req-id>/design.md`

### Step 2 — 任务拆解（调用 wsd-planner）

调用 `wsd-planner` 代理，按以下原则拆解任务：

**拆解原则**：
- 每个任务独立可执行（不依赖同批其他任务的中间状态）
- 每个任务预估 ≤ 2 小时（超过则继续拆分）
- 每个任务有明确的"完成标准"（可验证）
- 任务按依赖关系排序（拓扑排序）

**任务类型**：
- `setup`：环境和配置准备
- `data-model`：数据模型/Schema定义
- `api`：接口实现
- `logic`：业务逻辑
- `ui`：前端页面/组件
- `test`：测试编写
- `integration`：集成和对接
- `docs`：文档更新

### Step 3 — 生成任务清单

生成 `.wsd/requirements/<req-id>/tasks.md`

### Step 4 — 暂停等待人工确认

展示任务清单，提示：
```
📋 实现计划已生成，共 N 个任务，预计 X 小时

请审查任务清单：
  .wsd/requirements/<req-id>/tasks.md

确认后执行：
  /wsd:approve-plan <req-id>  — 确认计划，开始实现
  /wsd:plan <req-id>          — 重新拆解（如不满意）
```

## 产物格式 — tasks.md

```markdown
# 实现任务清单 — REQ-YYYYMMDD-NNN

> 版本：1.0 | 状态：DRAFT | 总任务数：N | 预估总时间：Xh

## 任务总览

| 任务ID | 类型 | 描述 | 预估 | 依赖 | 状态 |
|--------|------|------|------|------|------|
| T-001 | setup | 初始化数据库迁移 | 0.5h | — | TODO |
| T-002 | data-model | 定义用户数据模型 | 1h | T-001 | TODO |
| T-003 | api | 实现用户注册接口 | 2h | T-002 | TODO |
| T-004 | api | 实现用户登录接口 | 1.5h | T-002 | TODO |
| T-005 | test | 编写注册/登录单元测试 | 1h | T-003,T-004 | TODO |
| T-006 | test | 编写E2E测试 | 1h | T-005 | TODO |

## 任务详情

### T-001: 初始化数据库迁移

**类型**：setup
**预估**：0.5h
**依赖**：无

**描述**：
创建用户相关的数据库迁移文件，建立 users 表基础结构。

**完成标准**：
- [ ] 迁移文件创建完成
- [ ] 本地运行迁移成功
- [ ] 迁移可回滚

**对应规格**：functional.md Scenario 1

---

### T-002: 定义用户数据模型

**类型**：data-model
**预估**：1h
**依赖**：T-001

**描述**：
定义 User 实体/模型，包含字段验证和数据转换逻辑。

**完成标准**：
- [ ] User 模型定义完整
- [ ] 字段验证规则实现
- [ ] 单元测试覆盖率 ≥ 80%

**对应规格**：functional.md 数据规格

---

## 实现顺序（依赖图）

```
T-001 → T-002 → T-003 ┐
                T-004 ┘ → T-005 → T-006
```

## 验收条件映射

| 验收条件 | 覆盖任务 |
|---------|---------|
| AC-001 | T-003, T-005 |
| AC-002 | T-004, T-005 |
| AC-P01 | T-003, T-004 |
```
