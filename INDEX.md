# WSD All — 项目总索引

> 企业级 AI Coding 一站式交付框架
> 最后更新：2026-04-16

---

## 目录结构总览

```
wsd_all/
├── INDEX.md                    ← 本文件（多层索引）
├── READEME.md                  ← 项目说明
├── docs/                       ← 设计与规划文档
│   ├── USAGE.md                ← ⭐ 完整使用指南（场景案例集）
│   ├── DESIGN.md               ← ⭐ 系统设计文档（wsd+wsd_manager+联动）
│   ├── ROADMAP.md              ← ⭐ 建设规划路线图（从原型到生产可用）
│   ├── claude-code-assets-analysis.md   ← Claude Code 资产体系深度分析
│   ├── wsd-integration-analysis.md      ← 开源项目优势分析与集成策略
│   ├── wsd-design.md           ← wsd 插件详细设计（历史文档）
│   ├── wsd-manager-design.md   ← wsd_manager 平台详细设计（历史文档）
│   ├── enterprise-integration-design.md ← 企业集成实战指南（历史文档）
│   └── PROJECT-ROADMAP.md      ← 历史进度记录（已归档）
├── wsd/                        ← Claude Code 需求生命周期管理插件
│   ├── CLAUDE.md               ← 插件行为基线 ✅
│   ├── README.md               ← 使用文档 ✅
│   ├── commands/               ← 20个斜杠命令 ✅（含 wsd-stats）
│   ├── agents/                 ← 6个专用子代理 ✅
│   ├── skills/                 ← 4个自动触发技能 ✅
│   ├── docs/                   ← 补充文档（多仓库/企业集成） ✅
│   ├── hooks/                  ← 7个自动化钩子 ✅（含AI编码统计）
│   ├── schemas/                ← JSON Schema 定义 ✅
│   ├── templates/              ← 配置模板 ✅
│   └── install.sh              ← 安装脚本 ✅（含git hook安装）
├── wsd_manager/                ← 企业级 Claude Code 资产管理平台 ✅
│   ├── cli/wsdm.js             ← wsdm CLI 工具
│   ├── registry/               ← 资产注册中心结构
│   │   ├── enterprise/         ← 企业基线资产
│   │   ├── departments/        ← 部门资产
│   │   └── teams/              ← 团队资产（含示例）
│   └── README.md               ← 平台文档
└── reference_projects/         ← 参考开源项目
    ├── everything-claude-code/ ← ECC：插件生态 + 资产完整体系
    ├── superpowers/            ← Superpowers：技能驱动工作流
    ├── get-shit-done/          ← GSD：规格驱动开发 + 上下文工程
    ├── oh-my-claudecode/       ← OMC：多智能体编排系统
    ├── OpenSpec/               ← OpenSpec：需求变更规格管理
    └── Trellis/                ← Trellis：多平台 AI 编码框架
```

---

## 一、reference_projects/ — 参考项目索引

### 1.1 everything-claude-code (ECC)

**定位**：Claude Code 插件生态的基础设施，提供完整的开发工作流资产体系。

**资产统计**：
- Agents: 48 个
- Skills: 183 个
- Commands: 79 个
- Rules: 16 个
- Hooks: hooks.json（含 PreToolUse / PostToolUse / Stop）

**目录结构**：
```
everything-claude-code/
├── agents/          # 专用子代理（planner, code-reviewer, tdd-guide, ...）
├── skills/          # 工作流技能（183个，按领域分类）
├── commands/        # 斜杠命令（/tdd, /plan, /e2e, /code-review, ...）
├── rules/           # 规范准则（安全、编码风格、测试要求等）
├── hooks/           # 自动化触发器（hooks.json）
├── .claude/
│   ├── agents/      # 项目级代理配置
│   ├── commands/    # 项目级命令
│   ├── rules/       # 项目级规则
│   ├── skills/      # 项目级技能
│   ├── enterprise/  # 企业控制配置
│   └── team/        # 团队配置（team-config.json）
├── .mcp.json        # MCP 服务器配置
├── plugins/         # 插件市场文档
│   └── README.md
├── ecc2/            # ECC v2 (Rust 实现)
└── tests/           # 测试套件
```

**核心能力**：
- 插件市场体系（`claude plugin marketplace add`）
- 跨平台支持（Claude Code / Cursor / Codex / OpenCode / Gemini CLI）
- 企业级控制（`.claude/enterprise/controls.md`）
- 团队配置共享（`.claude/team/`）

---

### 1.2 superpowers

**定位**：基于可组合"技能"的完整软件开发工作流，核心是自动触发的规格驱动子代理开发。

