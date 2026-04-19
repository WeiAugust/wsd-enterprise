'use strict';
/**
 * AssetStore — 资产存储（支持组织绑定、版本化、发布工作流、必选/可选）
 *
 * 版本模型：
 *   content          = 主文件当前草稿内容
 *   publishedContent = 主文件最后发布版本（订阅者下载）
 *   extraFiles       = 附加文件列表（多文件型资产，如 skill 目录、rule 目录）
 *   publishedExtraFiles = extraFiles 的发布版本
 *
 * 资产类型说明（对应 Claude Code 真实目录结构）：
 *   hook      → .claude/hooks/hooks.json      JSON，PreToolUse/PostToolUse/Stop 数组
 *   agent     → .claude/agents/<name>.md      YAML frontmatter + Markdown body
 *   skill     → .claude/skills/<name>/        目录，SKILL.md + 可选附加文件（multiFile=true）
 *   command   → .claude/commands/<name>.md    YAML frontmatter + Markdown body
 *   rule      → .claude/rules/<category>/     目录，多个 .md 文件（multiFile=true）
 *   mcp       → .mcp.json                     JSON，mcpServers 对象
 *   template  → 任意文件（CLAUDE.md / settings.json 模板）
 *
 * 资产依赖关系（dependencies）：
 *   rules  → skills（规则说明"做什么"，技能说明"怎么做"）
 *   commands → agents / skills（命令调用代理或技能）
 *   agents → mcps（代理声明所需 MCP 工具）
 */

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const DATA_DIR = path.resolve(process.env.WSD_DATA_DIR || path.join(__dirname, '../../data'));
const ASSETS_FILE = path.join(DATA_DIR, 'assets.json');

const ASSET_TYPES = ['hook', 'agent', 'skill', 'command', 'rule', 'mcp', 'template'];
const ASSET_STATUSES = ['draft', 'pending_review', 'published', 'archived'];

/** 每种资产类型的内容格式和文件后缀 */
const TYPE_META = {
  hook: {
    format: 'json',
    ext: '.json',
    installDir: '.claude/hooks',
    multiFile: false,
    mainFile: 'hooks.json',
    desc: 'PreToolUse/PostToolUse/Stop 自动化钩子，JSON 配置格式，注入到 settings.json',
    realWorldFormat: '{ hooks: { PreToolUse: [{matcher, hooks:[{type,command}], description, id}], PostToolUse: [...], Stop: [...] } }',
  },
  agent: {
    format: 'markdown',
    ext: '.md',
    installDir: '.claude/agents',
    multiFile: false,
    mainFile: '<name>.md',
    desc: 'YAML frontmatter（name/description/tools/model）+ Markdown 系统提示，通过 Agent 工具调用',
    realWorldFormat: '---\nname: xxx\ndescription: xxx\ntools: Read,Grep,Glob\nmodel: sonnet\n---\n\n# Body...',
  },
  skill: {
    format: 'markdown',
    ext: '.md',
    installDir: '.claude/skills',
    multiFile: true,
    mainFile: 'SKILL.md',
    desc: '目录型资产：SKILL.md（YAML frontmatter + Markdown）+ 可选示例文件，通过 Skill 工具触发',
    realWorldFormat: '---\nname: xxx\ndescription: xxx\norigin: ECC\n---\n\n# When to Activate\n...',
  },
  command: {
    format: 'markdown',
    ext: '.md',
    installDir: '.claude/commands',
    multiFile: false,
    mainFile: '<name>.md',
    desc: 'YAML frontmatter（description/argument-hint）+ Markdown 正文，用户 /命令 主动触发',
    realWorldFormat: '---\ndescription: 一行描述\nargument-hint: [可选参数提示]\n---\n\n# Body...',
  },
  rule: {
    format: 'markdown',
    ext: '.md',
    installDir: '.claude/rules',
    multiFile: true,
    mainFile: 'README.md',
    desc: '目录型资产：按语言/类别分目录，每个 .md 文件自动加载到上下文，规则说明"做什么"',
    realWorldFormat: '# 规则名称\n\n原则列表...\n\n> 语言特定规则引用: ../common/xxx.md',
  },
  mcp: {
    format: 'json',
    ext: '.json',
    installDir: '.mcp.json',
    multiFile: false,
    mainFile: '.mcp.json',
    desc: 'MCP 服务器配置，JSON 格式，合并到项目级或全局 .mcp.json',
    realWorldFormat: '{ mcpServers: { "server-name": { command, args, env, description } } }',
  },
  template: {
    format: 'markdown',
    ext: '.md',
    installDir: '.claude',
    multiFile: false,
    mainFile: 'CLAUDE.md',
    desc: 'CLAUDE.md 模板或 settings.json 模板，用于初始化项目级 AI 配置',
    realWorldFormat: 'CLAUDE.md 或 JSON（settings.json）',
  },
};

