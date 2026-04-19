# WSD Enterprise — 企业级 AI Coding 一站式交付框架

> 基于 Claude Code 生态，打通从"一句需求"到"可验证交付"的完整链路

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Compatible-blue)](https://claude.ai/code)

---

## 项目简介

**WSD Enterprise** 是一个面向企业团队的 AI 编码交付框架，解决团队在引入 AI 编码后面临的三个核心问题：

| 问题 | 现象 | WSD 解法 |
|------|------|---------|
| **规格漂移** | AI 写的代码与业务需求逐渐偏离 | Spec-First：实现前必须有规格约束 |
| **Context Rot** | 会话越长质量越差 | Context Isolation：每任务独立子代理 |
| **不可验证交付** | 说"做完了"但没人能快速验证 | Human Gates：每阶段人工确认关卡 |

---

## 项目结构

```
wsd-enterprise/
├── wsd/                    ← Claude Code 插件（核心）
│   ├── commands/           ← 22 个斜杠命令
│   ├── agents/             ← 6 个专用子代理
│   ├── skills/             ← 4 个自动触发技能
│   ├── hooks/              ← 9 个自动化钩子（含 AI 编码统计）
│   ├── schemas/            ← JSON Schema 定义
│   ├── templates/          ← 配置模板
│   └── install.sh          ← 一键安装脚本
├── wsd_manager/            ← 企业级资产管理平台
│   ├── cli/wsdm.js         ← wsdm CLI 工具
│   ├── registry/           ← 企业/部门/团队四层资产体系
│   └── README.md
├── docs/                   ← 文档体系
│   ├── USAGE.md            ← 完整使用指南（10 个场景案例）
│   ├── DESIGN.md           ← 系统设计文档
│   └── ROADMAP.md          ← 建设规划路线图
├── docker-compose.yml      ← 一键部署
└── INDEX.md                ← 项目多层索引
```

---

## 快速开始

### 安装 wsd 插件

```bash
# 克隆项目
git clone git@github.com:WeiAugust/wsd-enterprise.git
cd wsd-enterprise

# 进入你的业务项目目录
cd /path/to/your/project

# 安装 wsd 到当前项目
/path/to/wsd-enterprise/wsd/install.sh --init-project

# 或安装到全局
/path/to/wsd-enterprise/wsd/install.sh --global
```

### 第一个需求

```
# 在 Claude Code 中
/wsd:propose 实现用户登录功能，支持邮箱+密码和 Google OAuth
/wsd:status
```

---

## 核心功能

### wsd — 需求生命周期管理

完整的需求状态机，每个阶段有对应命令和子代理：

```
PROPOSED → SPECCING → SPEC_APPROVED
         → PLANNING → PLAN_APPROVED
         → EXECUTING → IMPLEMENTED
         → VERIFYING → DONE
         → ARCHIVED
```

**主流程命令：**

| 命令 | 说明 |
|------|------|
| `/wsd:propose <描述>` | 创建需求（深度访谈澄清） |
| `/wsd:spec [req-id]` | 生成 BDD 规格文档 |
| `/wsd:review [req-id]` | 生成技术方案 |
| `/wsd:plan [req-id]` | 拆解实现任务（≤2h/任务） |
| `/wsd:execute [req-id]` | 驱动分阶段代码实现 |
| `/wsd:verify [req-id]` | 执行验收检查 |
| `/wsd:archive [req-id]` | 归档并生成交付报告 |

**快速通道：**

| 命令 | 说明 |
|------|------|
| `/wsd:quickfix <描述>` | 小改动（≤5文件，跳过规格） |
| `/wsd:hotfix <描述>` | 生产紧急修复（最简流程） |
| `/wsd:stats [req-id]` | 查看 AI 编码统计报告 |

### AI 编码统计

wsd 内置双路采集系统，无论是否使用 `/wsd:execute`，都能精确统计：

- **AI 编码行数**：PostToolUse hook 记录每次 Write/Edit
- **AI 代码接受率**：git post-commit hook 比对快照与提交内容
- **AI 编码占比**：`git diff` 统计总变更行数对比
- **Token 消耗**：自动关联需求 ID 累计统计

```bash
/wsd:stats REQ-001          # 单个需求统计
/wsd:stats --all            # 所有需求汇总
```

### wsd_manager — 企业资产管理平台

**四层资产继承模型：**

```
企业基线（enterprise/）
    └── 部门规范（departments/frontend/）
            └── 团队资产（teams/payment/）
                    └── 个人项目（project/.claude/）
```

**wsdm CLI：**

```bash
wsdm sync              # 拉取最新企业资产到本地项目
wsdm list agents       # 列出可用代理
wsdm publish           # 发布团队资产到注册中心
wsdm teams             # 管理团队配置
```

---

## 场景案例

详见 [docs/USAGE.md](docs/USAGE.md)，涵盖 10 个典型场景：

1. 标准需求全生命周期
2. 紧急快速修复（quickfix）
3. 生产热修复（hotfix）
4. 需求变更分级处理（M0-M4）
5. 验收阶段 Bug 修复
6. 从 Jira/飞书导入需求
7. 多仓库协同开发
8. 阻塞与解除阻塞
9. 不使用 wsd-executor 的 git-only 工作流
10. 团队资产发布与同步

---

## 技术架构

- **Claude Code 插件体系**：commands / agents / skills / hooks / schemas 完整规范
- **六大开源项目精华集成**：ECC、GSD、Superpowers、Trellis、OpenSpec、OMC
- **本地优先**：所有状态存储在 `.wsd/`，无需额外服务即可使用
- **渐进增强**：单人可用 → 团队协作 → 企业管控，按需启用

---

## 文档

| 文档 | 内容 |
|------|------|
| [docs/USAGE.md](docs/USAGE.md) | 完整使用指南 + 场景案例集 |
| [docs/DESIGN.md](docs/DESIGN.md) | 系统设计文档（wsd + wsd_manager + 联动机制） |
| [docs/ROADMAP.md](docs/ROADMAP.md) | 建设规划路线图（Phase 1-4） |
| [INDEX.md](INDEX.md) | 项目多层索引 |

---

## 参考项目

本项目整合以下优秀开源项目的设计理念：

| 项目 | 核心贡献 |
|------|---------|
| [Everything Claude Code](reference_projects/everything-claude-code/) | 资产标准格式、插件市场体系 |
| [Get Shit Done](reference_projects/get-shit-done/) | 阶段驱动执行、上下文守卫 |
| [Superpowers](reference_projects/superpowers/) | 技能自动触发、子代理驱动开发 |
| [Trellis](reference_projects/Trellis/) | 规格自动注入、多平台适配 |
| [OpenSpec](reference_projects/OpenSpec/) | 需求变更生命周期管理 |
| [Oh My ClaudeCode](reference_projects/oh-my-claudecode/) | 多代理团队编排、模型路由 |

---

## License

MIT
