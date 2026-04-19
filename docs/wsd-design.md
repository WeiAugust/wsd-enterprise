# wsd — 需求生命周期管理插件设计文档

> 企业级 Claude Code 插件，打通从"一句需求"到"可验证交付"的完整链路
> 版本：v1.0 设计稿 | 日期：2026-04-14

---

## 一、定位与核心价值

### 1.1 解决的根本问题

| 问题 | 现象 | 根因 |
|------|------|------|
| **需求漂移** | AI 生成的代码与原始需求逐渐偏离 | 没有规范约束 AI 的执行边界 |
| **Context Rot** | 对话越长质量越差 | 上下文窗口污染，信噪比下降 |
| **交付不可验证** | 无法判断 AI 是否"做完了" | 没有任务清单和验收标准 |
| **跨会话失忆** | 新会话需重新解释背景 | 缺乏持久化的项目记忆 |
| **团队无法协作** | 每个人的 AI 各行其是 | 缺乏共享的规范契约 |

### 1.2 核心理念

```
需求 → 规格 → 计划 → 实现 → 验证 → 归档
  (人)   (AI+人) (AI+人) (AI)   (AI+人) (自动)
```

**三个核心原则**：
1. **规范先行**（Spec-First）：不允许跳过规格直接实现
2. **人机确认关卡**（Human Gates）：每个阶段完成必须人工确认才能进入下一阶段
3. **上下文隔离**（Context Isolation）：每个实现任务在独立的子代理中运行

### 1.3 与现有开源项目的关系

```
wsd = OpenSpec 生命周期管理
    + GSD 阶段驱动执行引擎
    + Superpowers 规格提取 + SDD 模式
    + Trellis 自动注入 + 项目记忆
    + OMC 模型路由 + 团队编排
    - 去除各自的冗余和过度复杂部分
    + 添加企业适配层（权限/合规/审计）
```

---

## 二、需求生命周期模型

### 2.1 七阶段生命周期

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WSD 需求生命周期                                   │
│                                                                      │
│  ① PROPOSE  ② SPEC  ③ REVIEW  ④ PLAN  ⑤ EXECUTE  ⑥ VERIFY  ⑦ ARCHIVE │
│                                                                      │
│  提案创建 → 规格生成 → 人工评审 → 计划拆解 → 分阶段实现 → 验收确认 → 归档 │
│                                                                      │
│  [人触发]  [AI生成]  [人确认]   [AI生成]  [AI执行]   [AI+人]  [自动]  │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 每阶段产物

| 阶段 | 触发命令 | AI 产物 | 人工操作 |
|------|---------|---------|---------|
| PROPOSE | `/wsd:propose` | `proposal.md`（范围、目标、背景） | 审核范围是否正确 |
| SPEC | `/wsd:spec` | `specs/`（行为规格 GIVEN/WHEN/THEN）| 签字确认规格 |
| REVIEW | `/wsd:review` | `design.md`（技术方案、架构决策）| 确认技术方向 |
| PLAN | `/wsd:plan` | `tasks.md`（原子任务清单，≤2h/任务）| 确认计划可执行 |
| EXECUTE | `/wsd:execute` | 代码 + 测试（子代理隔离执行） | 观察进度，处理阻塞 |
| VERIFY | `/wsd:verify` | `verification.md`（验收报告）| 最终确认交付质量 |
| ARCHIVE | 自动 | 规格合并到主规格库 | — |

### 2.3 状态机

```
PROPOSED
    │ /wsd:spec
    ▼
SPECCING
    │ [人工确认] 
    ▼
SPEC_APPROVED
    │ /wsd:plan
    ▼
PLANNING
    │ [人工确认]
    ▼
PLAN_APPROVED
    │ /wsd:execute
    ▼
EXECUTING ──── [阻塞] ──→ BLOCKED
    │ [子阶段循环]          │ /wsd:unblock
    ▼ [全部完成]            ▼
IMPLEMENTED              EXECUTING
    │ /wsd:verify
    ▼
VERIFYING
    │ [人工确认通过]
    ▼
DONE ──→ /wsd:archive ──→ ARCHIVED
    │ [人工确认失败]
    ▼
NEEDS_REWORK ──→ EXECUTING
```