// ── 内容模板 ──────────────────────────────────────────────────────────────────

const CONTENT_TEMPLATES = {
  hook: JSON.stringify({
    "$schema": "https://json.schemastore.org/claude-code-settings.json",
    "hooks": {
      "PreToolUse": [
        {
          "matcher": "Bash",
          "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/security-check.js" }],
          "description": "安全检查：阻止危险命令",
          "id": "pre:bash:security"
        }
      ],
      "PostToolUse": [
        {
          "matcher": "Write|Edit",
          "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/format.js $FILE_PATH" }],
          "description": "保存后自动格式化",
          "id": "post:write:format"
        }
      ],
      "Stop": []
    }
  }, null, 2),

  agent: `---
name: my-agent
description: 描述此代理的用途和触发时机，Claude 有 1% 可能性就应调用
tools: Read, Grep, Glob, Bash
model: sonnet
---

# 代理职责

说明此代理的职责和能力。

## 触发条件

- 何时应该使用此代理
- 触发的具体场景

## 工作流程

1. 步骤一：分析
2. 步骤二：执行
3. 步骤三：验证

## 输出格式

说明代理的输出格式。
`,

  skill: `---
name: my-skill
description: 描述此技能的用途，Claude 有 1% 可能性就应触发
origin: Enterprise
---

# When to Activate

说明触发此技能的场景和条件。

## How It Works

说明工作流程和步骤。

## Checklist

- [ ] 步骤一
- [ ] 步骤二
- [ ] 步骤三

## Examples

示例用法。
`,

  command: `---
description: 一行描述此命令的用途
argument-hint: [可选：参数提示，如 pr-number | blank]
---

# 命令名称

此命令的详细说明。

## 用法

\`\`\`
/command-name [参数]
\`\`\`

## 执行步骤

1. 步骤一
2. 步骤二

## 示例

\`\`\`bash
/command-name arg1
\`\`\`
`,

  rule: `# 规则名称

说明此规则的目的和适用范围。

## 核心原则

- 原则一
- 原则二

## 检查清单

- [ ] 检查项一
- [ ] 检查项二

## 代码示例

\`\`\`typescript
// 示例代码
\`\`\`

## 参见

- 相关技能 / 相关规则
`,

  mcp: JSON.stringify({
    "mcpServers": {
      "my-server": {
        "command": "npx",
        "args": ["-y", "@company/mcp-server"],
        "env": {
          "API_KEY": "${MCP_API_KEY}"
        },
        "description": "说明此 MCP 服务器的用途"
      }
    }
  }, null, 2),

  template: `# 项目 AI 配置模板

此模板用于初始化项目的 CLAUDE.md。

## 编码规范

遵循团队统一编码标准，参见 ~/.claude/rules/common/。

## 项目概述

{{PROJECT_DESCRIPTION}}

## 技术栈

- {{TECH_STACK}}

## 工作流程

使用 WSD 需求生命周期管理：PROPOSED → ANALYZING → DESIGNING → DEVELOPING → REVIEWING → TESTING → DONE

## 重要文件

- \`CLAUDE.md\` — 项目级指令（本文件）
- \`wsd.json\` — 需求状态追踪
`,
};

// ── 附加文件模板（多文件型资产） ──────────────────────────────────────────────

