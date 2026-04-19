# 企业集成补充设计：wsd + wsd_manager 深化方案

> 基于"老金"企业实战指南两份飞书文档的深化设计
> 整合：团队协作规范 + 安全合规 + CI/CD + 性能优化
> 日期：2026-04-14

---

## 一、核心设计思路修正

### 1.1 对原有设计的关键补充

从飞书文档中提炼出以下关键洞察，需要补充到 wsd 和 wsd_manager 中：

| 洞察 | 来源 | 影响模块 |
|------|------|---------|
| CLAUDE.md 三层加载（全局/项目/子目录），全部合并 | 老金文档 | wsd + wsd_manager |
| settings.local.json 个人覆盖，不入库 | 老金文档 | wsd_manager 同步策略 |
| Skills 格式：SKILL.md（Markdown + YAML frontmatter，支持热更新）| 老金文档 | wsd 资产格式 |
| modelOverrides 企业端点映射（Bedrock/Azure/内部网关）| 老金文档 | wsd 模型路由 |
| Worktree + sparse checkout 支持大型 Monorepo | 老金文档 | wsd 执行引擎 |
| Git Hooks 集成 Claude 自动审查（pre-commit/commit-msg/pre-push）| 老金文档 | wsd hooks |
| API Key 三级分层（Master/Service/Developer）| 老金文档 | wsd_manager 安全 |
| 审计日志通过 PostToolUse Hook 实现（不是独立配置块）| 老金文档 | wsd_manager 审计 |
| claude-code-action@v1 官方 CI 集成方案 | 老金文档 | wsd_manager CI/CD |
| 成本控制通过 Anthropic Console Spend Limits + 环境变量模型 | 老金文档 | wsd_manager 成本 |

### 1.2 修正的技术认知

❌ 原设计误区 → ✅ 正确做法（来自老金文档验证）：

```
❌ hooks 有独立的 audit 配置块
✅ 审计日志通过 PostToolUse Hook 的 command 写入 .jsonl 文件

❌ settings.development.json / settings.production.json 分环境文件
✅ 三级层次：全局 settings.json + 项目 settings.json + 本地 settings.local.json

❌ MCP 配置有 trust/network/limits 字段
✅ MCP 只有 command, args, env 字段；安全通过 permissions.allow/deny 控制

❌ /sandbox 有独立 CLI 开关
✅ sandbox 在 settings.json 的 filesystem 字段配置，Linux 通过 apply-seccomp

❌ Skills 是独立的 YAML 文件
✅ Skills 是 SKILL.md（Markdown + YAML frontmatter），支持热更新（Hot Reload）
```

---

## 二、wsd 深化设计

### 2.1 配置文件标准（修正）

#### CLAUDE.md 三层结构

```
~/.claude/CLAUDE.md              # 层1：全局（个人偏好，不入库）
    + <project>/CLAUDE.md        # 层2：项目（团队共享，入库）
    + <project>/src/CLAUDE.md    # 层3：子目录（模块规则，按需入库）
= 全部合并加载（按顺序叠加）
```

wsd 插件在初始化时生成标准三层结构：

```markdown
<!-- <project>/CLAUDE.md（由 /wsd:init 生成） -->
# [项目名] WSD 项目配置

## 项目概览
...（由 wsd-analyst 代理根据 proposal 自动生成）

## WSD 需求管理
当前活跃需求：参见 .wsd/STATE.md
需求规格库：参见 .wsd/specs/

## 编码规范（从 wsd_manager 注入）
@.wsd/injected/team-rules.md

## 安全规则
- 禁止硬编码 API Key 和密码
- 所有用户输入必须验证
```

#### settings.json 标准结构

```json
// .claude/settings.json（入库，团队共享）
{
  "model": "claude-sonnet-4-6",
  "modelOverrides": {
    "claude-sonnet-4-6": "${ENTERPRISE_CLAUDE_ENDPOINT}",
    "claude-opus-4-6": "${ENTERPRISE_CLAUDE_OPUS_ENDPOINT}"
  },
  "permissions": {
    "allow": [
      "Read", "Glob", "Grep",
      "Bash(npm test *)", "Bash(npm run lint)",
      "Bash(git diff *)", "Bash(git log *)",
      "Bash(wsdm *)"
    ],
    "deny": [
      "Bash(rm -rf *)", "Bash(sudo *)",
      "Read(.env*)", "Read(**/secrets/**)",
      "Bash(git push --force)"
    ]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{
          "type": "command",
          "command": "node .wsd/hooks/spec-validator.js $CLAUDE_FILE_PATHS"
        }]
      }
    ],
    "Stop": [
      {
        "hooks": [{
          "type": "command",
          "command": "node .wsd/hooks/session-summary.js"
        }]
      }
    ]
  }
}
```