**资产统计**：
- Skills: 14 个核心技能
- Agents: 1 个（code-reviewer）
- Hooks: session-start（hooks-cursor.json）

**目录结构**：
```
superpowers/
├── skills/              # 核心技能（brainstorm, write-plan, execute-plan, ...）
├── agents/
│   └── code-reviewer.md
├── hooks/
│   ├── session-start    # 会话启动钩子
│   ├── hooks-cursor.json
│   └── run-hook.cmd
├── docs/                # 文档
│   ├── plans/           # 架构设计文档
│   └── windows/         # Windows 多语言钩子
├── tests/               # 测试套件（技能触发测试、集成测试）
└── CLAUDE.md            # 贡献指南（AI 代理规范）
```

**核心技能体系**：
| 技能 | 用途 |
|------|------|
| using-superpowers | 技能发现与使用入口 |
| brainstorming | 需求探索与规格提取 |
| writing-plans | 生成可执行实现计划 |
| executing-plans | 子代理驱动执行（SDD） |
| subagent-driven-development | 多子代理并行开发 |
| systematic-debugging | 系统化调试 |
| using-git-worktrees | Git 工作树并行开发 |
| verification-before-completion | 完成前验证 |
| requesting-code-review | 代码审查请求 |
| receiving-code-review | 代码审查接收 |
| writing-skills | 技能编写指南 |
| finishing-a-development-branch | 分支收尾流程 |
| test-driven-development | TDD 工作流 |
| dispatching-parallel-agents | 并行代理调度 |

---

### 1.3 get-shit-done (GSD)

**定位**：轻量级元提示、上下文工程与规格驱动开发系统。解决"context rot"问题（上下文窗口耗尽导致质量劣化）。

**资产统计**：
- Commands: 73 个（gsd/目录）
- Agents: 专用研究/执行子代理
- Hooks: 9 个（上下文监控、工作流守卫等）

**目录结构**：
```
get-shit-done/
├── commands/
│   └── gsd/             # 73 个 gsd-* 命令
│       ├── new-project.md     # 项目初始化
│       ├── plan-phase.md      # 阶段规划
│       ├── execute-phase.md   # 阶段执行
│       ├── new-milestone.md   # 里程碑管理
│       ├── debug.md           # 调试工作流
│       ├── code-review.md     # 代码审查
│       └── ...（共73个）
├── agents/              # 专用子代理（advisor, debugger, codebase-mapper, ...）
├── hooks/               # 系统钩子
│   ├── gsd-context-monitor.js   # 上下文监控
│   ├── gsd-prompt-guard.js      # 提示守卫
│   ├── gsd-read-guard.js        # 读取守卫
│   ├── gsd-workflow-guard.js    # 工作流守卫
│   ├── gsd-phase-boundary.sh    # 阶段边界
│   └── gsd-session-state.sh     # 会话状态
├── scripts/             # 工具脚本
├── sdk/                 # SDK（工作区/里程碑/阶段管理）
└── get-shit-done/       # 核心源码（TypeScript）
    ├── workspace/       # 工作区管理
    ├── milestone/       # 里程碑管理
    └── phase/           # 阶段管理
```

**核心命令分类**：
| 类别 | 命令 |
|------|------|
| 项目管理 | new-project, new-milestone, add-phase, insert-phase, remove-phase |
| 执行引擎 | execute-phase, plan-phase, discuss-phase, autonomous |
| 代码质量 | code-review, code-review-fix, audit-fix, add-tests |
| 工作流 | progress, health, next, do, fast, intel |
| 调试 | debug, forensics |
| 文档 | docs-update, map-codebase, milestone-summary |

---

### 1.4 oh-my-claudecode (OMC)

**定位**：Claude Code 多智能体编排系统。零学习曲线，自动化团队协作。

**资产统计**：
- Agents: 22 个
- Skills: autopilot, ralph, ultrawork, team, deep-interview 等
- Hooks: session-start（注入子代理上下文）

**目录结构**：
```
oh-my-claudecode/
├── agents/              # 22 个专用代理
│   ├── executor.md      # 代码执行
│   ├── planner.md       # 任务规划
│   ├── architect.md     # 架构设计
│   ├── code-reviewer.md # 代码审查
│   ├── debugger.md      # 调试
│   ├── verifier.md      # 验证
│   └── ...（共22个）
├── skills/              # 工作流技能
│   ├── autopilot.md     # 全自动驾驶模式
│   ├── ralph.md         # 递归自动循环
│   ├── ultrawork.md     # 超强工作模式
│   ├── team.md          # 团队协作编排
│   └── deep-interview.md # 深度需求访谈
├── .clawhip/            # clawhip 集成
│   ├── project.json
│   └── state/
├── dist/                # 编译输出
│   └── autoresearch/    # 自动研究模块
└── benchmark/           # 基准测试套件
```