const EXTRA_FILE_TEMPLATES = {
  skill: [
    {
      name: 'examples/example-usage.md',
      content: `# ${'{skill-name}'} 使用示例\n\n## 基础用法\n\n...\n\n## 高级用法\n\n...\n`,
      description: '使用示例文件（可选）',
    }
  ],
  rule: [
    {
      name: 'common/coding-style.md',
      content: `# 编码风格\n\n## 核心原则\n\n- 保持简洁（KISS）\n- 不重复（DRY）\n- 不过度设计（YAGNI）\n`,
      description: '通用编码风格规则',
    },
    {
      name: 'typescript/coding-style.md',
      content: `> 此文件扩展 [common/coding-style.md](../common/coding-style.md) 的 TypeScript 特定内容。\n\n# TypeScript 编码风格\n\n## 类型安全\n\n- 避免使用 any\n- 为公共 API 添加类型注解\n`,
      description: 'TypeScript 特定编码风格规则',
    }
  ],
};

// ── 持久化 ────────────────────────────────────────────────────────────────────

function loadAssets() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(ASSETS_FILE)) return seedAssets();
    return JSON.parse(fs.readFileSync(ASSETS_FILE, 'utf8'));
  } catch {
    return { assets: [] };
  }
}

function saveAssets(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ASSETS_FILE, JSON.stringify(data, null, 2));
}

function makeAsset(fields) {
  const typeMeta = TYPE_META[fields.type] || TYPE_META.rule;
  return {
    id: fields.id || `asset-${randomUUID().slice(0, 8)}`,
    name: fields.name,
    type: fields.type,
    orgId: fields.orgId,
    mandatory: fields.mandatory || false,
    status: fields.status || 'draft',
    description: fields.description || '',
    tags: fields.tags || [],
    // 版本字段
    version: fields.version || '1.0.0',
    publishedVersion: fields.publishedVersion || null,
    // 主文件内容（单文件资产 / 多文件资产的 mainFile）
    content: fields.content !== undefined ? fields.content : (CONTENT_TEMPLATES[fields.type] || ''),
    publishedContent: fields.publishedContent || null,
    // 附加文件（多文件型资产：skill, rule）
    extraFiles: fields.extraFiles || [],           // [{name, content, description}]
    publishedExtraFiles: fields.publishedExtraFiles || [],
    // 资产依赖关系
    dependencies: fields.dependencies || [],       // [{id, type, assetId, assetName, relation}]
    versionHistory: fields.versionHistory || [],
    // 发布元数据
    publishedBy: fields.publishedBy || null,
    publishedAt: fields.publishedAt || null,
    // 格式信息（从 TYPE_META 派生）
    contentFormat: typeMeta.format,
    multiFile: typeMeta.multiFile,
    // 时间戳
    createdAt: fields.createdAt || new Date().toISOString(),
    updatedAt: fields.updatedAt || new Date().toISOString(),
  };
}