```json
// .claude/settings.local.json（不入库，个人覆盖）
{
  "permissions": {
    "allow": ["Bash(npm run dev)", "Bash(npm run debug)"]
  }
}
```

#### .gitignore 配置

```gitignore
# 入库：团队共享配置
!.claude/
!.claude/settings.json
!.claude/commands/
!.wsd/
!.wsd/requirements/
!.wsd/specs/
!CLAUDE.md

# 不入库：个人配置和运行时
.claude/settings.local.json
.claude/*.local.*
.wsd/workspace/
.wsd/audit/
.env
.env.local
```

### 2.2 Skills 格式规范（SKILL.md）

所有 wsd 技能使用 SKILL.md 格式（支持热更新，无需重启 Claude Code）：

```markdown
<!-- wsd/skills/wsd-lifecycle/SKILL.md -->
---
name: wsd-lifecycle
description: WSD 需求生命周期感知。当用户提到需求、功能、任务、story时自动触发。
context: fork
---

# WSD 生命周期守卫

## 自动触发条件
关键词：需求、功能、story、任务、proposal、spec、实现、交付

## 检查规则

1. **禁止跳阶**：不允许直接从 PROPOSED 跳到 EXECUTE，必须经过 SPEC → REVIEW → PLAN
2. **确认关卡**：每个阶段完成必须等待人工确认后才能进入下一阶段
3. **上下文守卫**：上下文 >60% 时发出警告，>80% 时强制切换到子代理

## 当前状态获取
读取 .wsd/STATE.md 获取当前需求状态。

## 重要提示
- 实现任务 **必须** 在独立子代理中执行（避免上下文污染）
- 代码生成 **必须** 遵循 TDD 模式（先测试后实现）
```

```markdown
<!-- wsd/skills/wsd-context-guard/SKILL.md -->
---
name: wsd-context-guard
description: 监控上下文用量，防止 context rot。所有长时间执行的任务自动触发。
context: fork
---

## 上下文健康标准

| 使用率 | 状态 | 动作 |
|--------|------|------|
| <60%   | 健康 | 继续执行 |
| 60-80% | 警告 | 提示用户，建议切换子代理 |
| >80%   | 危险 | 强制暂停，等待用户确认是否继续 |

## 实现策略（来自 GSD）
- 主代理只做调度（保持 30-40% 上下文占用）
- 实现任务委托给子代理（每个子代理全新 200K token）
- 子代理完成后销毁，结果以 diff 形式返回主代理
```

### 2.3 Git Hooks 集成

wsd 提供标准 Git Hooks 集成，安装后自动触发 Claude 代码审查：

```bash
# .wsd/hooks/pre-commit（由 /wsd:init 安装到 .git/hooks/pre-commit）
#!/bin/bash
set -e

# 检查是否有暂存文件
STAGED_FILES=$(git diff --cached --name-only)
[ -z "$STAGED_FILES" ] && exit 0

# 1. 格式化检查
if command -v prettier &>/dev/null; then
  echo "$STAGED_FILES" | grep -E '\.(ts|tsx|js|jsx)$' | xargs prettier --check 2>/dev/null || true
fi

# 2. 安全扫描：检查是否有 API Key 泄露
SECRETS_PATTERN="(sk-ant-api|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36}|password\s*=\s*['\"][^'\"]{8,})"
if git diff --cached | grep -qE "$SECRETS_PATTERN"; then
  echo "❌ 检测到可能的密钥泄露，提交已阻止"
  echo "请检查暂存文件中的敏感信息"
  exit 1
fi

# 3. wsd 规格验证（检查需求状态是否允许提交）
if [ -f ".wsd/STATE.md" ]; then
  node .wsd/hooks/validate-commit.js || exit 1
fi

echo "✅ pre-commit 检查通过"
```

```bash
# .wsd/hooks/commit-msg（规范化提交消息）
#!/bin/bash
COMMIT_MSG=$(cat "$1")
TYPES="feat|fix|docs|style|refactor|perf|test|chore|build|ci|revert|wsd"

# 检查是否符合 Conventional Commits 规范
if ! echo "$COMMIT_MSG" | grep -qE "^($TYPES)(\(.+\))?: .+"; then
  echo "⚠️  提交信息不符合规范，正在使用 Claude 自动生成..."
  
  DIFF=$(git diff --cached)
  # 调用 wsd 内置的 commit message 生成器
  NEW_MSG=$(node .wsd/scripts/generate-commit-msg.js "$DIFF")
  echo "$NEW_MSG" > "$1"
  echo "✅ 已生成规范提交信息: $NEW_MSG"
fi
```

