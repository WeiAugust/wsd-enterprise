# WSD 集成分析：开源项目优势与原创特性

> 最后更新：2026-04-16

---

## 一、六大开源项目核心优势分析

### 1.1 ECC（Everything Claude Code）

**核心定位**：Claude Code 插件生态的工业级基础设施

**关键优势**：

| 优势维度 | 具体体现 |
|---------|---------|
| **资产规范标准化** | 定义了 Agent/Skill/Command/Hook/Rule 的完整 YAML frontmatter 格式，跨平台互操作 |
| **插件市场体系** | `claude plugin marketplace add` 机制，支持一键安装外部插件包 |
| **企业级控制层** | `.claude/enterprise/controls.md` 实现合规管控，禁止特定操作 |
| **跨平台兼容** | 同一资产适配 Claude Code、Cursor、Codex、Gemini CLI 等 6+ 平台 |
| **钩子工程化** | `run-with-flags.js` 统一封装，支持 `ECC_HOOK_PROFILE` 按环境切换 |
| **技能分层机制** | 策划技能（`skills/`）与生成技能（`~/.claude/skills/`）隔离，防止污染 |
| **资产体量** | 48 Agent + 183 Skill + 79 Command + 16 Rule，是同类最完整的资产库 |

**核心贡献**：建立了整个 Claude Code 资产生态的事实标准。

---

### 1.2 GSD（Get Shit Done）

**核心定位**：解决 "Context Rot" 的上下文工程系统

**关键优势**：

| 优势维度 | 具体体现 |
|---------|---------|
| **上下文守卫** | `gsd-context-monitor.js` 实时监控窗口用量，防止质量劣化 |
| **阶段驱动执行** | workspace → milestone → phase 三层结构，天然防止范围蔓延 |
| **子代理隔离** | 每个 phase 在独立子代理中执行，避免上下文污染 |
| **质量门禁** | schema drift 检测、threat model 锚定验证、scope reduction 检测 |
| **SDK 类型化** | Registry-based `gsd-sdk query`，结构化错误分类和处理 |
| **知识图谱** | `/gsd-graphify` 为规划代理提供实体关系上下文 |
| **命令覆盖度** | 73 个命令，覆盖从项目初始化到调试的完整工作流 |

**核心贡献**：将 AI Coding 从"对话驱动"升级为"规格驱动+质量守卫"。

---

### 1.3 Superpowers

**核心定位**：技能自动触发 + SDD（规格驱动子代理开发）

**关键优势**：

| 优势维度 | 具体体现 |
|---------|---------|
| **技能门控机制** | `using-superpowers` 作为元技能，强制在任何操作前检查相关技能 |
| **SDD 模式** | `subagent-driven-development` 将大任务分解为并行子代理执行 |
| **计划生成闭环** | brainstorm → write-plan → execute-plan 三段式，每段可独立审查 |
| **1% 规则** | "哪怕 1% 概率适用，也必须触发技能检查"—强制工程纪律 |
| **技能编写指南** | `writing-skills` 技能本身就是元文档，降低扩展门槛 |
| **会话状态注入** | session-start hook 自动将上次状态注入新会话 |

**核心贡献**：将"知道要做什么"与"怎么做"严格分离，提升可组合性。

---

### 1.4 OMC（Oh My ClaudeCode）

**核心定位**：零学习曲线的多智能体编排系统

**关键优势**：

| 优势维度 | 具体体现 |
|---------|---------|
| **模型路由策略** | haiku（快速查询）→ sonnet（标准执行）→ opus（架构/深度分析），成本感知 |
| **commit 决策追踪** | 每个 commit 强制记录 Constraint/Rejected/Directive/Confidence 等 trailers |
| **Autopilot 模式** | 一句话触发全自动规划→执行→验证循环 |
| **LSP/AST 集成** | `lsp_hover`、`ast_grep_search` 等代码智能工具，超越纯文本操作 |
| **项目记忆系统** | `project_memory_read/write`，跨会话保留决策上下文 |
| **团队管道** | team-plan → team-prd → team-exec → team-verify → team-fix 固化流水线 |
| **Ralph 递归循环** | `ralph` 实现自我纠正循环，直到验证通过才退出 |

**核心贡献**：工业级多代理编排，特别是成本感知模型路由和可追溯决策记录。