function seedAssets() {
  const now = new Date().toISOString();
  const data = {
    assets: [
      // ── Hooks（必选安全类）
      makeAsset({
        id: 'asset-sec-001', name: 'security-guard', type: 'hook', orgId: 'ent-default',
        mandatory: true, status: 'published',
        description: '安全守卫钩子 — 阻止未授权的危险操作（必选，不可禁用）',
        tags: ['security', 'mandatory'], version: '1.0.0', publishedVersion: '1.0.0',
        content: JSON.stringify({
          "$schema": "https://json.schemastore.org/claude-code-settings.json",
          "hooks": {
            "PreToolUse": [
              {
                "matcher": "Bash",
                "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/security-guard.js" }],
                "description": "阻止危险 shell 命令（rm -rf、sudo 等）",
                "id": "pre:bash:security-guard"
              }
            ]
          }
        }, null, 2),
        publishedContent: JSON.stringify({
          "$schema": "https://json.schemastore.org/claude-code-settings.json",
          "hooks": {
            "PreToolUse": [
              {
                "matcher": "Bash",
                "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/security-guard.js" }],
                "description": "阻止危险 shell 命令",
                "id": "pre:bash:security-guard"
              }
            ]
          }
        }, null, 2),
        publishedBy: 'system', publishedAt: now, createdAt: now, updatedAt: now,
        versionHistory: [{ version: '1.0.0', publishedAt: now, publishedBy: 'system', note: '初始版本' }]
      }),
      makeAsset({
        id: 'asset-sec-002', name: 'audit-logger', type: 'hook', orgId: 'ent-default',
        mandatory: true, status: 'published',
        description: '审计日志钩子 — 记录所有 AI 工具调用（必选，合规要求）',
        tags: ['security', 'audit', 'mandatory'], version: '1.0.0', publishedVersion: '1.0.0',
        content: JSON.stringify({
          "$schema": "https://json.schemastore.org/claude-code-settings.json",
          "hooks": {
            "PostToolUse": [
              {
                "matcher": ".*",
                "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/audit-logger.js" }],
                "description": "记录所有工具调用到 .wsd/audit/",
                "id": "post:all:audit-logger"
              }
            ]
          }
        }, null, 2),
        publishedContent: JSON.stringify({
          "$schema": "https://json.schemastore.org/claude-code-settings.json",
          "hooks": {
            "PostToolUse": [
              {
                "matcher": ".*",
                "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/audit-logger.js" }],
                "description": "记录所有工具调用",
                "id": "post:all:audit-logger"
              }
            ]
          }
        }, null, 2),
        publishedBy: 'system', publishedAt: now, createdAt: now, updatedAt: now,
        versionHistory: [{ version: '1.0.0', publishedAt: now, publishedBy: 'system', note: '初始版本' }]
      }),

      // ── Skills（多文件型）
      makeAsset({
        id: 'asset-wf-001', name: 'wsd-lifecycle', type: 'skill', orgId: 'ent-default',
        mandatory: false, status: 'published',
        description: 'WSD 需求生命周期管理技能 — 七阶段状态机',
        tags: ['workflow', 'lifecycle'], version: '1.2.0', publishedVersion: '1.2.0',
        content: `---
name: wsd-lifecycle
description: WSD 需求生命周期感知，管理从 PROPOSED 到 ARCHIVED 的七阶段状态机
origin: WSD Enterprise
---

# When to Activate

当用户提到需求状态、任务进度、或使用 WSD 工作流时自动触发。

# 七阶段生命周期

| 阶段 | 状态码 | 说明 |
|------|--------|------|
| 1 | PROPOSED | 需求提出，待分析 |
| 2 | ANALYZING | 正在分析需求 |
| 3 | DESIGNING | 架构设计阶段 |
| 4 | DEVELOPING | 开发实现阶段 |
| 5 | REVIEWING | 代码审查阶段 |
| 6 | TESTING | 测试验证阶段 |
| 7 | DONE | 完成并归档 |

# How to Use

使用 \`wsd.json\` 追踪需求状态，每次状态变更时更新文件。
`,
        extraFiles: [
          {
            name: 'examples/status-transitions.md',
            content: `# 状态转换示例\n\n## PROPOSED → ANALYZING\n\n当需求被接受开始分析时转换。\n\n## ANALYZING → DESIGNING\n\n分析完成，进入架构设计阶段。\n`,
            description: '状态转换示例文档',
          }
        ],
        publishedContent: `---\nname: wsd-lifecycle\ndescription: WSD 需求生命周期感知\norigin: WSD Enterprise\n---\n\n# WSD Lifecycle\n\n七阶段状态机管理。\n`,
        publishedExtraFiles: [],
        publishedBy: 'system', publishedAt: now, createdAt: now, updatedAt: now,
        versionHistory: [
          { version: '1.0.0', publishedAt: now, publishedBy: 'system', note: '初始版本' },
          { version: '1.2.0', publishedAt: now, publishedBy: 'system', note: '完善七阶段状态描述，新增附加示例文件' }
        ]
      }),

      // ── Agents
      makeAsset({
        id: 'asset-ai-001', name: 'code-reviewer', type: 'agent', orgId: 'ent-default',
        mandatory: false, status: 'published',
        description: '代码审查代理 — 检查质量、安全性和可维护性',
        tags: ['code-quality', 'review'], version: '2.1.0', publishedVersion: '2.1.0',
        content: `---
name: code-reviewer
description: 代码质量审查专家，编写或修改代码后立即触发
tools: Read, Grep, Glob, Bash
model: sonnet
---

# Code Reviewer

代码审查专家，检查质量、安全性和可维护性。

## 触发条件

- 完成一段代码的编写或修改后
- 提交前的最终检查
- 安全敏感代码变更

## 审查维度

1. **安全性** — 注入、XSS、硬编码密钥
2. **代码质量** — 可读性、函数大小、嵌套深度
3. **性能** — N+1 查询、无界操作
4. **测试覆盖** — 80%+ 覆盖率

## 输出格式

按 CRITICAL/HIGH/MEDIUM/LOW 分级输出问题列表。
`,
        dependencies: [
          { id: 'dep-001', type: 'mcp', assetId: '', assetName: 'github', relation: 'uses-tool', note: '可选：读取 PR 上下文' }
        ],
        publishedContent: `---\nname: code-reviewer\ndescription: 代码质量审查专家，编写或修改代码后立即触发\ntools: Read, Grep, Glob, Bash\nmodel: sonnet\n---\n\n# Code Reviewer\n\n审查代码质量、安全漏洞和最佳实践。\n`,
        publishedBy: 'system', publishedAt: now, createdAt: now, updatedAt: now,
        versionHistory: [
          { version: '1.0.0', publishedAt: now, publishedBy: 'system', note: '初始版本' },
          { version: '2.1.0', publishedAt: now, publishedBy: 'system', note: '增加安全检查和性能分析维度' }
        ]
      }),

      // ── Commands
      makeAsset({
        id: 'asset-cmd-001', name: 'wsd-review', type: 'command', orgId: 'ent-default',
        mandatory: false, status: 'published',
        description: '/wsd-review — 触发完整的 WSD 代码审查工作流',
        tags: ['workflow', 'review'], version: '1.0.0', publishedVersion: '1.0.0',
        content: `---
description: 触发完整的 WSD 代码审查工作流（安全 + 质量 + 测试覆盖）
argument-hint: [pr-number | blank for local changes]
---

# WSD Code Review

执行企业标准代码审查流程。

## 步骤

1. 运行 \`git diff\` 获取变更
2. 调用 **code-reviewer** 代理进行安全和质量审查
3. 检查测试覆盖率 >= 80%
4. 输出分级审查报告

$ARGUMENTS 中如果包含 PR 号，切换到 PR 审查模式。
`,
        dependencies: [
          { id: 'dep-002', type: 'agent', assetId: 'asset-ai-001', assetName: 'code-reviewer', relation: 'invokes', note: '调用代码审查代理' }
        ],
        publishedContent: `---\ndescription: 触发完整的 WSD 代码审查工作流\n---\n\n# WSD Code Review\n\n企业标准代码审查。\n`,
        publishedBy: 'system', publishedAt: now, createdAt: now, updatedAt: now,
        versionHistory: [{ version: '1.0.0', publishedAt: now, publishedBy: 'system', note: '初始版本' }]
      }),

      // ── Rules（多文件型）
      makeAsset({
        id: 'asset-rule-001', name: 'enterprise-coding-standards', type: 'rule', orgId: 'ent-default',
        mandatory: false, status: 'published',
        description: '企业编码规范 — 通用原则 + TypeScript 特定规则（多文件目录型）',
        tags: ['coding-style', 'standards'], version: '1.0.0', publishedVersion: '1.0.0',
        content: `# 企业编码规范

## 结构说明

本规范按语言分层组织，包含以下文件：

- \`common/coding-style.md\` — 通用编码原则（所有语言适用）
- \`typescript/coding-style.md\` — TypeScript 特定规则（覆盖通用规则）

## 优先级

语言特定规则 > 通用规则（更具体的覆盖更通用的）。
`,
        extraFiles: [
          {
            name: 'common/coding-style.md',
            content: `# 通用编码风格\n\n## 不可变性（关键）\n\n始终创建新对象，永远不要修改现有对象。\n\n## 文件组织\n\n多个小文件 > 少量大文件。典型 200-400 行，最多 800 行。\n\n## 错误处理\n\n始终在每一层显式处理错误，不要静默吞掉错误。\n`,
            description: '通用编码风格（语言无关）',
          },
          {
            name: 'typescript/coding-style.md',
            content: `> 此文件扩展 [common/coding-style.md](../common/coding-style.md)\n\n# TypeScript 编码风格\n\n## 类型安全\n\n- 避免使用 \`any\`，用 \`unknown\` 代替\n- 为公共 API 添加类型注解\n- 使用 Zod 进行运行时类型验证\n\n## 异步处理\n\n- 使用 async/await，不用回调\n- 总是处理 Promise 错误\n`,
            description: 'TypeScript 特定编码风格',
          }
        ],
        dependencies: [
          { id: 'dep-003', type: 'skill', assetId: 'asset-wf-001', assetName: 'wsd-lifecycle', relation: 'references', note: '规则引用的工作流技能' }
        ],
        publishedContent: `# 企业编码规范\n\n通用原则 + TypeScript 特定规则。\n`,
        publishedExtraFiles: [],
        publishedBy: 'system', publishedAt: now, createdAt: now, updatedAt: now,
        versionHistory: [{ version: '1.0.0', publishedAt: now, publishedBy: 'system', note: '初始版本' }]
      }),

      // ── MCP
      makeAsset({
        id: 'asset-mcp-001', name: 'github-mcp', type: 'mcp', orgId: 'ent-default',
        mandatory: false, status: 'published',
        description: 'GitHub MCP 服务器 — PR、Issue、代码搜索等操作',
        tags: ['github', 'integration'], version: '1.0.0', publishedVersion: '1.0.0',
        content: JSON.stringify({
          "mcpServers": {
            "github": {
              "command": "npx",
              "args": ["-y", "@modelcontextprotocol/server-github"],
              "env": {
                "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PAT}"
              },
              "description": "GitHub 操作 — PR、Issue、仓库管理"
            }
          }
        }, null, 2),
        publishedContent: JSON.stringify({
          "mcpServers": {
            "github": {
              "command": "npx",
              "args": ["-y", "@modelcontextprotocol/server-github"],
              "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PAT}" },
              "description": "GitHub 操作"
            }
          }
        }, null, 2),
        publishedBy: 'system', publishedAt: now, createdAt: now, updatedAt: now,
        versionHistory: [{ version: '1.0.0', publishedAt: now, publishedBy: 'system', note: '初始版本' }]
      }),
    ]
  };
  saveAssets(data);
  return data;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