### 2.4 Worktree 支持（Monorepo 并行开发）

wsd 支持通过 Git Worktree 实现多需求并行开发：

```bash
# /wsd:execute 在 Monorepo 场景下自动使用 Worktree

# 创建需求专属 Worktree
git worktree add .wsd/worktrees/REQ-20260414-001 -b wsd/REQ-20260414-001

# sparse checkout（只检出相关模块）
cd .wsd/worktrees/REQ-20260414-001
git sparse-checkout set packages/user-service packages/shared

# 在独立上下文中执行实现
claude --worktree .wsd/worktrees/REQ-20260414-001
```

wsd 的 `config.json` 支持 Worktree 配置：

```json
// .wsd/config.json
{
  "worktree": {
    "enabled": true,
    "baseDir": ".wsd/worktrees",
    "autoCleanup": true,
    "sparsePaths": {
      "default": ["packages/shared/**", "package.json"],
      "backend": ["packages/api/**", "packages/shared/**"],
      "frontend": ["packages/web/**", "packages/shared/**"]
    }
  }
}
```

### 2.5 CI/CD 集成（claude-code-action@v1）

wsd 提供标准 GitHub Actions 配置：

```yaml
# .wsd/ci/claude-review.yml（由 /wsd:init 生成）
name: WSD Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]
  issue_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  wsd-review:
    name: WSD 代码审查
    if: |
      github.event_name == 'pull_request' ||
      (github.event_name == 'issue_comment' &&
       contains(github.event.comment.body, '@claude'))
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: 获取需求上下文
        id: wsd-context
        run: |
          # 从提交消息中提取关联需求 ID
          REQ_ID=$(git log -1 --format=%s | grep -oE 'REQ-[0-9]{8}-[0-9]{3}' || echo "")
          echo "req_id=$REQ_ID" >> $GITHUB_OUTPUT

      - name: Claude WSD 代码审查
        uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          model: claude-sonnet-4-6
          prompt: |
            请审查本次 PR 代码变更。
            
            关联需求：${{ steps.wsd-context.outputs.req_id }}
            
            审查维度：
            1. 代码是否符合 .wsd/requirements/${{ steps.wsd-context.outputs.req_id }}/specs/ 中的验收标准
            2. 是否有潜在的安全问题（重点检查 API Key、SQL 注入、XSS）
            3. 测试覆盖是否充分（目标 80%+）
            4. 代码质量（函数 <50 行，无深层嵌套，错误显式处理）
            
            输出格式：中文，按严重程度（CRITICAL/HIGH/MEDIUM/LOW）分类。

  wsd-security:
    name: 安全扫描
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Git Secrets 扫描
        run: |
          PATTERNS=(
            "sk-ant-api[0-9]{2}-[a-zA-Z0-9_-]{95,}"
            "AKIA[0-9A-Z]{16}"
            "ghp_[a-zA-Z0-9]{36}"
          )
          for pattern in "${PATTERNS[@]}"; do
            if git diff origin/${{ github.base_ref }}...HEAD | grep -qE "$pattern"; then
              echo "❌ 检测到可能的密钥泄露！"
              exit 1
            fi
          done
          echo "✅ 安全扫描通过"

      - name: 依赖漏洞扫描
        run: |
          if [ -f "package.json" ]; then
            npm audit --audit-level=high
          fi
          if [ -f "requirements.txt" ]; then
            pip install safety && safety check
          fi
```

---

## 三、wsd_manager 深化设计

### 3.1 团队配置仓库标准结构

wsd_manager 维护的企业配置仓库（`wsd-assets-registry`）结构：

