# WSD 系统设计文档

> wsd 插件 + wsd_manager 平台的完整架构设计
> 版本：v1.1 | 最后更新：2026-04-19

---

## 目录

1. [设计哲学](#一设计哲学)
2. [wsd 插件架构](#二wsd-插件架构)
3. [wsd_manager 平台架构](#三wsd_manager-平台架构)
4. [两者如何联动](#四两者如何联动)
5. [AI 编码统计系统](#五ai-编码统计系统)
6. [关键技术决策](#六关键技术决策)

---

## 一、设计哲学

### 1.1 三个根本问题

WSD 的设计起点是企业 AI 编码的三个根本性失败模式：

| 失败模式 | 现象 | 根因 |
|---------|------|------|
| **规格漂移** | AI 写的代码与业务需求逐渐偏离 | 没有约束 AI 执行边界的机制 |
| **Context Rot** | 会话越长质量越差，到后期 AI 开始"发疯" | 上下文窗口无限累积，信噪比崩溃 |
| **不可验证交付** | 说"做完了"但没人能快速验证 | 缺乏与规格对应的验收标准 |

这三个问题催生了 WSD 的三条设计铁律：

### 1.2 三条设计铁律

**铁律一：规范先行（Spec-First）**

任何代码实现必须先有对应规格。没有规格的代码 = 没有地基的楼。

```
用户说"加个功能" → AI 不直接写代码
                 → AI 先做需求澄清
                 → 人确认规格
                 → 然后才实现
```

这打破了"AI 直接帮你写代码"的直觉，但这正是企业场景与个人项目的关键区别：**企业需要可追溯、可审计、可回滚的交付物，而不是"能跑就行"的代码**。

**铁律二：人机确认关卡（Human Gates）**

每个阶段完成后，必须等待人工确认才能进入下一阶段。禁止 AI 自动推进。

```
SPEC 完成 → 暂停，等人确认 → 人说 yes → 进入 PLAN
PLAN 完成 → 暂停，等人确认 → 人说 yes → 进入 EXECUTE
```

关卡的存在不是为了减慢速度，而是为了在正确的节点留下"决策者签名"，确保 AI 不会在错误的方向上自动跑太远。

**铁律三：上下文隔离（Context Isolation）**

每个实现任务在独立的子代理中执行，任务完成后子代理销毁。

```
主代理（调度者，保持轻量）
  ├── 子代理 A → TASK-01 → 销毁
  ├── 子代理 B → TASK-02 → 销毁
  └── 子代理 C → TASK-03 → 销毁
```

这是 Context Rot 的根治方案，而非缓解方案。

### 1.3 设计哲学与参考项目的关系

WSD 不是从零发明的，而是站在六个开源项目的肩上：

```
WSD = OpenSpec (需求变更结构)
    + GSD      (上下文工程 + 阶段执行引擎)
    + Superpowers (技能自动触发 + SDD 模式)
    + Trellis  (规格注入 + 状态栏)
    + ECC      (资产格式标准 + 插件市场)
    + OMC      (模型路由 + 多代理编排)
    - 各自的冗余与过度复杂
    + 企业适配层（权限/合规/审计/外部集成）
```

核心取舍：**WSD 选择固化流程，而非提供工具箱**。参考项目大多给你工具，你自己组合；WSD 告诉你唯一正确的流程，并强制执行。这在企业场景下更有价值，因为企业需要的是可复制的交付质量，而不是个人自由度。

---

## 二、wsd 插件架构

### 2.1 整体结构

```
wsd/
├── CLAUDE.md              ← 行为基线（每次会话自动加载）
│                             含完整状态机、命令列表、场景决策树
│
├── commands/              ← 用户触发的斜杠命令（19个）
│   ├── wsd-propose.md     ← /wsd:propose
│   ├── wsd-spec.md        ← /wsd:spec
│   ├── wsd-plan.md        ← /wsd:plan
│   ├── wsd-execute.md     ← /wsd:execute
│   ├── wsd-verify.md      ← /wsd:verify
│   ├── wsd-archive.md     ← /wsd:archive（含AI统计计算）
│   ├── wsd-stats.md       ← /wsd:stats（AI编码统计查询）
│   ├── wsd-quickfix.md    ← /wsd:quickfix
│   ├── wsd-hotfix.md      ← /wsd:hotfix
│   ├── wsd-amend.md       ← /wsd:amend（变更分级M0-M4）
│   ├── wsd-bugfix.md      ← /wsd:bugfix
│   └── ...（状态/协作命令）
│
├── agents/                ← 专用子代理（6个）
│   ├── wsd-analyst.md     ← opus：需求澄清、规格生成、变更影响分析
│   ├── wsd-architect.md   ← opus：技术方案设计
│   ├── wsd-planner.md     ← sonnet：任务拆解
│   ├── wsd-executor.md    ← sonnet：代码实现（隔离上下文）
│   ├── wsd-reviewer.md    ← sonnet：代码审查
│   └── wsd-verifier.md    ← sonnet：验收核查
│
├── skills/                ← 自动触发技能（4个）
│   ├── wsd-lifecycle.md   ← 始终加载：感知当前需求状态
│   ├── wsd-context-guard.md ← 自动：上下文守卫
│   ├── wsd-spec-writing.md  ← 按需：BDD规格编写
│   └── wsd-deep-interview.md ← 按需：需求访谈技巧
│
├── hooks/                 ← 自动化守卫（Node.js脚本）
│   ├── lifecycle-guard.js    ← PreToolUse：阻止跳阶段
│   ├── context-monitor.js    ← PostToolUse：上下文监控
│   ├── audit-logger.js       ← PostToolUse：操作审计
│   ├── ai-code-tracker.js    ← PostToolUse：AI编码追踪
│   ├── ai-commit-analyzer.js ← git post-commit调用：计算指标
│   ├── ai-stats-calculator.js ← /wsd:verify和archive时调用
│   ├── session-inject.py     ← UserPromptSubmit：状态注入
│   ├── statusline.sh         ← statusLine：底部状态栏
│   └── git/
│       └── post-commit       ← git hook：触发AI统计分析
│
├── schemas/               ← JSON Schema验证
│   ├── proposal.schema.json
│   ├── spec.schema.json
│   └── task.schema.json
│
├── templates/             ← 文件模板
│   ├── wsd-config.json
│   ├── proposal.md
│   ├── spec.md
│   └── tasks.md
│
├── integrations/          ← 外部系统适配器
│   ├── jira.js            ← Jira 双向同步
│   └── feishu.js          ← 飞书任务/文档/Webhook
│
├── settings.json          ← hooks 配置模板
└── install.sh             ← 安装脚本（含git hook安装）
```

### 2.2 需求生命周期状态机

```
                        ┌─────────────┐
                        │   PROPOSED   │
                        └──────┬───────┘
                               │ /wsd:spec
                        ┌──────▼───────┐
                        │   SPECCING   │
                        └──────┬───────┘
                               │ [人工确认]
                        ┌──────▼───────┐
                        │SPEC_APPROVED │◄─── /wsd:rollback
                        └──────┬───────┘
                               │ /wsd:plan
                        ┌──────▼───────┐
                        │   PLANNING   │
                        └──────┬───────┘
                               │ [人工确认]
                        ┌──────▼───────┐
                        │PLAN_APPROVED │◄─── /wsd:rollback
                        └──────┬───────┘
                               │ /wsd:execute
                    ┌──────────▼──────────┐
           ┌────────│     EXECUTING        │────────┐
           │        └──────────┬──────────┘        │
           │                   │ [全部完成]          │ /wsd:block
           │        ┌──────────▼──────────┐        │
           │        │   IMPLEMENTED        │   ┌────▼────┐
           │        └──────────┬──────────┘   │ BLOCKED │
           │                   │ /wsd:verify   └────┬────┘
           │        ┌──────────▼──────────┐        │ /wsd:unblock
           │        │     VERIFYING        │◄───────┘
           │        └──────────┬──────────┘
           │    ┌──────────────┼──────────────┐
           │    │ [bug发现]    │ [人工通过]    │
           │  ┌─▼──────┐  ┌───▼───┐          │
           └─►│ BUGFIX │  │ DONE  │          │
              └─┬──────┘  └───┬───┘          │
                │ [修复]       │ /wsd:archive  │
                └─────────────►┌──────────────▼──┐
                               │    ARCHIVED      │
                               └─────────────────┘

快速通道：
PROPOSED ──/wsd:quickfix──► QUICK_EXECUTING ──► QUICK_DONE
HOT-xxx  ──/wsd:hotfix───► HOTFIX_EXECUTING ──► HOTFIX_DONE

变更流程：
任意阶段 ──/wsd:amend──► AMENDING ──► 回退到对应阶段
任意阶段 ──/wsd:cancel──► CANCELLED
```

### 2.3 代理分工与模型路由

| 代理 | 模型 | 触发时机 | 职责 |
|------|------|---------|------|
| `wsd-analyst` | opus | `/wsd:propose`, `/wsd:spec`, `/wsd:amend` | 需求澄清深度访谈、BDD规格生成、变更影响分析 |
| `wsd-architect` | opus | `/wsd:review` | 技术方案设计、架构决策、技术风险识别 |
| `wsd-planner` | sonnet | `/wsd:plan` | 任务拆解（≤2h/任务）、依赖图、优先级排序 |
| `wsd-executor` | sonnet | `/wsd:execute` | 代码实现（隔离子代理）、TDD、提交 |
| `wsd-reviewer` | sonnet | 每个任务完成后 | 代码质量审查、安全检查 |
| `wsd-verifier` | sonnet | `/wsd:verify` | 对照规格逐条验收、bug分类、质量报告 |

**模型路由原则**：
- `opus`：用于需要深度理解和创造性的阶段（需求、架构）
- `sonnet`：用于结构化执行任务（规划、实现、验收）
- 企业内部LLM：通过 `modelRouting.fallback` 配置兜底

### 2.4 变更分级系统（原创）

M0-M4 分级是 WSD 的核心原创特性，解决了"需求变更该回退多远"的管理难题：

```
M0：措辞/说明调整
    例："用户"改成"注册用户"
    处理：直接更新 proposal.md，无需回退

M1：范围小幅扩展（≤2个新场景）
    例：增加"手机号格式校验"
    处理：回退到 PLAN_APPROVED，补充任务

M2：接口/架构调整
    例：新增 OAuth 登录流程
    处理：回退到 SPEC_APPROVED，重新设计技术方案

M3：核心逻辑重构
    例：将 JWT 换成 Session 方案
    处理：回退到 SPECCING，重写规格和方案

M4：推倒重来
    例：整个功能方向变了
    处理：CANCEL 当前需求，新建 REQ
```

分级由 `wsd-analyst` 代理自动判断，给出分级理由，人工确认后执行回退。

### 2.5 项目运行时目录结构（`.wsd/`）

```
.wsd/
├── config.json                      ← 项目配置
├── STATE.md                         ← 全局状态（hooks自动维护）
│
├── requirements/                    ← 每条需求一个目录
│   └── REQ-20260419-001/
│       ├── proposal.md              ← 需求提案
│       ├── specs/
│       │   ├── functional.md        ← BDD 行为规格
│       │   └── acceptance.md        ← 验收标准
│       ├── design.md                ← 技术方案
│       ├── tasks.md                 ← 任务清单
│       ├── implementation/
│       │   ├── progress.md          ← 实时执行进度
│       │   └── commits.json         ← commit SHA 记录
│       ├── verification.md          ← 验收报告
│       ├── ai-stats.json            ← AI 编码统计
│       ├── ai-snapshots/            ← AI 写入快照
│       └── meta.json                ← 状态、时间戳、操作者
│
├── specs/                           ← 主规格库（归档后合并至此）
│   └── auth/
│       └── sms-login.md
│
├── workspace/                       ← 个人工作区
│   └── <username>/
│       └── journal.md
│
└── audit/                           ← 审计日志（不提交）
    └── 2026-04-19.jsonl
```

---

## 三、wsd_manager 平台架构

### 3.1 定位与价值

wsd（插件）解决的是**单个项目内**的需求交付问题。wsd_manager（平台）解决的是**企业维度**的资产治理问题：

| 维度 | wsd（项目级） | wsd_manager（企业级） |
|------|-------------|---------------------|
| 资产范围 | 当前项目的 `.claude/` | 全公司所有团队的资产 |
| 使用者 | 开发者 | 平台团队/技术负责人 |
| 核心操作 | 需求生命周期管理 | 资产发布/分发/审计 |
| 状态存储 | `.wsd/` 文件系统 | REST API + JSON 文件 |
| 部署方式 | Claude Code 插件 | Docker 容器服务 |

### 3.2 四层资产继承模型（原创）

```
┌──────────────────────────────────────────────────────────┐
│                   企业层 (Enterprise)                     │
│  Owner: CTO / 平台团队                                    │
│  资产：安全基线、合规规则、禁用列表、企业 MCP               │
├──────────────────────────────────────────────────────────┤
│                   部门层 (Department)                     │
│  Owner: 技术负责人 / 架构师                               │
│  资产：领域 agents、业务 skills、技术规范 rules             │
├──────────────────────────────────────────────────────────┤
│                   团队层 (Team)                           │
│  Owner: 技术 Leader                                       │
│  资产：团队 agents、工作流 skills、编码规范、质量 hooks      │
├──────────────────────────────────────────────────────────┤
│                   仓库层 (Repository)                     │
│  Owner: 项目 Maintainer                                   │
│  资产：项目专属 agents/commands/rules、构建 hooks           │
├──────────────────────────────────────────────────────────┤
│                   个人层 (Individual)                     │
│  Owner: 工程师本人                                         │
│  资产：个人 agents/skills、个人偏好 settings               │
└──────────────────────────────────────────────────────────┘
```

**继承规则**：
```
最终有效资产 = 企业层基线
             ∪ 部门层追加
             ∪ 团队层追加
             ∪ 仓库层追加
             ∪ 个人层追加
             （同名资产：下层覆盖上层）
             （Hooks：叠加执行，不互相覆盖）
             （CLAUDE.md：全部合并，按层级顺序）
```

### 3.3 核心模块

```
wsd_manager/
├── src/
│   ├── server.js                 ← Express API 服务器
│   ├── core/
│   │   ├── registry.js           ← 资产注册与继承解析
│   │   ├── requirements.js       ← 需求状态管理
│   │   ├── costs.js              ← Token 成本追踪
│   │   └── assetstore.js         ← 资产文件读写
│   └── routes/
│       ├── assets.js             ← /api/assets/*
│       ├── requirements.js       ← /api/requirements/*
│       ├── costs.js              ← /api/costs/*
│       ├── orgs.js               ← /api/orgs/*（组织管理）
│       ├── subscriptions.js      ← /api/subscriptions/*
│       └── users.js              ← /api/users/*
│
├── cli/
│   └── wsdm.js                   ← CLI 入口
│
├── web/
│   └── public/
│       └── index.html            ← 管理 Web UI
│
├── registry/                     ← 资产注册中心（Git 仓库形式）
│   ├── enterprise/
│   │   └── index.json            ← 企业基线资产清单
│   └── teams/
│       └── example-backend-team/ ← 团队资产
│           ├── index.json
│           ├── agents/
│           ├── skills/
│           └── rules/
│
└── data/                         ← 运行时数据（Docker volume）
    ├── requirements.json
    ├── costs.json
    └── orgs.json
```

### 3.4 订阅链接分发机制（原创）

区别于 ECC 的公开插件市场，wsd_manager 的订阅机制面向**企业内网管控**：

```
管理员视角：
  1. 在 Web UI 选择要分发给某团队的资产组合
  2. 设置有效期、强制资产（不可取消订阅）
  3. 生成订阅 token：sub_xxxxxxxxxxxx
  4. 将安装命令发给团队成员

开发者视角：
  wsdm sync --token=sub_xxxxxxxxxxxx --server=https://wsdm.company.com
  ↓
  将团队资产同步到 ~/.claude/ 和 .claude/
  强制资产不可被下层覆盖
  有效期到期后资产失效
```

**与 ECC 插件市场的区别**：

| 特性 | ECC 插件市场 | wsd_manager 订阅 |
|------|------------|----------------|
| 面向 | 公开社区 | 企业内网 |
| 管控 | 自愿安装 | 强制基线 + 自选扩展 |
| 有效期 | 永久 | 可设置 TTL |
| 审计 | 无 | 完整安装/更新日志 |
| 组织维度 | 无 | 企业/部门/团队三级 |

---

## 四、两者如何联动

### 4.1 联动架构图

```
开发者的机器
┌─────────────────────────────────────────────┐
│  Claude Code                                 │
│  ┌────────────────────────────────────────┐ │
│  │   wsd 插件（.claude/）                  │ │
│  │   commands / agents / skills / hooks   │ │
│  └─────────────┬──────────────────────────┘ │
│                │                             │
│  ┌─────────────▼──────────────────────────┐ │
│  │   .wsd/（项目运行时目录）                │ │
│  │   需求文档 / 规格 / 任务 / 审计日志      │ │
│  └─────────────┬──────────────────────────┘ │
│                │                             │
│  ┌─────────────▼──────────────────────────┐ │
│  │   .claude/ai-pending/                   │ │
│  │   AI 写入快照（commit 前暂存）           │ │
│  └─────────────┬──────────────────────────┘ │
└────────────────┼─────────────────────────────┘
                 │ HTTP API（事件上报 + 资产拉取）
                 │
┌────────────────▼─────────────────────────────┐
│         wsd_manager（Docker 服务）             │
│                                               │
│  Registry（资产注册）                          │
│      ↕ 继承解析                               │
│  Resolver（解析四层继承）                      │
│      ↕                                        │
│  Deployer（资产分发 → 开发者本地）             │
│                                               │
│  需求状态 API ← wsd 上报状态变更              │
│  Token 成本 API ← wsd 上报 token 消耗         │
│  资产 API → wsd 拉取团队资产                  │
│                                               │
│  Web UI（管理界面）                            │
└───────────────────────────────────────────────┘
```

### 4.2 六个联动时机

**① 会话启动时（资产同步）**

```
session-inject.py（UserPromptSubmit hook）
  ├── 读取 .wsd/STATE.md → 注入当前需求状态
  └── 检查 wsd_manager → 拉取团队最新资产（如有更新）
```

**② 需求创建时（状态上报）**

```
/wsd:propose → 生成 proposal.md
              → 调用 wsd_manager API 上报：
                POST /api/requirements
                { reqId, title, team, owner, status: "PROPOSED" }
```

**③ 阶段推进时（状态同步）**

```
每次状态变更（SPECCING → SPEC_APPROVED → ...）
  → audit-logger.js 记录到 .wsd/audit/
  → 同步更新 wsd_manager：
    PATCH /api/requirements/:reqId/status
```

**④ 执行阶段时（Token 记录）**

```
wsd-executor 代理每次 API 调用
  → costs.js 记录 Token 消耗
  → 可选：上报到 wsd_manager /api/costs（用于跨团队统计）
```

**⑤ 归档时（统计汇总）**

```
/wsd:archive
  → ai-stats-calculator.js 计算 AI 编码统计
  → 向 wsd_manager 上报最终指标：
    POST /api/requirements/:reqId/metrics
    { aiRatio, acceptanceRate, tokensUsed, cycleTime }
```

**⑥ 外部集成（Jira/飞书同步）**

```
wsd 状态变更 → integrations/jira.js → 更新 Jira 状态
                                     ← 拉取 Jira 评论
             → integrations/feishu.js → 推送飞书通知
                                      ← 拉取飞书任务更新
```

### 4.3 数据模型关系

```
wsd_manager 数据层:
  Organization (企业)
    └── Department[] (部门)
          └── Team[] (团队)
                ├── Asset[] (资产：agents/skills/commands/rules)
                ├── Requirement[] (需求状态记录)
                └── CostRecord[] (Token消耗记录)

wsd 本地数据层:
  .wsd/
    └── requirements/
          └── REQ-xxx/
                ├── 规格文档 (Markdown)
                ├── 任务状态 (tasks.md)
                ├── AI统计  (ai-stats.json)
                └── 元数据  (meta.json)

两者通过 reqId 关联，wsd 是权威数据源，
wsd_manager 是汇总视图和分发控制层。
```

---

## 五、AI 编码统计系统

### 5.1 设计目标

企业管理者需要量化回答："引入 AI 编码工具后，实际效果如何？"

四个核心指标：
- **AI 编码行数**：Claude 实际贡献了多少代码
- **AI 编码占比**：在这次需求里，AI 写了多少比例的代码
- **AI 接受率**：开发者认可了多少 AI 写的代码（未被删改的比例）
- **Token 消耗**：为这个需求花了多少 AI API 费用

### 5.2 技术架构

```
会话进行中：
  Claude Code Write/Edit 工具调用
          │
          ▼
  ai-code-tracker.js（PostToolUse Hook）
          │
          ├── 内容快照 → .claude/ai-pending/<filehash>.json
          │   （记录：文件路径、写入内容、行数、时间戳）
          │
          └── 若有活跃需求 → .wsd/REQ-xxx/ai-snapshots/
              （同步备份，用于archive时精算）

开发者执行 git commit：
  .git/hooks/post-commit（异步，不阻塞commit返回）
          │
          ▼
  ai-commit-analyzer.js
          │
          ├── git diff-tree → 获取本次commit变更文件列表
          ├── git show HEAD:<file> → 获取每个文件实际提交内容
          ├── 读取 .claude/ai-pending/ 对应的AI快照
          ├── mergeAiWrites() → 合并多次Write/Edit为AI最终版本
          ├── compareLines() → 行级对比，计算接受率
          └── 清除已处理的ai-pending快照
                  │
                  ├── .claude/ai-stats-history.jsonl（历史追加）
                  └── .wsd/REQ-xxx/ai-stats.json（需求统计更新）

/wsd:archive 时：
  ai-stats-calculator.js --stage=archive
          │
          └── 精确计算该需求全周期AI统计，写入归档报告
```

### 5.3 接受率算法

接受率采用**行级 multiset 匹配**，而非简单的集合交集：

```javascript
// 规范化：去除首尾空白（识别缩进调整为相同行）
// Multiset：支持同一行多次出现（避免公共行被重复计入）
// 过滤：跳过 < 8 字符的行和纯括号行（减少噪音）

function compareLines(aiContent, committedContent) {
  const aiLines = normalizeLines(aiContent).filter(isMeaningfulLine);
  const committedMap = buildMultiset(normalizeLines(committedContent));

  let accepted = 0;
  for (const line of aiLines) {
    if (committedMap.get(line) > 0) {
      accepted++;
      committedMap.set(line, committedMap.get(line) - 1);
    }
  }
  return accepted / aiLines.length;
}
```

**精度说明**：
- ✅ 能识别：开发者未改动的行、仅调整缩进的行
- ✅ 能识别：开发者重新排序但内容相同的行（multiset处理）
- ❌ 无法识别：语义相同但写法不同（如变量重命名）→ 计为拒绝
- 整体**偏保守**（低估接受率），但保证不高估

### 5.4 与 wsd 生命周期的集成

| 阶段 | AI 统计行为 |
|------|-----------|
| `EXECUTING` | Hook 自动记录每次 Write/Edit |
| 每次 `git commit` | 自动计算本次提交的 AI 占比和接受率 |
| `VERIFYING` | `/wsd:stats` 可查看阶段统计 |
| `ARCHIVED` | 精确计算全周期 AI 统计，写入归档报告 |

---

## 六、关键技术决策

### 6.1 为什么用文件系统而非数据库

**决策**：wsd 的运行时数据（`.wsd/`）存储为 Markdown/JSON 文件，而非数据库。

**理由**：
1. **Git 原生集成**：文件可以纳入版本控制，需求历史可 `git log` 追踪
2. **无基础设施依赖**：开发者不需要在本地安装数据库
3. **可读性**：规格文档是 Markdown，人可以直接读，AI 也可以直接读
4. **离线可用**：断网时依然可以查看需求状态

wsd_manager 同样采用 JSON 文件存储（而非 PostgreSQL），原因是企业内部署简单，避免 DBA 介入。

### 6.2 为什么 hooks 用 Node.js 而非 Python/Shell

**决策**：大部分 hooks 用 Node.js，状态注入用 Python，状态栏用 Shell。

**理由**：
- Node.js：JSON 解析性能好，异步非阻塞，适合需要复杂逻辑的 hooks（lifecycle-guard, ai-commit-analyzer）
- Python：`session-inject.py` 继承自 Trellis，且 Python 在处理文本模板时更简洁
- Shell：`statusline.sh` 需要最小依赖，Shell 最通用

### 6.3 为什么 git hook 用异步后台运行

**决策**：`post-commit` 中用 `node analyzer.js &` 异步运行。

**理由**：AI 统计分析对于提交流程不是关键路径。开发者不应该因为统计分析慢而等待 `git commit` 返回。统计失败也不应阻断提交。

统计结果在后台完成后写入文件，下次 `/wsd:stats` 时读取。

### 6.4 为什么接受率不做实时统计

**决策**：接受率在 `git commit` 时而非 `Write/Edit` 时计算。

**理由**：开发者在 commit 之前可能多次修改 AI 的代码。真正的"接受"是 commit 到 git 的那一刻，而非 AI 完成写入的那一刻。在 commit 时计算，才能准确反映"开发者最终保留了什么"。

### 6.5 为什么不依赖 Claude Code 内置的使用统计

**决策**：自建 costs.js 追踪 Token 消耗，不依赖 Claude Code 内置统计。

**理由**：
1. Claude Code 的内置统计按会话维度，无法关联到具体需求
2. 企业需要按**需求维度**的 Token 成本，用于产品 ROI 分析
3. `costs.js` 可以关联 `reqId`、`teamId`，支持多维度聚合分析

### 6.6 为什么选择固化流程而非灵活工具箱

**决策**：WSD 提供固定的七阶段流程，不允许跳步，而非提供工具让用户自由组合。

**理由**：

参考项目（GSD、Superpowers、OMC）都是工具箱型，专业用户可以发挥最大价值，但学习曲线陡峭，且团队个体差异大。

企业的核心需求是**可复制的交付质量**，而不是让每个人自己发明最佳实践。固化流程：
- 降低了新团队的学习成本（"跟着流程走就行"）
- 确保了审计的完整性（每条需求必然经历相同的关卡）
- 方便了管理者横向比较（同样的流程，不同团队的质量指标可比）

代价是牺牲了灵活性，但这在企业场景下是合理的取舍。