function listAssets({ orgId, type, status, mandatory } = {}) {
  const { assets } = loadAssets();
  return assets.filter(a => {
    if (orgId !== undefined && a.orgId !== orgId) return false;
    if (type !== undefined && a.type !== type) return false;
    if (status !== undefined && a.status !== status) return false;
    if (mandatory !== undefined && a.mandatory !== mandatory) return false;
    return true;
  });
}

function getAsset(id) {
  const { assets } = loadAssets();
  return assets.find(a => a.id === id) || null;
}

function createAsset({ name, type, orgId, description = '', content, tags = [], mandatory = false, version = '1.0.0' }) {
  if (!name || !type || !orgId) throw new Error('name, type, orgId are required');
  if (!ASSET_TYPES.includes(type)) throw new Error(`type must be one of: ${ASSET_TYPES.join(', ')}`);

  const data = loadAssets();
  const asset = makeAsset({ name, type, orgId, description, content, tags, mandatory, version });
  data.assets.push(asset);
  saveAssets(data);
  return asset;
}

/**
 * 更新资产内容 — 修改后变为新草稿版本
 * 若当前是 published 状态，自动变为 draft（publishedContent 保持不变）
 */
function updateAsset(id, updates) {
  const data = loadAssets();
  const idx = data.assets.findIndex(a => a.id === id);
  if (idx < 0) throw new Error(`Asset ${id} not found`);

  const current = data.assets[idx];
  const immutable = ['id', 'orgId', 'publishedBy', 'publishedAt', 'publishedContent',
    'publishedExtraFiles', 'publishedVersion', 'versionHistory', 'contentFormat',
    'multiFile', 'createdAt'];
  for (const key of immutable) delete updates[key];

  const contentChanged = updates.content !== undefined && updates.content !== current.content;
  let newStatus = updates.status || current.status;
  let newVersion = updates.version || current.version;

  if (contentChanged && current.status === 'published') {
    newStatus = 'draft';
    newVersion = bumpPatch(current.publishedVersion || current.version);
  }

  data.assets[idx] = {
    ...current,
    ...updates,
    id,
    status: updates.status !== undefined ? updates.status : newStatus,
    version: newVersion,
    updatedAt: new Date().toISOString(),
  };
  saveAssets(data);
  return data.assets[idx];
}