```
wsd-assets-registry/                    # 企业 Claude Code 资产 Git 仓库
├── README.md                           # 配置说明文档
├── install.sh                          # 一键安装脚本（Linux/macOS）
├── install.ps1                         # 一键安装脚本（Windows）
├── validate.sh                         # 配置验证脚本
│
├── enterprise/                         # 企业基线（仅 platform-admin 可修改）
│   ├── CLAUDE.md                       # 企业全局指令
│   ├── settings.json                   # 企业基线配置（含 modelOverrides）
│   ├── agents/
│   │   ├── security-reviewer.md        # 企业安全审查代理
│   │   └── compliance-checker.md       # 合规检查代理
│   ├── rules/
│   │   ├── security-baseline.md        # 安全基线规则
│   │   ├── compliance.md               # 合规要求
│   │   └── data-protection.md          # 数据保护规则
│   ├── hooks/
│   │   └── audit-logger.json           # 企业级审计日志 hooks
│   └── mcp/
│       └── enterprise-tools.json       # 企业内部工具 MCP 配置
│
├── departments/                        # 部门层资产
│   ├── backend/
│   │   ├── CLAUDE.md
│   │   ├── agents/
│   │   │   ├── backend-architect.md
│   │   │   └── database-reviewer.md
│   │   └── rules/
│   │       ├── api-design.md
│   │       └── database-patterns.md
│   └── frontend/
│       ├── CLAUDE.md
│       └── rules/
│           ├── component-patterns.md
│           └── performance.md
│
├── teams/                              # 团队层资产
│   ├── payment-team/
│   │   ├── CLAUDE.md
│   │   ├── settings.json               # 团队配置（含 hooks）
│   │   ├── agents/
│   │   │   └── payment-security.md     # 支付安全审查代理
│   │   ├── skills/
│   │   │   └── pci-dss-check/
│   │   │       └── SKILL.md            # PCI-DSS 合规检查技能
│   │   └── hooks/
│   │       └── payment-hooks.json      # 支付相关 hooks
│   └── user-team/
│       └── ...
│
└── index.json                          # 全量资产索引（供快速检索）
```

### 3.2 一键安装脚本（install.sh）

wsd_manager 生成的企业配置安装脚本：

```bash
#!/bin/bash
# wsd_manager 生成的团队配置安装脚本
# 用法: ./install.sh [--user=weizhen] [--team=payment-team] [--repo=payment-service]

set -e

WSDM_SERVER="${WSDM_SERVER:-https://wsd-manager.internal.company.com}"
WSDM_TOKEN="${WSDM_TOKEN}"
USER_ID="${1#--user=}"
TEAM_ID="${2#--team=}"
REPO_ID="${3#--repo=}"

# 检测操作系统
detect_os() {
  case "$OSTYPE" in
    linux*)  OS="linux" ;;
    darwin*) OS="macos" ;;
    msys*|cygwin*) OS="windows" ;;
    *) echo "Unsupported OS: $OSTYPE"; exit 1 ;;
  esac
}

# 备份现有配置
backup_config() {
  BACKUP_DIR="$HOME/.claude-backup-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$BACKUP_DIR"
  [ -d "$HOME/.claude" ] && cp -r "$HOME/.claude" "$BACKUP_DIR/"
  [ -f ".claude/settings.json" ] && cp ".claude/settings.json" "$BACKUP_DIR/project-settings.json"
  echo "✅ 已备份现有配置到 $BACKUP_DIR"
}

# 从 wsd_manager 拉取并安装资产
install_assets() {
  echo "📦 正在从 wsd_manager 获取资产..."
  
  # 调用 wsdm CLI 解析并同步资产
  wsdm sync \
    --user="$USER_ID" \
    --team="$TEAM_ID" \
    --repo="$REPO_ID" \
    --server="$WSDM_SERVER" \
    --token="$WSDM_TOKEN"
  
  echo "✅ 资产安装完成"
}

# 安装 Git Hooks
install_git_hooks() {
  if [ -d ".git" ]; then
    echo "🔧 安装 Git Hooks..."
    cp .wsd/hooks/pre-commit .git/hooks/pre-commit
    cp .wsd/hooks/commit-msg .git/hooks/commit-msg
    chmod +x .git/hooks/pre-commit .git/hooks/commit-msg
    echo "✅ Git Hooks 安装完成"
  fi
}

# 验证安装结果
validate_install() {
  echo "🔍 验证安装..."
  claude config list | grep -q "model" && echo "✅ Claude Code 配置正常"
  wsdm asset list --layer=team 2>/dev/null | head -5
  echo "✅ 验证完成，可以开始使用"
}

# 主流程
main() {
  echo "================================================"
  echo "  WSD 企业配置安装工具"
  echo "  用户: $USER_ID | 团队: $TEAM_ID | 仓库: $REPO_ID"
  echo "================================================"
  
  detect_os
  backup_config
  install_assets
  install_git_hooks
  validate_install
  
  echo ""
  echo "🎉 安装完成！运行 /wsd:status 查看当前需求状态"
}

main
```

### 3.3 API Key 安全管理（企业级）

#### 三级密钥分层