---

## 三、目录结构

### 3.1 插件资产结构

```
wsd/
├── CLAUDE.md                     # 插件全局指令（注入每次会话）
├── commands/                     # 斜杠命令
│   ├── wsd-propose.md            # 创建需求提案
│   ├── wsd-spec.md               # 生成行为规格
│   ├── wsd-review.md             # 生成技术方案
│   ├── wsd-plan.md               # 生成实现计划
│   ├── wsd-execute.md            # 驱动分阶段实现
│   ├── wsd-verify.md             # 执行验收检查
│   ├── wsd-archive.md            # 归档已完成需求
│   ├── wsd-status.md             # 查看当前状态
│   ├── wsd-list.md               # 列出所有需求
│   ├── wsd-show.md               # 展示需求详情
│   ├── wsd-block.md              # 标记阻塞
│   ├── wsd-unblock.md            # 解除阻塞
│   ├── wsd-rollback.md           # 回退到上一阶段
│   └── wsd-import.md             # 从外部导入需求（Jira/飞书/GitHub Issues）
├── agents/                       # 专用子代理
│   ├── wsd-analyst.md            # 需求分析师（澄清 + 规格生成）
│   ├── wsd-architect.md          # 技术架构师（方案设计）
│   ├── wsd-planner.md            # 任务规划师（拆解 + 排期）
│   ├── wsd-executor.md           # 实现执行者（代码实现，sonnet）
│   ├── wsd-reviewer.md           # 代码审查员（质量 + 安全）
│   └── wsd-verifier.md           # 验收核查员（对照规格验收）
├── skills/                       # 自动触发技能
│   ├── wsd-lifecycle.md          # 生命周期感知（始终触发）
│   ├── wsd-spec-writing.md       # 规格编写指南
│   ├── wsd-deep-interview.md     # 需求深度访谈
│   └── wsd-context-guard.md      # 上下文守卫
├── hooks/                        # 自动化钩子
│   ├── lifecycle-guard.js        # 阻止跳过阶段
│   ├── spec-validator.js         # 规格格式验证
│   ├── context-monitor.js        # 上下文用量监控
│   └── session-inject.py         # 会话启动时注入项目状态
└── schemas/                      # JSON Schema
    ├── proposal.schema.json
    ├── spec.schema.json
    └── task.schema.json
```

### 3.2 项目运行时目录（`.wsd/`）

```
.wsd/
├── config.json                   # 项目配置（团队、集成、权限）
├── STATE.md                      # 当前全局状态（自动维护）
├── requirements/                 # 需求存储（每条需求一个目录）
│   └── <req-id>/
│       ├── proposal.md           # 需求提案
│       ├── specs/                # 行为规格
│       │   ├── functional.md
│       │   └── acceptance.md
│       ├── design.md             # 技术方案
│       ├── tasks.md              # 任务清单
│       ├── implementation/       # 实现记录
│       │   ├── progress.md
│       │   └── commits.json
│       ├── verification.md       # 验收报告
│       └── meta.json             # 状态、时间戳、负责人
├── specs/                        # 主规格库（归档后合并至此）
│   └── <feature-area>/
│       └── spec.md
├── workspace/                    # 个人工作区
│   └── <username>/
│       ├── journal.md            # 每日工作日志
│       └── session.md            # 当前会话上下文
└── audit/                        # 审计日志
    └── <date>.jsonl
```

---

## 四、核心命令详细设计

### 4.1 `/wsd:propose` — 需求提案

**触发**：`/wsd:propose <需求简述>`

**执行流程**：
```
1. 调用 wsd-analyst 代理进行深度访谈（最多5轮）
   - "这个需求的用户是谁？"
   - "成功的验收标准是什么？"
   - "有哪些已知约束？"
2. 生成 proposal.md（结构化范围文档）
3. 分配需求 ID（格式：REQ-YYYYMMDD-NNN）
4. 创建 .wsd/requirements/<req-id>/ 目录
5. 写入 meta.json（status: PROPOSED）
6. 向 wsd_manager 上报（如已配置）
```