function bumpPatch(ver) {
  const parts = (ver || '1.0.0').split('.').map(Number);
  parts[2] = (parts[2] || 0) + 1;
  return parts.join('.');
}

function deleteAsset(id) {
  const data = loadAssets();
  const asset = data.assets.find(a => a.id === id);
  if (!asset) throw new Error(`Asset ${id} not found`);
  if (asset.mandatory) throw new Error(`Cannot delete mandatory asset`);
  data.assets = data.assets.filter(a => a.id !== id);
  saveAssets(data);
  return asset;
}

// ── 多文件管理（extraFiles）────────────────────────────────────────────────────

/**
 * 添加或更新资产中的附加文件（仅多文件型资产支持）
 */
function upsertExtraFile(assetId, fileName, content, description = '') {
  const data = loadAssets();
  const idx = data.assets.findIndex(a => a.id === assetId);
  if (idx < 0) throw new Error(`Asset ${assetId} not found`);
  const asset = data.assets[idx];
  if (!asset.multiFile) throw new Error(`Asset type "${asset.type}" does not support extra files`);

  const files = [...(asset.extraFiles || [])];
  const fileIdx = files.findIndex(f => f.name === fileName);
  if (fileIdx >= 0) {
    files[fileIdx] = { ...files[fileIdx], content, description: description || files[fileIdx].description };
  } else {
    files.push({ name: fileName, content, description });
  }

  // 内容变更若已发布则变为草稿
  let newStatus = asset.status;
  let newVersion = asset.version;
  if (asset.status === 'published') {
    newStatus = 'draft';
    newVersion = bumpPatch(asset.publishedVersion || asset.version);
  }

  data.assets[idx] = { ...asset, extraFiles: files, status: newStatus, version: newVersion, updatedAt: new Date().toISOString() };
  saveAssets(data);
  return data.assets[idx];
}