```
企业密钥层级体系：

Production Keys (生产环境)
├── Master Key              # CTO/CIO 持有，2FA + 硬件密钥
├── Service Keys            # 各微服务独立密钥，10,000 RPM 限制
│   ├── wsd-manager-key     # wsd_manager 专用密钥
│   └── ci-cd-key           # CI/CD 专用密钥
└── Developer Keys          # 团队共享，每周轮换，100 RPM 限制

Staging Keys (预发布)      # 独立密钥，与生产完全隔离

Development Keys (开发)    # 个人密钥，50 RPM 限制
```

#### wsd_manager 密钥管理模块

```typescript
// wsd_manager/core/security/key-manager.ts

import { SecretsManager } from '@aws-sdk/client-secrets-manager';
// 或使用 HashiCorp Vault
import Vault from 'node-vault';

export class EnterpriseKeyManager {
  // 从 Secrets Manager 获取 API Key
  async getApiKey(environment: 'production' | 'staging' | 'development'): Promise<string> {
    if (process.env.NODE_ENV === 'development' && process.env.ANTHROPIC_API_KEY) {
      return process.env.ANTHROPIC_API_KEY;  // 开发环境用环境变量
    }
    
    const secretName = `${environment}/anthropic/api-key`;
    const client = new SecretsManager({ region: process.env.AWS_REGION });
    const response = await client.getSecretValue({ SecretId: secretName });
    return response.SecretString!;
  }

  // 密钥轮换（90天自动触发）
  async rotateKey(serviceId: string): Promise<void> {
    const oldKey = await this.getApiKey('production');
    
    // 1. 生成新密钥（通过 Anthropic API）
    // 2. 存储到 Secrets Manager
    // 3. 更新所有使用旧密钥的服务（滚动更新）
    // 4. 验证新密钥可用
    // 5. 撤销旧密钥
    // 6. 发送通知
  }
}
```

#### Git Secrets 扫描（集成到 wsd_manager CI）

```typescript
// wsd_manager/core/security/secrets-scanner.ts

const SECRET_PATTERNS = {
  anthropic_api_key: /sk-ant-api[0-9]{2}-[a-zA-Z0-9_-]{95,}/g,
  aws_access_key: /AKIA[0-9A-Z]{16}/g,
  aws_secret_key: /[0-9a-zA-Z/+=]{40}/g,
  github_token: /ghp_[a-zA-Z0-9]{36}/g,
  openai_api_key: /sk-[a-zA-Z0-9]{48}/g,
  private_key: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  password_hardcode: /password\s*[=:]\s*['"][^'"]{8,}['"]/gi,
};

export class SecretsScanner {
  scan(content: string): ScanResult[] {
    const findings: ScanResult[] = [];
    
    for (const [type, pattern] of Object.entries(SECRET_PATTERNS)) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        findings.push({
          type,
          severity: 'CRITICAL',
          match: match[0].slice(0, 10) + '***',
          position: match.index!,
        });
      }
    }
    
    return findings;
  }

  // 扫描资产内容（在资产上传时自动触发）
  async scanAsset(asset: AssetMeta): Promise<void> {
    const findings = this.scan(asset.content);
    if (findings.length > 0) {
      throw new SecurityViolationError(
        `资产 ${asset.name} 包含可能的密钥泄露：${findings.map(f => f.type).join(', ')}`
      );
    }
  }
}
```

### 3.4 审计日志实现（基于 Hooks）

根据老金文档的技术验证，审计日志通过 PostToolUse Hook 实现：

```json
// enterprise/hooks/audit-logger.json（企业层 hooks 配置）
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{
          "type": "command",
          "command": "node ~/.claude/enterprise/hooks/audit-log.js bash '$CLAUDE_TOOL_INPUT' '$CLAUDE_TOOL_EXIT_CODE'"
        }]
      },
      {
        "matcher": "Write|Edit",
        "hooks": [{
          "type": "command",
          "command": "node ~/.claude/enterprise/hooks/audit-log.js file '$CLAUDE_FILE_PATHS' 'write'"
        }]
      },
      {
        "matcher": "mcp__*",
        "hooks": [{
          "type": "command",
          "command": "node ~/.claude/enterprise/hooks/audit-log.js mcp '$CLAUDE_TOOL_NAME' ''"
        }]
      }
    ]
  }
}
```

```javascript
// enterprise/hooks/audit-log.js
const fs = require('fs');
const path = require('path');
const os = require('os');

const [,, toolType, detail, extra] = process.argv;
const logDir = path.join(os.homedir(), '.wsd', 'audit');
fs.mkdirSync(logDir, { recursive: true });

const today = new Date().toISOString().split('T')[0];
const logFile = path.join(logDir, `${today}.jsonl`);

const entry = {
  timestamp: new Date().toISOString(),
  user: process.env.USER || process.env.USERNAME,
  machine: os.hostname(),
  tool: toolType,
  detail: detail?.replace(/password\s*[=:]\s*['"][^'"]+['"]/gi, 'password=***'),  // 脱敏
  extra,
  workingDir: process.cwd(),
};

fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
```

