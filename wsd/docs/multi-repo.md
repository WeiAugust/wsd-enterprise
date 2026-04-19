# WSD 多仓库需求管理

> 一个需求涉及多个代码仓库（前后端分离、微服务）时的完整处理方案

---

## 核心模型：Scope（作用域）

每个需求可定义多个 **scope**，每个 scope 对应一个代码仓库：

```json
{
  "reqId": "REQ-20260415-001",
  "title": "用户头像上传功能",
  "scopes": [
    {
      "id": "backend",
      "repo": "company/user-service",
      "branch": "feature/REQ-20260415-001-backend",
      "description": "上传接口、文件存储、数据库",
      "owner": "weizhen",
      "status": "EXECUTING",
      "taskFile": ".wsd/requirements/REQ-20260415-001/tasks-backend.md",
      "progress": { "done": 3, "total": 5 }
    },
    {
      "id": "frontend",
      "repo": "company/user-web",
      "branch": "feature/REQ-20260415-001-frontend",
      "description": "上传组件、进度展示、预览",
      "owner": "xiaoming",
      "status": "PLAN_APPROVED",
      "taskFile": ".wsd/requirements/REQ-20260415-001/tasks-frontend.md",
      "progress": { "done": 0, "total": 4 }
    }
  ]
}
```

---

## 命令扩展

### `/wsd:propose` — 多仓库提案

```bash
/wsd:propose 用户头像上传功能 --scope backend:company/user-service --scope frontend:company/user-web
```

或在访谈过程中，`wsd-analyst` 检测到前后端需求后自动询问：

```
检测到此需求可能涉及多个仓库：
  1. 后端接口（company/user-service）
  2. 前端页面（company/user-web）

是否启用多仓库模式？(yes/no)
如果是，请确认各仓库负责人：
  backend scope → weizhen
  frontend scope → xiaoming
```

---

### `/wsd:spec` — 规格分层

生成统一规格（`specs/functional.md`），并为每个 scope 生成专属接口契约：

```
.wsd/requirements/REQ-xxx/
├── specs/
│   ├── functional.md          # 统一业务规格（GIVEN/WHEN/THEN）
│   ├── acceptance.md          # 统一验收条件
│   └── api-contract.md        # ⭐ 前后端接口契约（自动生成）
├── tasks-backend.md           # 后端任务清单
└── tasks-frontend.md          # 前端任务清单
```

**`api-contract.md`** 是多仓库的关键产物，由 `wsd-architect` 生成：
- 接口路径、HTTP 方法、请求/响应 Schema
- 前端依赖的字段（不能随意改名）
- 版本兼容约定

---

### `/wsd:plan --scope` — 分 scope 拆解任务

```bash
/wsd:plan REQ-20260415-001                    # 同时生成所有 scope 的任务
/wsd:plan REQ-20260415-001 --scope backend    # 只生成后端任务
/wsd:plan REQ-20260415-001 --scope frontend   # 只生成前端任务
```

前端任务自动依赖后端接口契约，`wsd-planner` 会标注：

```markdown
### T-F001: 实现上传组件

**依赖**：api-contract.md（后端接口定稳定后再实现）
**前置**：T-B003（后端上传接口）需先完成

**等待信号**：后端完成 T-B003 后，运行：
  /wsd:unblock REQ-xxx T-F001
```

---

### `/wsd:execute --scope` — 分 scope 执行

```bash
/wsd:execute REQ-20260415-001 --scope backend   # 在 user-service 仓库执行
/wsd:execute REQ-20260415-001 --scope frontend  # 在 user-web 仓库执行
/wsd:execute REQ-20260415-001                   # 并行执行所有 scope（无依赖时）
```

**执行隔离**：每个 scope 的 `wsd-executor` 子代理在对应仓库目录中执行，携带：
- 该仓库的 `.claude/` 配置（团队级资产）
- `api-contract.md`（跨仓库接口约定）
- 该 scope 的 `tasks-{scope}.md`

---

### `/wsd:sync-contract` — 接口契约变更通知

当后端接口发生变化时：

```bash
/wsd:sync-contract REQ-20260415-001
```

自动检测 `api-contract.md` 变更，通知受影响的 scope：

```
⚠️ 接口契约变更通知

REQ-20260415-001 的 api-contract.md 已更新：
  POST /api/v1/users/avatar
    变更：新增响应字段 thumbnailUrl（前端需使用）

影响 scope：frontend（T-F001、T-F003 需重新评估）

通知 xiaoming：/wsd:block REQ-xxx T-F001 接口契约已更新，请确认
```

---

### `/wsd:verify` — 集成验收

多仓库需求的验收分两步：

**Step 1 — 各 scope 独立验收**

```bash
/wsd:verify REQ-20260415-001 --scope backend   # 后端接口验收
/wsd:verify REQ-20260415-001 --scope frontend  # 前端功能验收
```

**Step 2 — 集成验收**（所有 scope PASS 后）

```bash
/wsd:verify REQ-20260415-001 --integration
```

`wsd-verifier` 在集成环境（staging）执行端到端验收：
- 前端页面发起上传 → 后端接收 → 存储 → 返回 → 前端展示
- 验证接口契约的实际符合情况
- 执行 E2E 测试（如已配置）

---

## 状态流转

多仓库需求的状态由**最落后的 scope 决定**：

```
需求整体状态 = min(scope1.status, scope2.status, ...)

backend: IMPLEMENTING (4/5)
frontend: PLAN_APPROVED
─────────────────────────────
整体: PLAN_APPROVED（等前端开始执行）
```

`/wsd:status` 展示：

```
⚡ REQ-20260415-001: 用户头像上传功能  [多仓库]

  backend  ████████░░ 4/5  EXECUTING  weizhen   → company/user-service
  frontend ░░░░░░░░░░ 0/4  PLAN_OK    xiaoming  → company/user-web

整体进度：44%（4/9 任务）
下一步：xiaoming 运行 /wsd:execute REQ-xxx --scope frontend
```

---

## 典型场景

### 前后端并行（接口契约稳定时）

```
1. /wsd:spec → 生成 api-contract.md
2. /wsd:plan --scope backend && /wsd:plan --scope frontend（并行）
3. /wsd:execute --scope backend &
   /wsd:execute --scope frontend &  （并行，前端 mock 后端接口）
4. 后端 T-B003 完成 → /wsd:unblock 前端依赖任务
5. /wsd:verify --scope backend
6. /wsd:verify --scope frontend
7. /wsd:verify --integration
```

### 前端等后端（接口未稳定时）

```
1. /wsd:spec → 生成 api-contract.md（草案）
2. /wsd:execute --scope backend → 后端先跑
3. 后端完成 → api-contract.md 更新为正式版
4. /wsd:sync-contract → 通知前端
5. /wsd:execute --scope frontend
```

### 微服务（3个服务同时变更）

在 `meta.json` 中定义3个 scope：`user-service`、`order-service`、`notification-service`，每个 scope 独立执行，共享统一规格文档。