function removeExtraFile(assetId, fileName) {
  const data = loadAssets();
  const idx = data.assets.findIndex(a => a.id === assetId);
  if (idx < 0) throw new Error(`Asset ${assetId} not found`);
  const asset = data.assets[idx];
  if (!asset.multiFile) throw new Error(`Asset type "${asset.type}" does not support extra files`);

  data.assets[idx] = {
    ...asset,
    extraFiles: (asset.extraFiles || []).filter(f => f.name !== fileName),
    updatedAt: new Date().toISOString(),
  };
  saveAssets(data);
  return data.assets[idx];
}

// ── 依赖关系管理 ─────────────────────────────────────────────────────────────

/** 关系类型：invokes（调用）/ references（引用）/ uses-tool（使用工具）/ extends（继承） */
const DEPENDENCY_RELATIONS = ['invokes', 'references', 'uses-tool', 'extends'];

function addDependency(assetId, { type, assetId: depAssetId, assetName, relation, note = '' }) {
  if (!DEPENDENCY_RELATIONS.includes(relation)) {
    throw new Error(`relation must be one of: ${DEPENDENCY_RELATIONS.join(', ')}`);
  }
  const data = loadAssets();
  const idx = data.assets.findIndex(a => a.id === assetId);
  if (idx < 0) throw new Error(`Asset ${assetId} not found`);

  const dep = {
    id: `dep-${randomUUID().slice(0, 8)}`,
    type, assetId: depAssetId, assetName, relation, note,
    createdAt: new Date().toISOString(),
  };
  data.assets[idx].dependencies = [...(data.assets[idx].dependencies || []), dep];
  data.assets[idx].updatedAt = new Date().toISOString();
  saveAssets(data);
  return dep;
}

function removeDependency(assetId, depId) {
  const data = loadAssets();
  const idx = data.assets.findIndex(a => a.id === assetId);
  if (idx < 0) throw new Error(`Asset ${assetId} not found`);
  data.assets[idx].dependencies = (data.assets[idx].dependencies || []).filter(d => d.id !== depId);
  data.assets[idx].updatedAt = new Date().toISOString();
  saveAssets(data);
  return data.assets[idx];
}