### 3.5 modelOverrides 企业端点映射

wsd_manager 在生成团队配置时，自动注入 `modelOverrides`：

```json
// enterprise/settings.json（企业基线，由 wsd_manager 维护）
{
  "model": "claude-sonnet-4-6",
  "modelOverrides": {
    "claude-sonnet-4-6": "${ENTERPRISE_CLAUDE_SONNET_ENDPOINT}",
    "claude-opus-4-6":   "${ENTERPRISE_CLAUDE_OPUS_ENDPOINT}",
    "claude-haiku-4-5":  "${ENTERPRISE_CLAUDE_HAIKU_ENDPOINT}"
  }
}
```

环境变量支持三种企业场景：
```bash
# 场景1：AWS Bedrock
export ENTERPRISE_CLAUDE_SONNET_ENDPOINT="arn:aws:bedrock:us-east-1:123456789:model/anthropic.claude-sonnet-4-6-v2"

# 场景2：Azure OpenAI Service
export ENTERPRISE_CLAUDE_SONNET_ENDPOINT="your-azure-deployment-sonnet"

# 场景3：企业内部 API 网关（适配内部模型）
export ENTERPRISE_CLAUDE_SONNET_ENDPOINT="https://api-gateway.internal.company.com/claude/sonnet"
```

### 3.6 使用统计与成本控制

#### 数据模型

```typescript
// 每次 API 调用的使用记录
interface UsageRecord {
  timestamp: string;
  userId: string;
  teamId: string;
  repoId: string;
  reqId?: string;          // 关联的 wsd 需求 ID
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cost: number;            // 美元
  tool: string;            // 触发工具（wsd-executor/code-reviewer 等）
  duration: number;        // 毫秒
}
```

#### 成本计算（含 Prompt Caching）

```typescript
// wsd_manager/core/metrics/cost-calculator.ts

const PRICING = {
  'claude-sonnet-4-6': {
    input: 3.0,          // $3.0 / 百万 tokens
    output: 15.0,        // $15.0 / 百万 tokens
    cacheWrite: 3.75,    // $3.75 / 百万 tokens（缓存写入 1.25x）
    cacheRead: 0.30,     // $0.30 / 百万 tokens（缓存读取 0.1x，节省 90%）
  },
  'claude-opus-4-6': {
    input: 5.0,
    output: 25.0,
    cacheWrite: 6.25,
    cacheRead: 0.50,
  },
  'claude-haiku-4-5': {
    input: 1.0,
    output: 5.0,
    cacheWrite: 1.25,
    cacheRead: 0.10,
  },
};

export function calculateCost(usage: UsageRecord): number {
  const prices = PRICING[usage.model] || PRICING['claude-sonnet-4-6'];
  return (
    (usage.inputTokens / 1_000_000 * prices.input) +
    (usage.outputTokens / 1_000_000 * prices.output) +
    ((usage.cacheReadTokens || 0) / 1_000_000 * prices.cacheRead)
  );
}
```

#### 成本控制策略

```json
// wsd_manager 的成本控制配置（teams/<team-id>/settings.json）
{
  "costControl": {
    "monthlyBudget": 500,         // 美元/月（在 Anthropic Console 设置 Spend Limits）
    "alertThreshold": 0.8,        // 80% 时告警
    "modelPolicy": {
      "default": "claude-haiku-4-5",    // 默认用最便宜的
      "codeReview": "claude-sonnet-4-6",
      "architecture": "claude-opus-4-6"
    }
  }
}
```

### 3.7 合规与安全审计

#### 企业合规检查清单（自动化）

