# Claude Code 资产体系深度分析

> 面向 wsd_manager 企业资产管理平台的设计参考
> 日期：2026-04-14

---

## 一、Claude Code 资产完整分类

### 1.1 核心资产类型（9种）

#### 1. CLAUDE.md（行为基线文件）
- **作用**：Claude 打开项目时始终加载，定义整个会话的行为准则和上下文
- **加载机制**：从当前目录向上递归查找，全部合并加载
- **管理方式**：
  - `~/.claude/CLAUDE.md`：全局个人指令
  - `<project>/.claude/CLAUDE.md` 或 `<project>/CLAUDE.md`：项目级指令
  - 支持 `@file` 引用外部文件
- **企业价值**：统一基线行为、注入安全规范、定义编码标准

#### 2. Agents（专用子代理）
- **作用**：通过 `Agent` 工具调用的专用 Claude 实例，有独立的工具权限和模型选择
- **存储位置**：
  - 全局：`~/.claude/agents/<name>.md`
  - 项目级：`.claude/agents/<name>.md`
- **格式（YAML frontmatter + Markdown）**：
  ```markdown
  ---
  name: code-reviewer
  description: 代码质量审查，在写完代码后触发
  tools: Read, Grep, Glob, Bash
  model: sonnet
  ---
  # 职责说明...
  ```
- **触发方式**：通过 `Agent(subagent_type="xxx")` 或 Claude 自主决策调用
- **关键特性**：
  - 独立上下文（不共享主会话记忆）
  - 可并行运行（`run_in_background: true`）
  - 支持模型路由（haiku/sonnet/opus）
- **ECC 体系中**：48个代理，覆盖 code-review、security、build-fix、tdd、planner 等

#### 3. Skills（技能/工作流）
- **作用**：可触发的工作流定义，包含详细的操作指南，通过 `Skill` 工具调用
- **存储位置**：
  - 全局：`~/.claude/skills/<name>.md`
  - 项目级：`.claude/skills/<name>.md`
  - 插件提供：通过 plugin 安装
- **格式**：
  ```markdown
  ---
  name: tdd-workflow
  description: TDD工作流，当用户要写新功能时触发
  ---
  # When to Use
  # How It Works  
  # Examples
  ```
- **触发方式**：
  - 用户明确调用：`/skill-name`
  - Claude 自主判断：1% 可能性就应触发
  - 关键词匹配：如"autopilot"→autopilot skill
- **ECC 体系中**：183个技能，按语言/框架/流程分类
- **Superpowers 中**：14个核心技能，构成完整开发工作流

#### 4. Commands（斜杠命令）
- **作用**：用户主动触发的命令，展开为详细的提示内容
- **存储位置**：
  - 全局：`~/.claude/commands/<name>.md`
  - 项目级：`.claude/commands/<name>.md`
- **格式**：
  ```markdown
  ---
  description: 命令的一行描述
  ---
  执行内容...支持 $ARGUMENTS 变量
  ```
- **触发方式**：`/command-name [arguments]`
- **ECC 体系中**：79个命令（/tdd, /plan, /e2e, /code-review, /build-fix 等）
- **GSD 体系中**：73个gsd-*命令（/gsd-new-project, /gsd-execute-phase 等）

#### 5. Hooks（自动化钩子）
- **作用**：在特定事件时自动执行的 shell 命令，实现无感知的自动化
- **配置位置**：`settings.json`（项目级或全局）
- **事件类型**：
  - `PreToolUse`：工具调用前（可阻止执行）
  - `PostToolUse`：工具调用后
  - `Stop`：会话结束时
  - `UserPromptSubmit`：用户提交提示时（需额外激活）
- **格式**：
  ```json
  {
    "hooks": {
      "PostToolUse": [{
        "matcher": "Write|Edit",
        "command": "pnpm prettier --write $FILE_PATH"
      }]
    }
  }
  ```
- **典型用途**：
  - 代码格式化（PostToolUse on Write/Edit）
  - 类型检查（PostToolUse on Write）
  - 上下文监控（GSD 的 gsd-context-monitor.js）
  - 工作流守卫（GSD 的 gsd-workflow-guard.js）
  - 会话状态（GSD 的 gsd-session-state.sh）
  - 子代理上下文注入（Trellis 的 inject-subagent-context.py）
- **安全警告**：钩子以用户权限运行，不受 Claude 沙箱限制