/**
 * 获取资产的完整依赖图（向下：此资产依赖了什么；向上：谁依赖了此资产）
 */
function getDependencyGraph(assetId) {
  const { assets } = loadAssets();
  const asset = assets.find(a => a.id === assetId);
  if (!asset) throw new Error(`Asset ${assetId} not found`);

  const downstream = (asset.dependencies || []).map(dep => {
    const target = assets.find(a => a.id === dep.assetId);
    return { ...dep, resolved: target ? { id: target.id, name: target.name, type: target.type, status: target.status } : null };
  });

  const upstream = assets
    .filter(a => (a.dependencies || []).some(d => d.assetId === assetId))
    .map(a => ({
      assetId: a.id, assetName: a.name, type: a.type, status: a.status,
      relation: (a.dependencies || []).find(d => d.assetId === assetId)?.relation,
    }));

  return { assetId, downstream, upstream };
}

// ── 发布工作流 ────────────────────────────────────────────────────────────────

function submitForReview(id) {
  const data = loadAssets();
  const idx = data.assets.findIndex(a => a.id === id);
  if (idx < 0) throw new Error(`Asset ${id} not found`);
  if (data.assets[idx].status !== 'draft') throw new Error(`Asset must be in draft status`);
  data.assets[idx].status = 'pending_review';
  data.assets[idx].updatedAt = new Date().toISOString();
  saveAssets(data);
  return data.assets[idx];
}

function publishAsset(id, publishedBy, note = '') {
  const data = loadAssets();
  const idx = data.assets.findIndex(a => a.id === id);
  if (idx < 0) throw new Error(`Asset ${id} not found`);
  if (!['draft', 'pending_review'].includes(data.assets[idx].status)) {
    throw new Error(`Asset must be in draft or pending_review status to publish`);
  }

  const asset = data.assets[idx];
  const now = new Date().toISOString();

  asset.versionHistory = asset.versionHistory || [];
  asset.versionHistory.push({
    version: asset.version,
    publishedAt: now,
    publishedBy,
    note: note || `发布版本 ${asset.version}`,
    content: asset.content,
    extraFiles: asset.extraFiles || [],
  });

  asset.status = 'published';
  asset.publishedBy = publishedBy;
  asset.publishedAt = now;
  asset.publishedVersion = asset.version;
  asset.publishedContent = asset.content;
  asset.publishedExtraFiles = [...(asset.extraFiles || [])];
  asset.updatedAt = now;

  saveAssets(data);
  return asset;
}

function unpublishAsset(id) {
  const data = loadAssets();
  const idx = data.assets.findIndex(a => a.id === id);
  if (idx < 0) throw new Error(`Asset ${id} not found`);
  if (data.assets[idx].mandatory) throw new Error(`Cannot unpublish mandatory asset`);
  data.assets[idx].status = 'draft';
  data.assets[idx].updatedAt = new Date().toISOString();
  saveAssets(data);
  return data.assets[idx];
}

// ── 可见性查询 ────────────────────────────────────────────────────────────────

/**
 * 返回对某个组织可见的所有已发布资产（该组织 + 祖先组织）
 * 返回的 content / extraFiles 是 published 版本
 */
function getVisibleAssets(orgId, ancestorOrgIds = []) {
  const { assets } = loadAssets();
  const visibleOrgIds = new Set([orgId, ...ancestorOrgIds]);
  return assets
    .filter(a => a.status === 'published' && visibleOrgIds.has(a.orgId))
    .map(a => ({
      ...a,
      content: a.publishedContent || a.content,
      extraFiles: a.publishedExtraFiles || a.extraFiles || [],
    }));
}

module.exports = {
  listAssets,
  getAsset,
  createAsset,
  updateAsset,
  deleteAsset,
  submitForReview,
  publishAsset,
  unpublishAsset,
  getVisibleAssets,
  upsertExtraFile,
  removeExtraFile,
  addDependency,
  removeDependency,
  getDependencyGraph,
  ASSET_TYPES,
  ASSET_STATUSES,
  TYPE_META,
  CONTENT_TEMPLATES,
  EXTRA_FILE_TEMPLATES,
  DEPENDENCY_RELATIONS,
};