**产物格式**：
```markdown
# REQ-20260414-001: <需求标题>

## 背景与动机
...

## 目标用户
...

## 核心功能范围
- [ ] 功能1
- [ ] 功能2

## 明确不包含（Out of Scope）
...

## 验收标准（草稿）
...

## 技术约束
...

## 依赖关系
...
```

---

### 4.2 `/wsd:spec` — 规格生成

**触发**：`/wsd:spec [req-id]`（不传则操作当前需求）

**执行流程**：
```
1. 读取 proposal.md
2. 调用 wsd-analyst 生成行为规格（GIVEN/WHEN/THEN 格式）
3. 分析代码库（调用 code-explorer 代理）找出影响范围
4. 生成 design.md（技术方案初稿）
5. 暂停，等待人工确认（输出预览 + 确认提示）
```

**规格格式（BDD）**：
```markdown
## Feature: <功能名>

### Scenario: <场景名>
GIVEN <前置条件>
WHEN <用户操作>
THEN <预期结果>
AND <附加断言>

### Scenario: <边界场景>
...
```

---

### 4.3 `/wsd:execute` — 分阶段实现

**触发**：`/wsd:execute [req-id] [--phase N]`

**执行机制（整合 GSD + Superpowers SDD）**：
```
1. 读取 tasks.md，解析任务列表
2. 按优先级分批执行（每批 ≤3 个任务）
3. 每个任务：
   a. 启动独立子代理（全新上下文，≤200K tokens）
   b. 注入：任务描述 + 相关规格 + 代码库上下文
   c. 执行：TDD 模式（先写测试，再实现）
   d. 完成后：子代理提交 unified diff
   e. 主代理审查 diff，确认无误后应用
4. 每批完成后更新 progress.md
5. 检测上下文用量（>60% 时警告，>80% 时强制换批）
6. 全部完成后自动触发 /wsd:verify
```

**上下文守卫机制**（来自 GSD）：
```javascript
// context-monitor.js
const WARN_THRESHOLD = 0.60;   // 60% 时警告
const BLOCK_THRESHOLD = 0.80;  // 80% 时强制刷新

// 监控策略：
// - 主代理只做调度（保持 30-40% 上下文占用）
// - 实现任务全部委托给子代理
// - 每个子代理任务完成后销毁
```

---

### 4.4 `/wsd:verify` — 验收核查

**触发**：自动（execute 完成后）或 `/wsd:verify [req-id]`

**执行流程**：
```
1. 读取 specs/acceptance.md 中的验收标准
2. 调用 wsd-verifier 代理逐条核查：
   - 代码实现是否覆盖所有场景
   - 测试是否通过（运行 test suite）
   - 是否有安全风险（调用 security-reviewer）
3. 生成 verification.md（PASS/FAIL + 详情）
4. PASS → 提示人工最终确认
5. FAIL → 标记问题，回退到 EXECUTING
```

---

## 五、企业适配设计

### 5.1 外部系统集成

#### Jira/飞书/GitHub Issues 集成
```json
// .wsd/config.json
{
  "integrations": {
    "jira": {
      "baseUrl": "https://company.atlassian.net",
      "project": "PROJ",
      "syncOnPropose": true,
      "syncOnArchive": true
    },
    "feishu": {
      "appId": "...",
      "docSpace": "team-docs",
      "notifyOnStatusChange": true
    },
    "github": {
      "repo": "org/repo",
      "issueLabel": "wsd-managed"
    }
  }
}
```

#### 同步方向
```
外部系统 (Jira/飞书)
    ↕ 双向同步
.wsd/requirements/
    ↓ 单向（完成后）
.wsd/specs/（主规格库）
```

### 5.2 权限控制

```json
// .wsd/config.json
{
  "permissions": {
    "propose": ["all"],              // 所有人可提案
    "spec_approve": ["tech-lead"],   // 只有技术负责人可审批规格
    "plan_approve": ["tech-lead", "pm"],
    "execute": ["dev"],              // 开发者执行
    "verify_approve": ["qa", "pm"],  // QA 和 PM 验收
    "archive": ["tech-lead"]
  }
}
```

### 5.3 审计日志

