# WSD All — 项目整体规划文档

> 企业级 AI Coding 一站式交付框架
> 最后更新：2026-04-15

---

## 一、项目目标

构建一套基于 Claude Code 的**企业级 AI Coding 需求一站式交付框架**，包含两个核心产品：

| 产品 | 定位 | 面向对象 |
|------|------|----------|
| **wsd** | Claude Code 插件，管理需求从提案到归档的完整生命周期 | 开发团队（在项目目录使用） |
| **wsd_manager** | 企业级资产管理平台，管理 Claude Code 全量资产的分发与治理 | 平台/基础设施团队（管理多个团队） |

**整合的六大开源项目**：
- [ECC (Everything Claude Code)](../reference_projects/everything-claude-code/) — 资产标准格式、插件市场体系
- [GSD (Get Shit Done)](../reference_projects/get-shit-done/) — 阶段驱动执行、上下文守卫
- [Superpowers](../reference_projects/superpowers/) — 技能自动触发、SDD 子代理模式
- [Trellis](../reference_projects/Trellis/) — 规格自动注入、跨平台适配
- [OpenSpec](../reference_projects/OpenSpec/) — 需求变更生命周期管理
- [OMC (Oh My ClaudeCode)](../reference_projects/oh-my-claudecode/) — 多代理团队编排

---

## 二、已完成功能

### 2.1 设计文档层（全部完成）

| 文档 | 路径 | 状态 |
|------|------|------|
| 开源项目资产分析 | `docs/claude-code-assets-analysis.md` | ✅ 完成 |
| wsd 插件完整设计 | `docs/wsd-design.md` | ✅ 完成 |
| wsd_manager 平台设计 | `docs/wsd-manager-design.md` | ✅ 完成 |
| 企业生态集成设计 | `docs/enterprise-integration-design.md` | ✅ 完成 |
| 项目总索引 | `INDEX.md` | ✅ 完成 |

### 2.2 wsd 插件层（资产文件已创建）

#### 命令（Commands）— 19 个

| 命令文件 | 功能 | 状态 |
|---------|------|------|
| `wsd-propose.md` | 需求提案（深度访谈） | ✅ 完成 |
| `wsd-spec.md` | BDD 规格生成 | ✅ 完成 |
| `wsd-plan.md` | 任务拆解（≤2h/任务） | ✅ 完成 |
| `wsd-execute.md` | 分阶段实现（子代理隔离） | ✅ 完成 |
| `wsd-verify.md` | 验收核查 | ✅ 完成 |
| `wsd-status.md` | 需求看板 | ✅ 完成 |
| `wsd-archive.md` | 归档已完成需求 | ✅ 完成 |
| `wsd-import.md` | 从 Jira/飞书/GitHub 导入 | ✅ 完成 |
| `wsd-block.md` | 标记阻塞 | ✅ 完成 |
| `wsd-unblock.md` | 解除阻塞 | ✅ 完成 |
| `wsd-rollback.md` | 回退阶段 | ✅ 完成 |
| `wsd-show.md` | 需求详情展示 | ✅ 完成 |
| `wsd-list.md` | 需求列表（支持过滤） | ✅ 完成 |
| `wsd-review.md` | 技术方案生成 | ✅ 完成 |
| `wsd-quickfix.md` | 小改动快速通道 | ✅ 完成 |
| `wsd-amend.md` | 需求变更（自动分级 M0-M4） | ✅ 完成 |
| `wsd-hotfix.md` | 生产紧急修复 | ✅ 完成 |
| `wsd-bugfix.md` | 验收阶段 Bug 修复 | ✅ 完成 |
| `wsd-cancel.md` | 取消需求 | ✅ 完成 |

#### 专用代理（Agents）— 6 个

| 代理文件 | 模型 | 职责 | 状态 |
|---------|------|------|------|
| `wsd-analyst.md` | opus | 需求澄清、规格生成 | ✅ 完成 |
| `wsd-architect.md` | opus | 技术方案设计 | ✅ 完成 |
| `wsd-planner.md` | sonnet | 任务拆解 | ✅ 完成 |
| `wsd-executor.md` | sonnet | 代码实现（隔离执行） | ✅ 完成 |
| `wsd-reviewer.md` | sonnet | 代码审查 | ✅ 完成 |
| `wsd-verifier.md` | sonnet | 验收核查、bug 分类 | ✅ 完成 |