#### 6. Rules（规范准则）
- **作用**：始终加载到上下文的指导原则，Claude 必须遵守
- **存储位置**：
  - 全局：`~/.claude/rules/`（含子目录，按语言/场景分类）
  - 项目级：`.claude/rules/`
- **格式**：Markdown 文件，无特殊 frontmatter 要求
- **典型分类**：
  - `common/`：语言无关原则（coding-style, testing, security, git-workflow）
  - `typescript/`、`python/`、`golang/` 等语言特定规则
  - `web/`：前端特定规则
- **加载方式**：系统自动加载，用户无需显式触发
- **ECC 体系中**：16个规则文件

#### 7. MCP（模型上下文协议配置）
- **作用**：配置 MCP 服务器，为 Claude 提供额外工具（数据库、API、文件系统等）
- **配置位置**：
  - 项目级：`.mcp.json`
  - 全局：`~/.claude/mcp-configs/`
- **格式**：
  ```json
  {
    "mcpServers": {
      "server-name": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-name"],
        "env": { "API_KEY": "..." }
      }
    }
  }
  ```
- **常见 MCP 服务器**：
  - `context7`：实时文档查询
  - `playwright`：浏览器自动化
  - `github`：GitHub API 集成
  - `notion`：Notion 集成
  - 自定义：数据库、内部 API
- **企业价值**：统一工具访问权限、安全控制 API 密钥

#### 8. Plugins（插件包）
- **作用**：打包分发的 Claude Code 扩展，可包含 agents/skills/commands/hooks/rules/mcp 的集合
- **存储位置**：`~/.claude/plugins/`
- **管理命令**：
  ```bash
  claude plugin marketplace add <url>   # 添加市场
  claude plugin install <name>@<market> # 安装插件
  /plugins                              # 浏览插件
  ```
- **市场文件**：`installed_plugins.json`, `known_marketplaces.json`
- **官方市场**：`anthropics/claude-plugins-official`
- **企业场景**：搭建私有插件市场，统一分发企业级资产

#### 9. Settings（配置文件）
- **作用**：控制 Claude Code 的核心行为（模型选择、权限、工具白名单等）
- **位置**：`~/.claude/settings.json`（全局）或项目级 `settings.json`
- **关键配置项**：
  ```json
  {
    "model": "claude-sonnet-4-6",
    "allowedTools": ["Read", "Write", "Edit"],
    "hooks": {...},
    "env": {...}
  }
  ```

---

## 二、资产继承与覆盖机制

### 2.1 加载优先级（从高到低）
```
1. 项目级 .claude/ 下的资产（最高优先级）
2. 全局 ~/.claude/ 下的资产
3. 插件提供的资产
4. 系统默认行为
```

### 2.2 CLAUDE.md 合并策略
```
~/.claude/CLAUDE.md           # 全局基线
    + <project>/CLAUDE.md     # 项目追加
    + .claude/CLAUDE.md       # 可覆盖全局
= 最终有效指令（全部合并）
```

### 2.3 Rules 合并策略
- 相同文件名：项目级覆盖全局（特定优先于通用）
- 不同文件名：全部加载，不冲突
- 语言特定规则覆盖 common/ 规则

---

## 三、企业级资产管理设计建议

### 3.1 四层架构模型

```
┌─────────────────────────────────────────────────────────┐
│                   企业基线层（Enterprise）                │
│  CLAUDE.md基线 | 安全Rules | 合规Hooks | 审核Plugins     │
├─────────────────────────────────────────────────────────┤
│                   部门层（Department）                    │
│  领域Agents | 业务Skills | 部门Commands | 技术Rules      │
├─────────────────────────────────────────────────────────┤
│                   团队层（Team）                          │
│  团队Agents | 工作流Skills | 团队Commands | 编码Rules    │
├─────────────────────────────────────────────────────────┤
│                   仓库层（Repository）                    │
│  项目Agents | 项目Skills | 项目Commands | 项目Hooks      │
├─────────────────────────────────────────────────────────┤
│                   个人层（Individual）                    │
│  个人Agents | 个人Skills | 个人Commands | 个人Settings   │
└─────────────────────────────────────────────────────────┘
```

### 3.2 资产分发机制

**方案A：插件市场（推荐）**
```bash
# 企业内部市场
claude plugin marketplace add https://internal.company.com/claude-plugins

# 按角色安装
claude plugin install enterprise-baseline@internal
claude plugin install backend-team@internal
claude plugin install security-review@internal
```