---

### 1.5 OpenSpec

**核心定位**：需求变更的完整生命周期管理

**关键优势**：

| 优势维度 | 具体体现 |
|---------|---------|
| **变更隔离原则** | `specs/`（当前事实）与 `changes/`（待合并提案）严格分离 |
| **完整变更包** | proposal.md + specs/ + design.md + tasks.md 四件套，缺一不可 |
| **归档机制** | `/opsx:archive` 将变更合并回 specs/，保持系统级一致性 |
| **Brownfield 优先** | 设计哲学明确支持存量系统改造，不只是绿地新建 |
| **JSON Schema 验证** | `schemas/` 目录提供规格格式的机器验证能力 |
| **并行合并** | `openspec-parallel-merge-plan.md` 支持多变更并行推进 |

**核心贡献**："变更是一等公民"的设计哲学，防止规格漂移。

---

### 1.6 Trellis

**核心定位**：规格自动注入 + 跨平台 AI 编码框架

**关键优势**：

| 优势维度 | 具体体现 |
|---------|---------|
| **规格自动注入** | `.trellis/spec/` 内容自动注入每个会话，无需手动 @引用 |
| **个人工作区记忆** | `.trellis/workspace/<username>/` 个人日志，跨会话连续性 |
| **任务中心化** | `.trellis/tasks/` 统一存放 PRD + 实现上下文 + 任务状态 |
| **跨平台最广** | 支持 13 个 AI 编码平台，迁移成本最低 |
| **Python 钩子生态** | session-start/statusline/ralph-loop 均用 Python 实现，可读性高 |
| **状态栏集成** | `statusline.py` 在 Claude Code 底部显示当前任务状态 |

**核心贡献**：最优雅的规格注入机制，以及个人工作区+团队规范的双轨记忆。

---

## 二、WSD 的集成策略：各项目优势如何体现

```
开源项目贡献层
├── OpenSpec  → 需求变更结构（proposal/specs/tasks 四件套）
├── GSD       → 阶段驱动执行 + 上下文守卫 + 子代理隔离
├── Superpowers → 技能自动触发机制 + SDD 开发模式
├── Trellis   → 规格自动注入 + 状态栏 + 会话记忆
├── ECC       → 资产格式标准 + 插件市场 + 企业控制
└── OMC       → 模型路由策略 + 多代理编排 + 决策追踪
```

### 2.1 从 OpenSpec 继承：需求变更生命周期

WSD 直接采用 OpenSpec 的"变更包"思想，但在企业场景下显著增强：

| OpenSpec 原始能力 | WSD 的增强 |
|-----------------|-----------|
| proposal.md | 增加深度访谈（`/wsd:propose` 触发 wsd-analyst 代理做需求澄清） |
| specs/ | 增加 BDD 格式强制（Given/When/Then）+ JSON Schema 验证 |
| tasks.md | 增加 ≤2h/任务的粒度约束 + 任务依赖图 |
| archive | 增加质量指标统计（bug 数、变更次数、review 轮次） |
| — | 增加变更分级（M0-M4），不同级别触发不同回退深度 |
| — | 增加阻塞管理（block/unblock）+ 热修复快速通道 |

### 2.2 从 GSD 继承：执行引擎与上下文工程

| GSD 原始能力 | WSD 的增强 |
|------------|-----------|
| context-monitor.js | 集成到 wsd/skills/wsd-context-guard.md，>60% 警告、>80% 阻止 |
| phase 隔离执行 | 每个 `/wsd:execute` 任务在独立子代理中运行 |
| workspace/milestone/phase | 对应 wsd 的 project/requirement/task 三层 |
| 质量门禁 | wsd-verifier 代理执行验收，bug 自动进入 BUGFIX 流程 |
| schema drift 检测 | 通过 hooks/lifecycle-guard.js 阻止跳阶段操作 |

### 2.3 从 Superpowers 继承：技能触发机制

| Superpowers 原始能力 | WSD 的应用 |
|-------------------|-----------|
| using-superpowers 元技能 | wsd-lifecycle.md 作为"始终加载"的元技能，感知当前状态 |
| brainstorm → plan → execute 三段式 | propose → spec → plan → execute → verify 五段式 |
| SDD 子代理模式 | wsd-executor 代理在隔离上下文中执行每个任务 |
| session-start 注入 | hooks/session-inject.py 注入 `.wsd/STATE.md` 摘要 |
| verification-before-completion | wsd-verifier 强制验收，不允许跳过 |