```typescript
// wsd_manager/core/compliance/checker.ts

export class ComplianceChecker {
  // GDPR/数据保护检查
  async checkDataProtection(assets: AssetMeta[]): Promise<ComplianceReport> {
    const issues: ComplianceIssue[] = [];
    
    for (const asset of assets) {
      // 检查是否有 PII 数据硬编码
      if (/\b[\w.-]+@[\w.-]+\.\w+\b/.test(asset.content)) {
        issues.push({ severity: 'HIGH', type: 'PII_EMAIL', asset: asset.name });
      }
      
      // 检查是否有密钥泄露
      const secretFindings = await this.secretsScanner.scan(asset.content);
      issues.push(...secretFindings.map(f => ({
        severity: 'CRITICAL' as const,
        type: 'SECRET_LEAK',
        asset: asset.name,
        detail: f.type,
      })));
    }
    
    return {
      passed: issues.filter(i => i.severity === 'CRITICAL').length === 0,
      issues,
      generatedAt: new Date().toISOString(),
    };
  }

  // SOC 2 最小权限检查
  async checkLeastPrivilege(settings: ClaudeSettings): Promise<ComplianceReport> {
    const issues: ComplianceIssue[] = [];
    
    // 检查是否有过于宽松的权限
    if (settings.permissions?.allow?.includes('Bash(*)')) {
      issues.push({
        severity: 'HIGH',
        type: 'OVERLY_PERMISSIVE',
        detail: 'Bash(*) 允许所有命令，违反最小权限原则',
      });
    }
    
    // 检查是否缺少必要的 deny 规则
    const requiredDeny = ['Bash(rm -rf *)', 'Bash(sudo *)', 'Read(.env*)'];
    for (const deny of requiredDeny) {
      if (!settings.permissions?.deny?.includes(deny)) {
        issues.push({
          severity: 'MEDIUM',
          type: 'MISSING_DENY_RULE',
          detail: `缺少安全 deny 规则: ${deny}`,
        });
      }
    }
    
    return { passed: issues.length === 0, issues };
  }
}
```

### 3.8 新人入职自动化流程

wsd_manager 提供一键式新人入职：

```bash
# 新人入职命令（由 HR/IT 分配后，工程师自行执行）
wsdm onboard \
  --user=weizhen \
  --dept=backend \
  --team=payment-team \
  --repo=payment-service

# 执行效果：
# ✅ 1. 从企业目录服务获取用户信息
# ✅ 2. 创建个人 wsdm 配置 (~/.wsdm/config.yaml)
# ✅ 3. 拉取并安装企业基线资产 (~/.claude/)
# ✅ 4. 拉取并安装部门/团队资产 (~/.claude/ 覆盖)
# ✅ 5. 为指定仓库安装项目资产 (.claude/)
# ✅ 6. 安装 Git Hooks
# ✅ 7. 配置 modelOverrides（企业端点）
# ✅ 8. 验证配置完整性
# ✅ 9. 发送入职完成通知（飞书/Slack）
# 
# 预计耗时：3-5 分钟（vs 原来手动配置 2 小时）
```

---

## 四、wsd + wsd_manager 完整联动流程

### 4.1 典型工作日流程

```
09:00 工程师打开终端
  └→ wsdm sync（自动同步最新团队资产）
  
09:05 进入项目目录，启动 Claude Code
  └→ session-inject.py hook 自动触发
  └→ 读取 .wsd/STATE.md 注入当前需求状态
  └→ CLAUDE.md（三层合并）加载完成
  
09:10 收到 Jira/飞书需求
  └→ /wsd:propose "支持支付宝扫码支付"
  └→ wsd-analyst 代理启动深度访谈（3-5 轮）
  └→ 生成 proposal.md，上报 wsd_manager
  
09:30 确认规格
  └→ /wsd:spec
  └→ 生成 specs/（GIVEN/WHEN/THEN 格式）
  └→ 等待技术 Leader 确认（飞书通知）
  
10:00 技术 Leader 通过飞书 Bot 确认规格
  └→ wsd_manager 接收确认事件
  └→ 状态变更为 SPEC_APPROVED
  
10:05 生成执行计划
  └→ /wsd:plan
  └→ 生成 tasks.md（原子任务，≤2h/个）
  └→ 等待确认
  
10:20 开始实现
  └→ /wsd:execute
  └→ Worktree 创建（如 Monorepo 场景）
  └→ 子代理循环执行（每个任务独立 200K token）
  └→ 每个任务：TDD（先测试）→ 实现 → diff 返回主代理
  └→ 上下文守卫监控（>80% 强制暂停）
  
14:00 实现完成，自动触发验收
  └→ /wsd:verify（子代理对照规格验收）
  └→ 生成 verification.md（PASS）
  └→ 飞书通知 PM/QA 进行最终确认
  
14:30 PM 通过飞书 Bot 确认交付
  └→ /wsd:archive（自动归档）
  └→ 规格合并到 .wsd/specs/
  └→ wsd_manager 更新统计：
      - 需求周期：5.5h
      - Token 消耗：38,000
      - 测试覆盖：86%
  └→ Jira/飞书 Issue 自动关闭

16:00 提交代码
  └→ git commit（pre-commit hook 触发）
  └→ Claude 自动扫描：密钥泄露检查 + 格式化
  └→ 提交信息自动规范化（Conventional Commits）
  └→ 推送，PR 自动触发 GitHub Actions
  └→ claude-code-action@v1 执行代码审查
  └→ 审查结果以评论形式发布到 PR
```