#### 技能（Skills）— 4 个

| 技能文件 | 触发方式 | 职责 | 状态 |
|---------|---------|------|------|
| `wsd-lifecycle.md` | 始终 | 生命周期感知与状态引导 | ✅ 完成 |
| `wsd-context-guard.md` | 自动 | 上下文用量监控与警告 | ✅ 完成 |
| `wsd-spec-writing.md` | 按需 | BDD 规格编写指南 | ✅ 完成 |
| `wsd-deep-interview.md` | 按需 | 需求深度访谈技巧 | ✅ 完成 |

#### 行为基线

| 文件 | 状态 |
|------|------|
| `wsd/CLAUDE.md` | ✅ 完成（包含完整状态机、命令列表、场景决策树） |

#### 补充文档

| 文件 | 状态 |
|------|------|
| `wsd/docs/enterprise-integration.md` | ✅ 完成 |
| `wsd/docs/multi-repo.md` | ✅ 完成（多仓库 / 前后端分离场景） |
| `wsd/README.md` | ✅ 完成 |

---

## 三、待完成功能

### 3.1 wsd 插件层

#### Hooks（自动化钩子）— ✅ 全部完成

| 钩子文件 | 类型 | 状态 |
|---------|------|------|
| `wsd/hooks/lifecycle-guard.js` | PreToolUse | ✅ 完成 |
| `wsd/hooks/context-monitor.js` | PostToolUse | ✅ 完成 |
| `wsd/hooks/audit-logger.js` | PostToolUse | ✅ 完成 |
| `wsd/hooks/session-inject.py` | UserPromptSubmit | ✅ 完成 |
| `wsd/hooks/statusline.sh` | statusLine | ✅ 完成（底部状态栏） |

#### Schemas — ✅ 全部完成（3个）

`proposal.schema.json` ✅ / `spec.schema.json` ✅ / `task.schema.json` ✅

#### Templates — ✅ 全部完成（4个）

`wsd-config.json` ✅ / `proposal.md` ✅ / `spec.md` ✅ / `tasks.md` ✅

#### 安装脚本 — ✅ 完成

`wsd/install.sh` ✅ / `wsd/settings.json` ✅

### 3.2 wsd_manager 平台层

#### API Server — ✅ 完成

| 模块 | 状态 |
|------|------|
| `src/server.js` Express API 服务 | ✅ 完成 |
| `src/core/registry.js` 资产继承解析 | ✅ 完成 |
| `src/core/requirements.js` 需求状态管理 | ✅ 完成 |
| `src/routes/assets.js` 资产 API | ✅ 完成 |
| `src/routes/requirements.js` 需求 API | ✅ 完成 |

#### Web UI — ✅ 完成

`web/public/index.html` — 暗色主题仪表盘，含：仪表盘/企业资产/团队资产/需求看板/审计日志 ✅

#### CLI 工具（wsdm）— ✅ 基础完成

| 功能 | 状态 |
|------|------|
| `wsdm sync` — 同步资产到本地 | ✅ |
| `wsdm list` — 列出可用资产 | ✅ |
| `wsdm publish` — 发布资产 | ✅ |
| `wsdm ingest` — 从内部文档生成 skill | ✅ |
| `wsdm teams` — 团队管理 | ✅ |
| `wsdm reqs` — 需求管理 | ✅ |
| `wsdm audit` — 审计日志 | ✅ |

#### 注册中心 — ✅ 基础完成

`registry/enterprise/index.json` ✅ / `registry/teams/example-backend-team/` ✅

### 3.3 集成层

| 集成 | 状态 |
|------|------|
| Jira 适配器（`wsd/integrations/jira.js`） | ✅ 完成 |
| 飞书适配器（`wsd/integrations/feishu.js`） | ✅ 完成（任务/多维表格/Webhook） |
| 企业内部 LLM 网关 | 📐 已设计（通过 modelOverrides 配置） |
| GitLab Issues | ⬜ 低优先级 |

### 3.4 部署层

