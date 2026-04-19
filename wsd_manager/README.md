# wsd_manager — 企业级 Claude Code 资产管理平台

> 企业/部门/团队/仓库/个人 五层资产管理，统一分发 agents/skills/commands/hooks/rules

## 核心功能

| 功能 | 说明 |
|------|------|
| **资产注册中心** | 管理所有层级的 Claude Code 资产（agent/skill/command/hook/rule） |
| **层级继承解析** | 自动计算资产的有效值（企业→部门→团队→仓库→个人，下层覆盖上层） |
| **一键同步** | `wsdm sync` 将有效资产同步到开发者的 `~/.claude/` 和 `.claude/` |
| **插件市场** | 内部插件市场，打包分发资产集合 |
| **Web 控制台** | 浏览器端管理界面，资产管理 + 需求看板 + 使用分析 |
| **审计追踪** | 资产变更历史、使用统计、合规报告 |

## 快速开始

```bash
# 安装 CLI
npm install -g wsdm
# 或
yarn global add wsdm

# 登录企业服务器
wsdm login https://wsd-manager.company.com

# 同步资产到当前开发环境
wsdm sync --team backend-team

# 查看可用资产
wsdm list --type agent
wsdm list --type skill --layer team
```

## 目录结构

```
wsd_manager/
├── cli/               # wsdm CLI 工具（Node.js + Commander.js）
├── registry/          # 资产注册中心（Git 仓库结构）
│   ├── enterprise/    # 企业基线资产
│   ├── departments/   # 部门资产
│   └── teams/         # 团队资产
└── docs/              # 平台文档
```

## 参考设计

- `docs/wsd-manager-design.md` — 完整平台设计文档
- `docs/enterprise-integration-design.md` — 企业集成最佳实践

## 五层资产继承

```
Enterprise（基线）
    ↓ 部门覆盖/扩展
Department
    ↓ 团队覆盖/扩展
Team
    ↓ 仓库覆盖/扩展
Repository (.claude/)
    ↓ 个人覆盖
Individual (~/.claude/)
```

**规则**：
- Agent/Skill/Command：下层同名资产覆盖上层
- Hook：所有层级累加执行（不覆盖）
- CLAUDE.md：所有层级合并（按层级顺序追加）
- Rules：同名文件下层覆盖，不同名全部加载

## wsdm CLI 主要命令

```bash
# 资产管理
wsdm list [--type <type>] [--layer <layer>]
wsdm show <asset-name> [--type <type>]
wsdm publish <file> --layer <layer> --type <type>
wsdm promote <asset-name> --from team --to department

# 环境同步
wsdm sync [--team <team>] [--repo <repo>] [--dry-run]
wsdm diff                    # 查看本地与远程差异

# 团队管理
wsdm teams list
wsdm teams create <name>
wsdm teams add-member <team> <user>

# 需求管理（与 wsd 联动）
wsdm reqs list [--team <team>] [--status <status>]
wsdm reqs show <req-id>

# 审计
wsdm audit --days 7
wsdm audit --type asset-publish --user weizhen
```