### 4.2 数据流全景图

```
用户操作
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│                    Claude Code 运行时                         │
│                                                              │
│  CLAUDE.md（三层合并）   .claude/settings.json               │
│  wsd/skills/*.SKILL.md   wsd/agents/*.md                    │
│              │                      │                        │
│              └──────┬───────────────┘                        │
│                     │                                        │
│              ┌──────▼──────┐                                 │
│              │  wsd 命令    │                                 │
│              │ /wsd:propose │                                 │
│              │ /wsd:execute │                                 │
│              └──────┬──────┘                                 │
│                     │                                        │
│        ┌────────────┼────────────┐                           │
│        │            │            │                           │
│   子代理1        子代理2        子代理3                        │
│   (analyst)    (executor)    (verifier)                      │
│   200K ctx     200K ctx      200K ctx                        │
└────────────────────────────────────────────────────────────── ┘
    │                 │                  │
    ▼                 ▼                  ▼
.wsd/requirements/  代码变更          .wsd/audit/
proposal.md         + 测试             *.jsonl
specs/*.md          (via git)
tasks.md                               │
verification.md                        │
                                       ▼
                               ┌───────────────┐
                               │  wsd_manager   │
                               │  (后端服务)     │
                               └───────┬───────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    ▼                  ▼                  ▼
              资产注册表           使用统计            飞书/Jira
              (Git Registry)      (PostgreSQL)         通知推送
```

---

## 五、开源项目价值最终整合矩阵

| 能力点 | 来源 | 集成到 wsd | 集成到 wsd_manager |
|--------|------|-----------|-------------------|
| 需求规格生命周期 | OpenSpec | ✅ 核心工作流 | — |
| 阶段驱动执行 | GSD | ✅ execute 引擎 | — |
| 上下文守卫 | GSD hooks | ✅ context-guard skill | — |
| 工作区/里程碑管理 | GSD sdk | ✅ .wsd/ 目录结构 | ✅ 项目层资产 |
| 子代理驱动开发(SDD) | Superpowers | ✅ executor 代理 | — |
| 技能自动触发 | Superpowers | ✅ SKILL.md 格式 | ✅ 团队技能分发 |
| 规格自动注入 | Trellis | ✅ session-inject hook | — |
| 个人工作区日志 | Trellis | ✅ .wsd/workspace/ | — |
| 资产格式标准 | ECC | ✅ 统一格式 | ✅ 注册表格式 |
| 企业控制 | ECC enterprise/ | — | ✅ 企业层管控 |
| 插件市场 | ECC plugins/ | — | ✅ 内部市场 |
| 多代理团队编排 | OMC team | ✅ 并行子代理 | — |
| 模型路由 | OMC model-routing | ✅ modelRouting | ✅ modelOverrides |
| 深度需求访谈 | OMC deep-interview | ✅ wsd-analyst 代理 | — |
| 统一配置仓库 | 老金文档 | — | ✅ wsd-assets-registry |
| 一键安装脚本 | 老金文档 | — | ✅ install.sh |
| Git Hooks 集成 | 老金文档 | ✅ pre-commit/commit-msg | ✅ 钩子分发 |
| API Key 分级管理 | 老金文档 | — | ✅ 三级密钥体系 |
| Git Secrets 扫描 | 老金文档 | ✅ pre-commit 扫描 | ✅ 资产上传扫描 |
| claude-code-action CI | 老金文档 | ✅ CI 模板 | ✅ CI 标准化 |
| GDPR/SOC2 合规 | 老金文档 | — | ✅ 合规检查器 |
| 成本监控 | 老金文档 | — | ✅ 使用统计 + 成本 |
| modelOverrides 企业端点 | 老金文档 | ✅ 模型路由 | ✅ 统一端点配置 |
| Worktree + sparse checkout | 老金文档 | ✅ Monorepo 支持 | — |
| 审计日志（PostToolUse Hook）| 老金文档 | ✅ audit-logger hook | ✅ 企业级日志分析 |
| settings.local.json 个人覆盖 | 老金文档 | ✅ 标准配置结构 | ✅ 个人层资产 |
| SKILL.md 热更新 | 老金文档 | ✅ 所有技能格式 | ✅ 热发布资产 |