**核心代理角色**：
| 代理 | 模型 | 用途 |
|------|------|------|
| explore | haiku | 快速代码库探索 |
| planner | opus | 任务规划 |
| architect | opus | 架构设计 |
| executor | sonnet | 代码实现 |
| code-reviewer | opus | 代码审查 |
| verifier | sonnet | 结果验证 |
| debugger | sonnet | 调试 |
| security-reviewer | sonnet | 安全审查 |
| scientist | sonnet | 研究分析 |
| critic | opus | 批判性评估 |

---

### 1.5 OpenSpec

**定位**：轻量级规格管理框架，管理需求变更的完整生命周期（提案→规格→实现→归档）。

**核心概念**：
```
openspec/
├── specs/       # 系统当前状态的事实来源
└── changes/     # 待合并的变更提案
    └── <change-name>/
        ├── proposal.md    # 为什么做，做什么
        ├── specs/         # 需求和场景规格
        ├── design.md      # 技术方案
        └── tasks.md       # 实现检查清单
```

**目录结构**：
```
OpenSpec/
├── src/                 # TypeScript 源码
│   ├── core/            # 核心功能（init, archive, profiles, migration）
│   ├── commands/        # CLI 命令实现
│   └── ui/              # 用户界面
├── docs/                # 文档
│   ├── concepts.md      # 核心概念
│   ├── workflows.md     # 工作流指南
│   ├── cli.md           # CLI 参考
│   └── opsx.md          # opsx 工作流
├── schemas/             # JSON Schema 定义
│   └── spec-driven/     # 规格驱动模板
└── test/                # 测试套件
    ├── core/            # 核心功能测试
    ├── commands/        # 命令测试
    └── specs/           # 规格测试
```

**核心工作流命令**：
| 命令 | 用途 |
|------|------|
| `/opsx:propose <name>` | 创建变更提案（生成完整目录结构） |
| `/opsx:archive <name>` | 归档变更（合并到 specs/） |
| `openspec init` | 初始化规格系统 |
| `openspec validate` | 验证规格格式 |
| `openspec view` | 查看规格内容 |
| `openspec change` | 管理变更 |

---

### 1.6 Trellis

**定位**：多平台 AI 编码框架，支持 13 个平台。核心：自动注入规格、任务中心工作流、并行代理执行、项目记忆。

**资产统计**：
- Agents（Claude）: 6 个（debug, implement, check, research, plan, dispatch）
- Hooks: 4 个（session-start, statusline, ralph-loop, inject-subagent-context）
- Commands（Cursor）: 16 个

**目录结构**：
```
Trellis/
├── .claude/
│   ├── agents/          # 6 个专用代理（Claude Code）
│   │   ├── plan.md
│   │   ├── dispatch.md
│   │   ├── implement.md
│   │   ├── research.md
│   │   ├── debug.md
│   │   └── check.md
│   ├── hooks/           # 4 个 Python 钩子
│   │   ├── session-start.py
│   │   ├── statusline.py
│   │   ├── ralph-loop.py
│   │   └── inject-subagent-context.py
│   └── settings.json
├── .cursor/
│   └── commands/        # 16 个 Cursor 命令
│       ├── trellis-start.md
│       ├── trellis-before-dev.md
│       ├── trellis-finish-work.md
│       └── ...（共16个）
├── .opencode/           # OpenCode 适配
│   ├── agents/
│   ├── plugins/
│   └── lib/
└── .trellis/            # 项目工作目录（运行时生成）
    ├── spec/            # 自动注入的规格文件
    ├── tasks/           # PRD + 实现上下文 + 任务状态
    └── workspace/       # 个人日志 + 会话记忆
```

---

## 二、Claude Code 可管理资产体系

### 2.1 资产类型全景