| 文件 | 状态 |
|------|------|
| `wsd_manager/Dockerfile` | ✅ 完成 |
| `docker-compose.yml` | ✅ 完成 |
| `.env.example` | ✅ 完成 |

### 3.5 文档

| 文档 | 状态 |
|------|------|
| `docs/USAGE.md` 使用指南+实践案例 | ✅ 完成 |

### 3.6 剩余低优先级

| 项目 | 优先级 |
|------|--------|
| `wsd/uninstall.sh` 卸载脚本 | 🟢 低 |
| wsd_manager Web UI RBAC 权限控制 | 🟢 低 |
| Token 成本统计仪表盘 | 🟢 低 |
| GitLab Issues 集成 | 🟢 低 |
| npm 发布到内部制品库 | 🟢 低 |

### 原 3.2 wsd_manager 平台层（待完成）

#### CLI 工具（wsdm）

| 功能 | 状态 | 优先级 |
|------|------|--------|
| `wsdm pull` — 从注册中心拉取资产到本地 | ✅ (sync) | ✅ |
| `wsdm push` — 发布资产到注册中心 | ✅ (publish) | ✅ |
| `wsdm sync` — 双向同步 | ✅ | ✅ |
| `wsdm deploy` — 部署资产到目标环境 | ⬜ 待完成 | 🟡 中 |
| `wsdm audit` — 审计资产使用情况 | ⬜ 待完成 | 🟡 中 |
| `wsdm generate` — 从内部文档生成 skills | ⬜ 待完成 | 🔴 高 |

#### 注册中心（Registry）

| 功能 | 状态 | 优先级 |
|------|------|--------|
| 企业基线资产（`registry/enterprise/`） | ⬜ 待完成 | 🔴 高 |
| 部门资产（`registry/departments/`） | ⬜ 待完成 | 🟡 中 |
| 团队资产（`registry/teams/`） | ⬜ 待完成 | 🟡 中 |
| 资产版本管理 | ⬜ 待完成 | 🟡 中 |
| 资产继承解析（下层覆盖上层） | ⬜ 待完成 | 🔴 高 |

#### Web 管理界面

| 功能 | 状态 | 优先级 |
|------|------|--------|
| 部门视图（资产浏览/编辑） | ⬜ 待完成 | 🟢 低 |
| 团队视图 | ⬜ 待完成 | 🟢 低 |
| 仓库视图 | ⬜ 待完成 | 🟢 低 |
| 个人视图 | ⬜ 待完成 | 🟢 低 |
| 需求状态看板 | ⬜ 待完成 | 🟢 低 |
| Token 成本统计 | ⬜ 待完成 | 🟢 低 |

#### 企业内部技术组件集成（Generate Skills）

| 功能 | 状态 | 优先级 |
|------|------|--------|
| 从 Confluence/飞书文档生成 skill | ⬜ 待完成 | 🔴 高 |
| 从 OpenAPI/Swagger 生成 API connector skill | ⬜ 待完成 | 🔴 高 |
| 从技术架构文档生成 architecture skill | ⬜ 待完成 | 🟡 中 |
| 从组件库文档生成 coding patterns skill | ⬜ 待完成 | 🟡 中 |

### 3.3 集成层（待完成）

| 集成 | 状态 | 优先级 |
|------|------|--------|
| Jira 双向同步 | ⬜ 待完成 | 🔴 高 |
| 飞书文档/任务同步 | ⬜ 待完成 | 🔴 高 |
| GitHub Issues 同步 | ⬜ 待完成 | 🟡 中 |
| GitLab Issues 同步 | ⬜ 待完成 | 🟢 低 |
| 企业内部 LLM 网关适配 | ⬜ 待完成 | 🔴 高 |
| 多仓库协同（前后端分离） | 📐 已设计 | 🔴 高 |

---

## 四、实施路线图

### Phase 1：MVP（2周）— wsd 核心可用
**目标**：开发者可以在项目中使用完整的需求生命周期管理