### 2.4 从 Trellis 继承：规格注入与状态感知

| Trellis 原始能力 | WSD 的应用 |
|----------------|-----------|
| 规格自动注入 | CLAUDE.md 中内置状态机，会话启动自动加载 STATE.md |
| statusline.py | hooks/statusline.sh 显示当前需求状态 |
| 个人工作区记忆 | 通过审计日志（`.wsd/audit/`）替代个人日志 |
| 任务中心化 | `.wsd/<req-id>/tasks.md` 集中存放任务状态 |

### 2.5 从 ECC 继承：资产标准与分发

| ECC 原始能力 | WSD 的应用 |
|------------|-----------|
| 资产格式标准（YAML frontmatter） | wsd 所有 agents/skills/commands 均遵循 ECC 格式 |
| 插件市场机制 | wsd_manager 的订阅链接机制（`wsdm install <url>`）是其企业变体 |
| 企业控制层 | wsd_manager 的四层权限模型（enterprise/dept/team/personal） |
| 技能分层（策划/生成隔离） | wsd_manager registry 将企业基线与团队定制分层存储 |

### 2.6 从 OMC 继承：模型路由与编排

| OMC 原始能力 | WSD 的应用 |
|------------|-----------|
| 模型路由（haiku/sonnet/opus） | wsd 代理明确分配：analyst/architect 用 opus，planner/executor/reviewer/verifier 用 sonnet |
| commit trailers | wsd 审计日志（`.wsd/audit/`）记录操作者、阶段、结果 |
| 团队管道 | wsd 状态机（PROPOSED→SPECCING→…→DONE）是固化的团队流水线 |
| Ralph 自纠正循环 | BUGFIX→VERIFYING 的循环机制借鉴了 Ralph 模式 |

---

## 三、WSD 原创功能特性

以下特性在六个参考项目中均未出现，是 WSD 的独创贡献：

### 3.1 需求变更分级系统（M0-M4）

```
M0：措辞/说明调整  → 无需回退，直接更新规格
M1：边界扩展       → 回退到 SPEC_APPROVED，补充规格
M2：架构调整       → 回退到 PLAN_APPROVED，重新规划
M3：核心逻辑重构   → 回退到 SPECCING，重写规格
M4：推倒重来       → CANCELLED + 新建需求
```

这使得变更管理有精确的成本预估，而不是一刀切的"重新来过"。

### 3.2 企业四层资产管理模型

```
企业层（安全基线、合规钩子）
  └── 部门层（技术栈规范、通用代理）
        └── 团队层（业务代理、工作流技能）
              └── 个人层（个人偏好、私有资产）
```

每层资产支持继承与覆盖，下层可 override 上层的同名资产。这在任何参考项目中都没有完整实现。

### 3.3 订阅链接分发机制

管理员在 wsd_manager 中选择资产组合，生成订阅 token，开发者通过：

```bash
wsdm install https://<server>/api/subscriptions/<token>/bundle
```

一键将企业/团队资产安装到本地 `~/.claude/`。相比 ECC 的插件市场（面向公开分发），wsd_manager 的订阅机制面向**内网企业管控**，支持：
- 必选资产强制注入（不可取消订阅）
- 订阅有效期管理（TTL）
- 按组织/团队维度过滤可见资产

### 3.4 需求生命周期状态机

完整的 PROPOSED → SPECCING → SPEC_APPROVED → PLANNING → PLAN_APPROVED → EXECUTING → IMPLEMENTED → VERIFYING → DONE → ARCHIVED 状态流转，配合：

- **人机确认关卡**：每个阶段完成必须等待人工确认，禁止自动推进
- **快速通道**：quickfix（≤5文件）和 hotfix（生产紧急）绕过完整流程
- **阻塞管理**：block/unblock 机制，阻塞状态可追溯
- **回退机制**：任意阶段可回退，需 team-lead 权限

### 3.5 深度访谈需求澄清（wsd-deep-interview）

`/wsd:propose` 不是简单创建 proposal.md，而是触发 `wsd-analyst`（opus 模型）进行结构化深度访谈：