| 资产类型 | 存储位置 | 作用 | 管理粒度 |
|----------|----------|------|----------|
| **CLAUDE.md** | 项目根 / `~/.claude/` | 始终加载的指令，定义行为基线 | 项目/全局 |
| **Agents** | `.claude/agents/` / `~/.claude/agents/` | 专用子代理，通过 Agent 工具调用 | 项目/全局 |
| **Skills** | `.claude/skills/` / `~/.claude/skills/` | 可触发的工作流定义，Skill 工具调用 | 项目/全局 |
| **Commands** | `.claude/commands/` / `~/.claude/commands/` | 斜杠命令（`/xxx`），用户主动触发 | 项目/全局 |
| **Hooks** | `settings.json` / `~/.claude/settings.json` | 自动化触发器（PreToolUse/PostToolUse/Stop） | 项目/全局 |
| **Rules** | `.claude/rules/` / `~/.claude/rules/` | 规范准则，自动加载到上下文 | 项目/全局 |
| **MCP** | `.mcp.json` / `~/.claude/mcp-configs/` | MCP 服务器配置，扩展工具能力 | 项目/全局 |
| **Plugins** | `~/.claude/plugins/` | 安装的插件包 | 全局 |
| **Settings** | `settings.json` / `~/.claude/settings.json` | 模型、权限、钩子等核心配置 | 项目/全局 |
| **Memory** | `~/.claude/projects/.../memory/` | 跨会话持久记忆（user/feedback/project/reference） | 项目 |
| **Contexts** | 自定义目录 | 场景化上下文文件（dev/research/review） | 项目 |

### 2.2 资产格式规范

**Agent 格式（YAML frontmatter + Markdown）**：
```markdown
---
name: agent-name
description: 触发条件和适用场景描述
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet|opus|haiku
---
# Agent 职责说明...
```

**Skill 格式（YAML frontmatter + Markdown）**：
```markdown
---
name: skill-name
description: 单行描述，用于判断相关性
---
# When to Use
# How It Works
# Examples
```

**Command 格式（Markdown + description frontmatter）**：
```markdown
---
description: 命令的一行描述
---
# 命令内容...
```

**Hook 配置（settings.json）**：
```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "Write|Edit", "command": "..." }],
    "PostToolUse": [{ "matcher": "Bash", "command": "..." }],
    "Stop": [{ "command": "..." }]
  }
}
```

### 2.3 资产作用域层级

```
全局层 (~/.claude/)
│  ├── 个人通用 agents/skills/commands/rules
│  └── 全局 settings.json / plugins/
│
项目层 (.claude/)
│  ├── 项目专属 agents/skills/commands/rules
│  └── 项目 settings.json / .mcp.json
│
团队层（共享仓库）
│  ├── 团队共享规范（提交到 git）
│  └── 团队 hooks 和 rules
│
企业层（平台管理）
   ├── 组织级资产分发
   └── 合规控制（enterprise/controls.md）
```

---

## 三、wsd — 需求生命周期管理插件（待开发）

**目标**：基于 Claude Code 插件，管理从需求提案到交付验证的完整生命周期。

**参考整合来源**：
- OpenSpec：需求变更规格管理（proposal → specs → tasks → archive）
- GSD：阶段驱动执行（new-project → plan-phase → execute-phase）
- Superpowers：规格提取 + 计划生成 + 子代理执行

**规划资产**：
```
wsd/
├── commands/        # 需求管理命令
│   ├── wsd-propose.md      # 提案创建
│   ├── wsd-plan.md         # 规格规划
│   ├── wsd-execute.md      # 实现执行
│   ├── wsd-review.md       # 需求审查
│   ├── wsd-archive.md      # 归档完成
│   └── wsd-status.md       # 状态查看
├── agents/          # 专用子代理
│   ├── requirement-analyst.md  # 需求分析师
│   ├── spec-writer.md          # 规格编写员
│   └── delivery-verifier.md    # 交付验证员
├── hooks/           # 自动化钩子
│   ├── lifecycle-guard.js      # 生命周期守卫
│   └── spec-validator.js       # 规格验证
└── CLAUDE.md        # 插件说明
```

---

## 四、wsd_manager — 企业级资产管理平台（待开发）

**目标**：按部门/团队/仓库/个人四个层级管理所有 Claude Code 资产。

**四层管理模型**：
```
企业
└── 部门（Department）
    └── 团队（Team）
        └── 仓库（Repository）
            └── 个人（Individual）
```

**可管理资产范围**：
| 资产 | 部门级 | 团队级 | 仓库级 | 个人级 |
|------|--------|--------|--------|--------|
| CLAUDE.md | ✓ 企业基线 | ✓ 团队规范 | ✓ 项目定制 | ✓ 个人习惯 |
| Agents | ✓ 通用代理 | ✓ 专业代理 | ✓ 项目代理 | ✓ 私有代理 |
| Skills | ✓ 企业流程 | ✓ 团队工作流 | ✓ 项目技能 | ✓ 个人技能 |
| Commands | ✓ 统一命令 | ✓ 团队命令 | ✓ 项目命令 | ✓ 个人命令 |
| Hooks | ✓ 合规钩子 | ✓ 质量钩子 | ✓ 构建钩子 | ✓ 个人钩子 |
| Rules | ✓ 安全基线 | ✓ 编码规范 | ✓ 技术规范 | ✓ 个人规则 |
| MCP | ✓ 企业工具 | ✓ 团队工具 | ✓ 项目工具 | ✓ 个人工具 |
| Plugins | ✓ 审核白名单 | ✓ 团队推荐 | ✓ 项目依赖 | ✓ 个人安装 |
| Memory | — | — | ✓ 项目记忆 | ✓ 个人记忆 |