- [ ] 创建 `wsd/hooks/` 目录及 4 个钩子（lifecycle-guard, spec-validator, context-monitor, session-inject）
- [ ] 创建 `wsd/schemas/` 目录及 3 个 JSON Schema
- [ ] 创建 `wsd/templates/` 目录及配置模板
- [ ] 创建 `wsd/install.sh` 安装脚本
- [ ] 创建 `wsd/hooks/statusline.py`（底部状态栏）
- [ ] 端到端测试：完整执行一个需求的生命周期

### Phase 2：集成（2周）— 企业系统打通
**目标**：与外部系统集成，支持企业日常使用

- [ ] Jira SDK 集成（`wsd/integrations/jira.js`）
- [ ] 飞书 SDK 集成（`wsd/integrations/feishu.js`）
- [ ] 实现 `wsd/commands/wsd-import.md` 的实际同步逻辑
- [ ] 企业内部 LLM 网关适配（通过 modelOverrides 配置）
- [ ] 多仓库并行需求管理实现

### Phase 3：wsd_manager MVP（3周）— 资产管理可用
**目标**：企业可以统一管理团队的 Claude Code 资产

- [ ] 搭建 wsd_manager 注册中心目录结构
- [ ] 实现 `wsdm pull/push/sync` CLI 命令
- [ ] 实现从内部文档生成 skill 的功能（`wsdm generate`）
- [ ] 实现四层资产继承解析
- [ ] 发布 npm 包或内部制品库包

### Phase 4：企业化（2周）— 完整管控
**目标**：满足企业安全、合规、审计要求

- [ ] 权限控制体系（RBAC）
- [ ] 审计日志完整性
- [ ] 资产版本管理
- [ ] Web 管理界面（基础版）
- [ ] Token 成本统计与分析

---

## 五、当前阻塞项

| 阻塞项 | 描述 | 依赖 |
|--------|------|------|
| Hooks 实现 | 需要确定 hooks 的运行环境（Node.js vs Python vs Shell） | 无 |
| wsd_manager 架构 | 需确定是 REST API 还是纯文件系统 | 无 |
| 企业 LLM 适配 | 需了解目标企业的 LLM 网关接口规范 | 业务 |
| 内部文档格式 | 生成 skill 需要了解内部文档的格式（Confluence/飞书） | 业务 |

---

## 六、文件树（当前实际状态）

```
wsd_all/
├── INDEX.md                          ✅
├── READEME.md                        ✅
├── docs/
│   ├── PROJECT-ROADMAP.md            ✅ (本文件)
│   ├── wsd-design.md                 ✅
│   ├── wsd-manager-design.md         ✅
│   ├── enterprise-integration-design.md ✅
│   └── claude-code-assets-analysis.md   ✅
├── wsd/
│   ├── CLAUDE.md                     ✅
│   ├── README.md                     ✅
│   ├── commands/ (19个)              ✅
│   ├── agents/ (6个)                 ✅
│   ├── skills/ (4个)                 ✅
│   ├── docs/
│   │   ├── enterprise-integration.md ✅
│   │   └── multi-repo.md             ✅
│   ├── hooks/                        ⬜ 待创建
│   ├── schemas/                      ⬜ 待创建
│   ├── templates/                    ⬜ 待创建
│   └── install.sh                    ⬜ 待创建
├── wsd_manager/                      ⬜ 待创建（设计已完成）
└── reference_projects/               ✅ (已存在的参考项目)
    ├── everything-claude-code/
    ├── superpowers/
    ├── get-shit-done/
    ├── oh-my-claudecode/
    ├── OpenSpec/
    └── Trellis/
```

---

## 七、进度统计

| 模块 | 总计划 | 已完成 | 完成率 |
|------|--------|--------|--------|
| 设计文档 | 5 | 5 | 100% |
| wsd 命令 | 19 | 19 | 100% |
| wsd 代理 | 6 | 6 | 100% |
| wsd 技能 | 4 | 4 | 100% |
| wsd 钩子 | 5 | 0 | 0% |
| wsd Schema | 3 | 0 | 0% |
| wsd 模板 | 4 | 0 | 0% |
| wsd 安装脚本 | 1 | 0 | 0% |
| wsd_manager CLI | 6 | 0 | 0% |
| wsd_manager 注册中心 | 5 | 0 | 0% |
| 外部系统集成 | 4 | 0 | 0% |
| **总计** | **62** | **34** | **55%** |