```
背景澄清 → 价值确认 → 边界探索 → 技术约束 → 成功标准定义
```

仅在所有关键问题回答后才生成 proposal.md。这是 OpenSpec 的 propose 命令所没有的。

### 3.6 外部系统双向集成

- **Jira 集成**：`/wsd:import jira <ticket-id>` 将 Jira Story 转换为 WSD 规格
- **飞书集成**：支持飞书任务、多维表格双向同步，状态变更触发飞书 Webhook
- **GitHub Issues**：`/wsd:import github <issue-id>` 导入 GitHub Issue

这些集成将 WSD 嵌入企业现有研发工具链，而非要求团队迁移工作方式。

---

## 四、WSD 与参考项目的定位区别

| 维度 | 参考项目 | WSD |
|------|---------|-----|
| **受众** | 个人开发者/开源社区 | 企业研发团队 |
| **流程自由度** | 可选使用各模块 | 固化的需求交付流程（不可跳步） |
| **资产管理** | 个人安装/插件市场 | 企业管控的订阅分发 |
| **状态持久化** | 文件系统（.planning/、.trellis/） | 结构化 .wsd/ 目录 + API 服务 |
| **合规审计** | 无/轻量 | 完整审计日志（`.wsd/audit/`），热修复永久保留 |
| **权限模型** | 无 | developer/team-lead/admin 三级权限 |
| **外部集成** | 无/有限 | Jira/飞书/GitHub 双向集成 |

---

## 五、WSD 进一步优化建议

### 5.1 高优先级（影响核心价值主张）

**① wsd/hooks — 自动化守卫缺失**

当前状态：hooks 目录为空，lifecycle-guard.js 等文件未创建。

问题：没有 hooks，CLAUDE.md 中定义的规范（禁止跳阶段、上下文告警）完全依赖 LLM 遵守，而非强制执行。

建议：
```
hooks/lifecycle-guard.js   → PreToolUse：拦截违规的跨阶段操作
hooks/context-monitor.js   → PostToolUse：监控上下文窗口用量
hooks/audit-logger.js      → PostToolUse：记录每次阶段转换到 .wsd/audit/
hooks/session-inject.py    → UserPromptSubmit：注入 STATE.md 摘要
hooks/statusline.sh        → statusLine：底部状态栏展示当前需求
```

**② wsd/schemas — JSON Schema 验证缺失**

当前状态：schemas/ 目录为空。

问题：proposal.md、spec.md 等文件格式无法机器验证，LLM 生成的内容可能格式错乱。

建议参考 OpenSpec 的 `schemas/spec-driven/` 目录，为 proposal/spec/task 各创建 JSON Schema。

**③ wsd_manager Web UI — 组织管理功能不完整**

基于上次分析，组织节点的增删改功能还未完善，资产版本管理（修改后生成新版本、发布后可见）也未实现。

建议优先实现：
- 组织树节点的 CRUD（增加/删除/重命名组织节点）
- 资产版本化（每次编辑创建新草稿版本，发布后新版本才对订阅者可见）

---

### 5.2 中优先级（完善性优化）

**④ wsd 缺少技能触发机制文档**

Superpowers 有 `using-superpowers` 作为元技能，强制在任何操作前检查相关技能。WSD 的 `wsd-lifecycle.md` 虽然存在，但没有明确的"触发优先级"描述。

建议：在 CLAUDE.md 或 wsd-lifecycle.md 中增加类似 Superpowers "1% 规则"的强制检查逻辑。

**⑤ 缺少跨平台适配（参考 Trellis/ECC）**

WSD 目前只适配 Claude Code。Trellis 支持 13 个平台，ECC 支持 6 个。

建议：至少增加 Cursor 适配（`.cursor/commands/` 目录），因为国内企业使用 Cursor 的比例很高。

**⑥ 缺少知识图谱/代码库地图（参考 GSD）**

GSD 有 `/gsd-map-codebase` 和 `/gsd-graphify`，在接手存量项目时极其有用。

WSD 当前的 `/wsd:import` 只支持从 Jira/飞书导入需求描述，没有代码库分析能力。

建议：增加 `/wsd:scan` 命令，调用 wsd-analyst 代理扫描现有代码库，生成技术债务报告，并自动创建对应的 WSD 需求提案。