**规划架构**：
```
wsd_manager/
├── api/             # 管理 API
│   ├── assets/      # 资产 CRUD
│   ├── sync/        # 资产同步
│   └── deploy/      # 资产部署
├── web/             # 管理界面
│   ├── department/  # 部门视图
│   ├── team/        # 团队视图
│   ├── repo/        # 仓库视图
│   └── personal/    # 个人视图
├── cli/             # 命令行工具
│   ├── wsdm-sync    # 同步资产
│   ├── wsdm-deploy  # 部署资产
│   └── wsdm-audit   # 审计资产
└── core/            # 核心逻辑
    ├── registry/    # 资产注册表
    ├── resolver/    # 资产解析（继承+覆盖）
    └── validator/   # 资产验证
```

---

## 五、集成架构：wsd + wsd_manager 联动

### 5.1 数据流

```
需求输入
    │
    ▼
[wsd] 需求生命周期管理
    ├── /wsd-propose  → 创建规格
    ├── /wsd-plan     → 生成计划
    ├── /wsd-execute  → 驱动实现
    └── /wsd-archive  → 归档交付
    │
    ▼ 资产需求上报
[wsd_manager] 企业资产管理平台
    ├── 识别所需 agents/skills/commands
    ├── 按层级解析继承关系
    ├── 部署到目标环境
    └── 审计使用情况
    │
    ▼
Claude Code 运行时
```

### 5.2 联动机制

| 触发时机 | wsd 行为 | wsd_manager 响应 |
|----------|----------|------------------|
| 新建项目 | 初始化规格结构 | 注入团队/仓库级资产 |
| 执行阶段 | 调用专用代理 | 按权限过滤可用代理 |
| 提交代码 | 触发质量钩子 | 检查合规钩子执行 |
| 完成交付 | 归档规格 | 更新资产使用统计 |
| 需求变更 | 创建变更提案 | 通知相关团队 |

---

## 六、开源项目核心价值提炼

| 项目 | 核心贡献 | 整合优先级 |
|------|----------|------------|
| **ECC** | 资产标准格式、插件市场体系、企业级控制 | ★★★★★ |
| **GSD** | 阶段驱动执行、上下文守卫、工作区/里程碑管理 | ★★★★★ |
| **Superpowers** | 技能自动触发机制、SDD 子代理开发模式 | ★★★★☆ |
| **Trellis** | 规格自动注入、跨平台适配、个人工作区记忆 | ★★★★☆ |
| **OpenSpec** | 需求变更生命周期、proposal→archive 工作流 | ★★★★☆ |
| **OMC** | 多代理团队编排、模型路由策略、autopilot 模式 | ★★★☆☆ |

---

## 七、进度总览

> 详见 [docs/PROJECT-ROADMAP.md](docs/PROJECT-ROADMAP.md)

| 模块 | 完成率 |
|------|--------|
| 设计文档 | ✅ 100% |
| wsd 命令（19个） | ✅ 100% |
| wsd 代理（6个） | ✅ 100% |
| wsd 技能（4个） | ✅ 100% |
| wsd 钩子 | ⬜ 0% |
| wsd Schema/模板/安装脚本 | ⬜ 0% |
| wsd_manager CLI | ⬜ 0% |
| 外部系统集成 | ⬜ 0% |
| **总计** | **55%** |

## 八、下一步行动（Phase 1 MVP）

- [ ] 创建 `wsd/hooks/lifecycle-guard.js` — 阻止跳过阶段
- [ ] 创建 `wsd/hooks/spec-validator.js` — 规格格式验证
- [ ] 创建 `wsd/hooks/context-monitor.js` — 上下文用量监控
- [ ] 创建 `wsd/hooks/session-inject.py` — 会话启动注入状态
- [ ] 创建 `wsd/hooks/statusline.py` — Claude Code 底部状态栏
- [ ] 创建 `wsd/schemas/` JSON Schema 定义（3个）
- [ ] 创建 `wsd/templates/` 配置模板（4个）
- [ ] 创建 `wsd/install.sh` 安装脚本
