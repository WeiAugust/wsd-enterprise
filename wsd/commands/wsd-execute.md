---
description: 驱动分阶段实现 — 在隔离子代理中按任务清单逐步执行
---

# /wsd:execute

**用法**：`/wsd:execute [req-id] [task-id]`

**参数**：
- `$ARGUMENTS`：需求ID（可选）+ 任务ID（可选，不传则从下一个 TODO 任务开始）

## 前置条件

需求状态必须为 `PLAN_APPROVED` 或 `EXECUTING`。

## 核心设计：上下文隔离

每个任务在独立的 `wsd-executor` 子代理中执行，原因：
1. **防止 Context Rot**：长对话导致质量下降
2. **并行可能**：无依赖的任务可并行执行
3. **隔离失败**：单个任务失败不影响其他任务
4. **清晰追踪**：每个任务有独立的执行记录

## 执行流程

### Step 1 — 读取任务清单

读取 `.wsd/requirements/<req-id>/tasks.md`，找出所有 `TODO` 状态的任务，按依赖顺序排列。

若指定了 `task-id`，直接执行该任务（检查依赖是否已完成）。

### Step 2 — 上下文检查

检查当前上下文使用量：
- < 60%：正常执行
- 60-80%：输出警告，询问是否继续
- > 80%：**阻止执行**，要求开启新会话

### Step 3 — 启动任务执行子代理

为每个任务构建完整的上下文包，传入 `wsd-executor` 子代理：

```
上下文包内容：
1. 任务详情（tasks.md 中该任务的完整描述）
2. 完成标准（Done Criteria）
3. 相关规格（functional.md 对应场景）
4. 相关代码区域（由 code-explorer 预先分析）
5. 已完成任务的 commit SHA（用于理解已有实现）
6. 编码规范（来自项目 CLAUDE.md 和 rules/）
```

**AI 统计注入**：启动子代理前，设置环境变量 `WSD_REQ_ID=<req-id>`，使 `ai-code-tracker.js` Hook 能自动将本次执行的 Write/Edit 操作关联到正确的需求。

### Step 4 — 实时进度展示

执行过程中，持续更新：
- 当前执行任务
- 已完成 / 进行中 / 待执行 的计数
- 最新 commit 信息

### Step 5 — 任务完成验证

每个任务完成后：
1. 检查"完成标准"中的每一项
2. 运行相关测试，确认通过
3. 更新 `tasks.md` 中任务状态为 `DONE`
4. 记录 commit SHA 到 `.wsd/requirements/<req-id>/implementation/commits.json`

### Step 6 — 阶段完成检查

所有任务 `DONE` 后：
1. 更新需求状态为 `IMPLEMENTED`
2. 提示进入验收阶段：
   ```
   ✅ 所有任务已完成！
   
   下一步：运行验收检查
     /wsd:verify <req-id>
   ```

## 阻塞处理

执行过程中遇到阻塞（技术问题、依赖缺失、需求不清晰），调用 `/wsd:block`：

```
⚠️ 任务 T-003 执行受阻

原因：外部支付API文档缺失，无法确定接口格式
阻塞时间：2026-04-14 14:30

标记为阻塞后，可继续执行其他无依赖任务：
  T-006: 编写前端页面（无依赖 T-003）
  T-007: 文档更新（无依赖 T-003）
```

## 进度文件 — progress.md

实时维护 `.wsd/requirements/<req-id>/implementation/progress.md`：

```markdown
# 实现进度 — REQ-YYYYMMDD-NNN

> 更新：YYYY-MM-DD HH:mm | 进度：3/6 任务完成

## 进度概览

✅ T-001: 初始化数据库迁移 (commit: abc1234)
✅ T-002: 定义用户数据模型 (commit: def5678)
✅ T-003: 实现用户注册接口 (commit: ghi9012)
🔄 T-004: 实现用户登录接口 (执行中...)
⏳ T-005: 编写单元测试
⏳ T-006: 编写E2E测试

## 当前任务详情

**T-004: 实现用户登录接口**
- 已完成：JWT令牌生成逻辑
- 进行中：密码验证和错误处理
- 待完成：刷新令牌逻辑
```