---

### 5.3 低优先级（长期演进）

**⑦ 缺少 Token 成本追踪（参考 OMC 的模型路由）**

OMC 对每个代理明确指定模型以控制成本。WSD 虽然也做了模型分配，但没有实际的 Token 使用量统计面板。

建议：在 wsd_manager Web UI 增加 Token 成本仪表盘，按需求/团队/时间维度展示。

**⑧ 缺少自动学习机制（参考 ECC 的 /skill-create）**

ECC 有 `/skill-create` 命令，从 git 历史提取模式生成新技能；有 `/learn` 从对话中提炼工程规范。

WSD 没有类似的"从实践中学习"机制。

建议：增加 `/wsd:learn` 命令，从已归档的需求中提炼高频技术方案，自动生成团队专属的 skill。

**⑨ commit trailers 标准（参考 OMC）**

OMC 要求每个 commit 记录 Constraint/Rejected/Directive/Confidence 等决策上下文。WSD 目前只记录阶段审计日志，没有将决策上下文推进到 git history。

建议：在 wsd-executor 代理的提交规范中加入结构化 trailers，提升代码库的可审计性。

---

## 六、优化优先级汇总

| 优先级 | 优化项 | 涉及模块 | 参考项目 |
|-------|-------|---------|---------|
| 🔴 P0 | 创建 5 个 hooks 文件（lifecycle-guard 等） | wsd/hooks/ | GSD + Trellis |
| 🔴 P0 | 创建 3 个 JSON Schema（proposal/spec/task） | wsd/schemas/ | OpenSpec + ECC |
| 🔴 P0 | 组织节点增删改 + 资产版本化 | wsd_manager Web UI | 原创 |
| 🟡 P1 | wsd-lifecycle.md 增加强制触发规则 | wsd/skills/ | Superpowers |
| 🟡 P1 | Cursor 跨平台适配 | wsd/.cursor/ | Trellis + ECC |
| 🟡 P1 | /wsd:scan 代码库分析命令 | wsd/commands/ | GSD |
| 🟢 P2 | Token 成本仪表盘 | wsd_manager Web UI | OMC |
| 🟢 P2 | /wsd:learn 自动学习命令 | wsd/commands/ | ECC |
| 🟢 P2 | commit trailers 标准 | wsd-executor.md | OMC |

---

## 七、架构总结图

```
WSD 完整架构
═══════════════════════════════════════════════════════════════

需求输入层
  用户/PM/Jira/飞书/GitHub Issues
         │
         ▼
[wsd 插件] 需求生命周期管理
  ┌─────────────────────────────────────────┐
  │ PROPOSE → SPEC → PLAN → EXECUTE →      │
  │ VERIFY → ARCHIVE                        │
  │                                         │
  │ 快速通道：quickfix / hotfix             │
  │ 变更管道：amend(M0-M4) / bugfix         │
  │                                         │
  │ 守卫层（Hooks）：                       │
  │  - lifecycle-guard（阻止跳阶段）        │  ← GSD
  │  - context-monitor（上下文告警）        │  ← GSD
  │  - audit-logger（操作记录）             │  ← 原创
  │  - session-inject（状态注入）           │  ← Trellis
  │  - statusline（状态栏展示）             │  ← Trellis
  │                                         │
  │ 子代理层（Agents）：                    │
  │  analyst(opus) / architect(opus)        │  ← OMC 模型路由
  │  planner/executor/reviewer/verifier     │
  │  (sonnet)                               │
  └─────────────────────────────────────────┘
         │
         ▼
[wsd_manager] 企业资产管理平台
  ┌─────────────────────────────────────────┐
  │ 四层资产模型：                          │  ← 原创
  │  企业 → 部门 → 团队 → 个人             │
  │                                         │
  │ 订阅分发机制：                          │  ← ECC 插件市场变体
  │  管理员选资产 → token → wsdm install   │
  │                                         │
  │ 资产版本化：                            │  ← 原创
  │  草稿 → 审核 → 发布可见                │
  │                                         │
  │ Web UI + REST API + CLI（wsdm）         │
  └─────────────────────────────────────────┘
         │
         ▼
Claude Code 运行时
  ~/.claude/agents/ skills/ commands/ rules/ hooks/
```