**方案B：Git 仓库 + 安装脚本**
```bash
# wsd_manager 生成的安装脚本
wsdm sync --department=engineering --team=backend --user=weizhen
# → 同步到 ~/.claude/ 和 .claude/
```

**方案C：文件系统直接部署**
```bash
# wsd_manager 直接写入对应层级目录
cp team/agents/* .claude/agents/
cp team/rules/* .claude/rules/
```

### 3.3 资产冲突解决策略

| 冲突类型 | 解决方案 |
|----------|----------|
| 同名 Agent | 项目级覆盖，加载最近的 |
| 同名 Skill | 项目级覆盖，工具自动选择 |
| 同名 Rule | 语言特定 > common，项目级 > 全局 |
| Hook 冲突 | 按层级顺序叠加执行，不互相覆盖 |
| CLAUDE.md | 全部合并，后加载的追加到末尾 |

### 3.4 资产审计能力

需要管理的元数据：
```json
{
  "asset": "code-reviewer.md",
  "type": "agent",
  "layer": "team",
  "owner": "backend-team",
  "version": "1.2.0",
  "lastModified": "2026-04-14",
  "usageCount": 423,
  "repos": ["repo-a", "repo-b"],
  "dependencies": [],
  "complianceStatus": "approved"
}
```

---

## 四、wsd 与 wsd_manager 联动设计

### 4.1 wsd 需求的资产依赖声明

```markdown
---
command: wsd-execute
requires_agents: [planner, code-reviewer, tdd-guide]
requires_skills: [writing-plans, tdd-workflow]
requires_hooks: [quality-gate]
min_layer: team
---
```

### 4.2 wsd_manager 资产解析流程

```
用户调用 /wsd-execute
    │
    ▼
wsd 解析资产依赖
    │
    ▼
wsd_manager.resolve(assets, context)
    ├── 查找企业层：enterprise/agents/planner.md ✓
    ├── 查找团队层：team/agents/planner.md → 覆盖企业层
    └── 查找项目层：.claude/agents/planner.md → 最终使用
    │
    ▼
加载解析结果到 Claude 上下文
    │
    ▼
执行 wsd 工作流
```

### 4.3 资产版本管理

```
wsd_manager/
├── registry/
│   ├── enterprise/
│   │   └── assets.json     # 企业资产注册表
│   ├── departments/
│   │   └── <dept>/assets.json
│   └── teams/
│       └── <team>/assets.json
├── versions/
│   └── <asset-type>/<name>/<version>.md  # 版本存档
└── deploy/
    └── <environment>/      # 部署快照
```

---

## 五、各参考项目最佳实践提炼

### 来自 ECC
- ✅ 资产格式标准化（YAML frontmatter + Markdown）
- ✅ 企业控制文件（`.claude/enterprise/controls.md`）
- ✅ 团队配置文件（`.claude/team/team-config.json`）
- ✅ 跨平台适配（cursor/codex/opencode/gemini 各有对应目录）
- ✅ 插件市场生态

### 来自 GSD
- ✅ 阶段驱动开发（workspace → milestone → phase 三层结构）
- ✅ 上下文守卫（防止 context rot 的 hook 机制）
- ✅ 工作流守卫（确保流程遵从的 hook）
- ✅ 状态管理（STATE.md + 文件系统一致性检查）

### 来自 Superpowers
- ✅ 技能自动触发（1% 概率就要检查）
- ✅ 子代理驱动开发（SDD 模式）
- ✅ 技能编写标准（When/How/Examples 三段结构）

### 来自 Trellis
- ✅ 规格自动注入（`.trellis/spec/` → 每次会话自动加载）
- ✅ 个人工作区（`.trellis/workspace/<username>/`）
- ✅ 多平台统一（同一套资产适配13个平台）
- ✅ ralph-loop（持续自主循环执行）

### 来自 OpenSpec
- ✅ 变更提案工作流（proposal → design → tasks → archive）
- ✅ 规格与变更分离（specs/ vs changes/）
- ✅ 可验证的交付物（每个 change 有明确的 tasks.md）

### 来自 OMC
- ✅ 模型路由策略（haiku/sonnet/opus 按任务分配）
- ✅ 团队编排模式（plan→prd→exec→verify→fix 流水线）
- ✅ 深度访谈（需求不清时的苏格拉底式澄清）