每个状态变更都写入 `.wsd/audit/`：
```jsonl
{"timestamp":"2026-04-14T10:00:00Z","reqId":"REQ-20260414-001","event":"PROPOSED","user":"weizhen","context":"..."}
{"timestamp":"2026-04-14T10:30:00Z","reqId":"REQ-20260414-001","event":"SPEC_APPROVED","user":"tech-lead","comment":"LGTM"}
```

### 5.4 多 AI 模型支持

整合 OMC 的模型路由策略，适配企业内部模型：
```json
// .wsd/config.json
{
  "modelRouting": {
    "analyst": "claude-opus-4-6",      // 需求分析用最强模型
    "architect": "claude-opus-4-6",    // 架构设计用最强模型
    "executor": "claude-sonnet-4-6",   // 实现用 sonnet（性价比）
    "reviewer": "claude-sonnet-4-6",
    "verifier": "claude-sonnet-4-6",
    "fallback": "internal-llm"         // 企业内部模型兜底
  }
}
```

---

## 六、与 wsd_manager 的联动

### 6.1 上报接口

wsd 在以下时机向 wsd_manager 上报事件：

```typescript
// wsd SDK 调用接口
wsdManager.report({
  event: 'REQUIREMENT_PROPOSED',
  reqId: 'REQ-20260414-001',
  team: 'backend',
  repo: 'user-service',
  user: 'weizhen',
  metadata: { title, scope, estimatedSize }
});
```

### 6.2 资产同步

wsd 启动时从 wsd_manager 拉取团队资产：
```bash
# 启动时自动执行（session-inject.py hook）
wsdm pull --layer=team --layer=repo
# 将团队/仓库级 agents/skills/rules 同步到 .claude/
```

### 6.3 统计上报

```typescript
// 执行完成后上报
wsdManager.metrics({
  reqId: 'REQ-20260414-001',
  tokensUsed: 45000,
  agentsSpawned: 7,
  testsGenerated: 23,
  linesOfCode: 512,
  cycleTime: '4h32m'  // propose → archive
});
```

---

## 七、安装与配置

### 7.1 插件安装

```bash
# 方式1：插件市场（推荐）
claude plugin marketplace add https://internal.company.com/claude-plugins
claude plugin install wsd@company-internal

# 方式2：直接安装
npx wsd-cc init

# 方式3：从 wsd_manager 分发（企业推荐）
wsdm deploy --user=weizhen --target=local
```

### 7.2 项目初始化

```bash
# 在项目目录执行
/wsd:init

# 引导流程：
# 1. 选择团队（从 wsd_manager 获取列表）
# 2. 配置外部系统集成
# 3. 设置权限
# 4. 生成 .wsd/config.json
# 5. 同步团队资产
```

### 7.3 日常工作流

```bash
# 典型一天的 wsd 使用流程

# 早上：查看待处理需求
/wsd:list --status=SPEC_APPROVED

# 开始开发新需求
/wsd:propose "用户注册支持手机号验证"

# AI 访谈后生成规格，确认规格
/wsd:spec
# [人工审核] 确认: yes

# AI 生成计划，确认计划
/wsd:plan
# [人工审核] 确认: yes

# 开始执行（AI 自动驱动）
/wsd:execute

# 执行完成后验收
/wsd:verify
# [人工最终确认]

# 归档
/wsd:archive
```

---

## 八、技术实现路线

### Phase 1（MVP，2周）
- [ ] 核心命令：propose / spec / plan / execute / verify / archive
- [ ] 基本状态机和文件结构
- [ ] 上下文守卫 hook
- [ ] 本地存储（`.wsd/` 目录）

### Phase 2（集成，2周）
- [ ] wsd-analyst / wsd-executor / wsd-verifier 代理
- [ ] Jira/飞书/GitHub Issues 集成
- [ ] wsd_manager 联动（资产拉取 + 事件上报）
- [ ] 审计日志

### Phase 3（企业化，2周）
- [ ] 权限控制
- [ ] 多 AI 模型路由
- [ ] 团队协作模式（多人并发同一需求）
- [ ] 可视化状态看板（通过 wsd_manager web UI）
