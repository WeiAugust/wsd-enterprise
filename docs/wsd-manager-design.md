# wsd_manager — 企业级 Claude Code 资产管理平台设计文档

> 按部门/团队/仓库/个人四层管理 Claude Code 全量资产
> 版本：v1.0 设计稿 | 日期：2026-04-14

---

## 一、定位与核心价值

### 1.1 解决的企业痛点

| 问题 | 现象 | wsd_manager 解法 |
|------|------|-----------------|
| **资产孤岛** | 每个工程师各自维护 ~/.claude/，无法共享 | 四层资产继承体系 |
| **规范不一致** | 团队 A 和团队 B 用完全不同的 agents | 层级规范下发 + 覆盖机制 |
| **安全盲区** | 不知道团队在用什么 MCP、hooks | 资产审计 + 白名单管控 |
| **分发困难** | 新人入职需要手动复制一堆文件 | 一键同步到本地 |
| **版本混乱** | 修改了某个 agent 但没有版本记录 | 语义化版本 + 变更历史 |
| **成本不透明** | 不知道哪个团队消耗了多少 tokens | 使用统计 + 成本归因 |

### 1.2 核心设计原则

1. **资产即代码（Assets as Code）**：所有资产以 Markdown/JSON 文件存储在 Git 仓库中
2. **层级继承（Hierarchical Inheritance）**：下层自动继承上层资产，支持选择性覆盖
3. **最小权限（Least Privilege）**：各层只能管理自己层级及以下的资产
4. **渐进采用（Progressive Adoption）**：个人/团队可以先用，不强制全面改造
5. **平台无关（Platform Agnostic）**：支持 Claude Code、Cursor、Codex 等多平台

---

## 二、四层架构模型

### 2.1 层级定义

```
┌─────────────────────────────────────────────────────────────────────┐
│                      企业层 (Enterprise)                             │
│  Owner: CTO/平台团队                                                  │
│  资产：安全基线、合规规则、审核白名单、企业 MCP、统一 CLAUDE.md          │
├─────────────────────────────────────────────────────────────────────┤
│                      部门层 (Department)                             │
│  Owner: 技术负责人/架构师                                              │
│  资产：领域 agents、业务 skills、技术规范 rules、部门 MCP              │
├─────────────────────────────────────────────────────────────────────┤
│                      团队层 (Team)                                   │
│  Owner: 技术 Leader                                                  │
│  资产：团队 agents、工作流 skills、编码规范 commands、质量 hooks         │
├─────────────────────────────────────────────────────────────────────┤
│                      仓库层 (Repository)                             │
│  Owner: 项目 Maintainer                                              │
│  资产：项目专属 agents/commands/rules、构建 hooks、项目 MCP            │
├─────────────────────────────────────────────────────────────────────┤
│                      个人层 (Individual)                             │
│  Owner: 工程师本人                                                    │
│  资产：个人 agents/skills/commands、个人习惯 settings                 │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 资产继承规则

```
最终有效资产 = 企业层基线
             ∪ 部门层追加
             ∪ 团队层追加
             ∪ 仓库层追加
             ∪ 个人层追加
             （同名资产：下层覆盖上层）
```

**示例**：`code-reviewer` agent 的解析过程
```
1. 企业层：~/.claude/enterprise/agents/code-reviewer.md（基础版）
2. 部门层：~/.claude/dept/backend/agents/code-reviewer.md（后端特化）
3. 团队层：~/.claude/team/payment/agents/code-reviewer.md（支付安全强化）
4. 仓库层：.claude/agents/code-reviewer.md（项目级定制）[最终使用]
5. 个人层：~/.claude/personal/agents/code-reviewer.md（个人习惯）[个人会话使用]
```

### 2.3 各层可管理资产矩阵

| 资产类型 | 企业 | 部门 | 团队 | 仓库 | 个人 | 说明 |
|----------|:----:|:----:|:----:|:----:|:----:|------|
| CLAUDE.md | ✓ | ✓ | ✓ | ✓ | ✓ | 全部合并加载 |
| Agents | ✓ | ✓ | ✓ | ✓ | ✓ | 下层覆盖上层 |
| Skills | ✓ | ✓ | ✓ | ✓ | ✓ | 下层覆盖上层 |
| Commands | ✓ | ✓ | ✓ | ✓ | ✓ | 下层覆盖上层 |
| Rules | ✓ | ✓ | ✓ | ✓ | ✓ | common<语言特定<项目特定 |
| Hooks | ✓ | ✓ | ✓ | ✓ | ✓ | 叠加执行（不覆盖）|
| MCP | ✓ | ✓ | ✓ | ✓ | ✓ | 合并，企业级需审核 |
| Plugins | ✓审核 | ✓推荐 | ✓推荐 | ✓依赖 | ✓安装 | 企业白名单 |
| Settings | ✓基线 | — | ✓部分 | ✓部分 | ✓个人 | 关键项企业锁定 |
| Memory | — | — | — | ✓ | ✓ | 不跨层共享 |
| wsd 需求 | — | — | — | ✓ | ✓ | 仓库+个人 |

---

## 三、核心模块设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                     wsd_manager                                      │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Registry │  │ Resolver │  │ Deployer │  │    Web Console   │   │
│  │ (资产注册) │  │ (继承解析) │  │ (资产分发) │  │   (管理界面)      │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
│       │              │              │                  │             │
│  ┌────▼──────────────▼──────────────▼──────────────────▼──────────┐ │
│  │                         Core API                               │ │
│  │  /assets  /sync  /deploy  /audit  /metrics  /teams  /users     │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │   CLI    │  │   Git    │  │  Plugin  │  │   Integrations   │   │
│  │ (wsdm)   │  │ Backend  │  │  Market  │  │ (Jira/飞书/LDAP) │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Registry（资产注册表）

#### 数据模型

```typescript
// 资产元数据
interface AssetMeta {
  id: string;                    // 全局唯一 ID
  name: string;                  // 资产名（如 code-reviewer）
  type: AssetType;               // agent|skill|command|rule|hook|mcp|plugin
  layer: Layer;                  // enterprise|dept|team|repo|personal
  owner: string;                 // 层级的 owner（dept-id/team-id/repo-id/user-id）
  version: string;               // semver（如 1.2.3）
  content: string;               // 资产内容（Markdown/JSON）
  contentHash: string;           // SHA-256 内容哈希
  tags: string[];                // 标签（如 ["security", "backend"]）
  dependencies: string[];        // 依赖的其他资产 ID
  platforms: Platform[];         // 支持的平台（claude-code|cursor|codex）
  status: 'active'|'deprecated'|'draft';
  complianceStatus: 'approved'|'pending'|'rejected';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  changelog: ChangeEntry[];
}

// 层级定义
interface Layer {
  type: 'enterprise'|'dept'|'team'|'repo'|'personal';
  id: string;
  parentId?: string;
}
```

#### 存储结构（Git 仓库）

```
wsd-assets-registry/           # 内部 Git 仓库
├── enterprise/
│   ├── agents/
│   │   ├── code-reviewer.md
│   │   └── security-reviewer.md
│   ├── rules/
│   │   ├── security-baseline.md
│   │   └── compliance.md
│   └── mcp/
│       └── internal-tools.json
├── departments/
│   ├── backend/
│   │   ├── agents/
│   │   └── rules/
│   └── frontend/
│       ├── skills/
│       └── rules/
├── teams/
│   ├── payment-team/
│   │   ├── agents/
│   │   └── hooks/
│   └── user-team/
│       └── agents/
└── index.json                 # 全量资产索引（供 wsdm 快速检索）
```

### 3.3 Resolver（继承解析引擎）

```typescript
class AssetResolver {
  // 解析用户在特定上下文下的有效资产集合
  async resolve(params: {
    userId: string;
    repoId?: string;
    assetType?: AssetType;
    includePersonal?: boolean;
  }): Promise<ResolvedAssets> {
    
    // 1. 获取用户的层级路径
    const path = await this.getLayerPath(params.userId, params.repoId);
    // 例：[enterprise, dept:backend, team:payment, repo:payment-service, personal:weizhen]
    
    // 2. 从底层到顶层收集资产（下层优先）
    const assetsByName = new Map<string, AssetMeta>();
    for (const layer of path.reverse()) {  // 先加载高层（企业），再被低层覆盖
      const layerAssets = await this.registry.listAssets(layer, params.assetType);
      for (const asset of layerAssets) {
        assetsByName.set(asset.name, asset);  // 低层覆盖高层
      }
    }
    
    // 3. 处理 hooks（叠加而非覆盖）
    const allHooks = await this.collectHooks(path);
    
    // 4. 合并 CLAUDE.md（全部追加）
    const claudeMdChain = await this.collectClaudeMd(path);
    
    return {
      assets: Array.from(assetsByName.values()),
      hooks: allHooks,
      claudeMdChain
    };
  }
}
```

### 3.4 Deployer（资产分发器）

#### 分发模式

**模式 A：本地同步（推荐，轻量）**
```bash
# 将解析后的资产同步到本地 ~/.claude/ 和 .claude/
wsdm sync

# 输出：
# ✓ Resolved 47 assets (enterprise: 12, dept: 8, team: 15, repo: 12)
# ✓ Synced 23 new/updated files to ~/.claude/
# ✓ Synced 12 new/updated files to .claude/
# ✓ Generated .claude/CLAUDE.md (merged 4 layers)
```

**模式 B：插件市场分发（标准化）**
```bash
# wsd_manager 维护内部插件市场
# 工程师只需：
claude plugin marketplace add https://internal.company.com/wsdm-market
claude plugin install enterprise-baseline@wsdm-market    # 企业基线
claude plugin install backend-team@wsdm-market           # 后端团队资产
```

**模式 C：CI/CD 自动注入（最自动化）**
```yaml
# .github/workflows/sync-claude-assets.yml
on: [push, pull_request]
jobs:
  sync-assets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: wsdm sync --repo=${{ github.repository }} --ci-mode
        env:
          WSDM_TOKEN: ${{ secrets.WSDM_TOKEN }}
```

#### 同步算法

```typescript
async function sync(userId: string, repoId: string) {
  const resolved = await resolver.resolve({ userId, repoId });
  
  // 计算 diff（避免不必要的文件写入）
  const localAssets = await scanLocalAssets();
  const diff = computeDiff(resolved.assets, localAssets);
  
  for (const asset of diff.toAdd) {
    await writeAsset(asset, getLocalPath(asset));
  }
  for (const asset of diff.toUpdate) {
    await writeAsset(asset, getLocalPath(asset));
  }
  for (const asset of diff.toRemove) {
    await removeAsset(getLocalPath(asset));  // 仅移除 wsdm 管理的资产
  }
  
  // 生成合并的 CLAUDE.md
  await generateMergedClaudeMd(resolved.claudeMdChain);
  
  // 生成合并的 settings.json（hooks 叠加）
  await generateMergedSettings(resolved.hooks);
}
```

### 3.5 Plugin Market（内部插件市场）

```
内部插件市场结构：
wsdm-market/
├── packages/
│   ├── enterprise-baseline/    # 企业基线包
│   │   ├── plugin.json
│   │   ├── agents/
│   │   └── rules/
│   ├── backend-team/           # 后端团队包
│   │   ├── plugin.json
│   │   └── agents/
│   └── wsd/                    # wsd 需求管理插件
│       └── plugin.json
└── index.json                  # 市场索引
```

`plugin.json` 格式：
```json
{
  "name": "backend-team",
  "version": "2.1.0",
  "description": "后端团队 Claude Code 标准资产包",
  "layer": "team",
  "includes": ["agents", "skills", "rules", "hooks"],
  "requires": ["enterprise-baseline"],
  "platforms": ["claude-code", "cursor"],
  "maintainer": "backend-tech-lead"
}
```

---

## 四、Web 管理控制台

### 4.1 核心页面设计

#### 首页 Dashboard
```
┌─────────────────────────────────────────────────────────────────┐
│  wsd_manager                              [搜索] [通知] [用户]    │
├──────────┬──────────────────────────────────────────────────────┤
│          │  📊 总览                                              │
│ 企业      │  ┌─────────┬─────────┬─────────┬─────────┐         │
│ └ 后端部门 │  │ 资产总数 │ 活跃团队 │ 本周同步 │ 待审批  │         │
│   └ 支付团队│  │   1,247  │   23    │   891   │    5    │         │
│   └ 用户团队│  └─────────┴─────────┴─────────┴─────────┘         │
│ └ 前端部门 │                                                      │
│           │  🔄 最近活动                                          │
│ [+新建团队]│  • backend-team/code-reviewer v2.1 已发布            │
│           │  • enterprise/security-baseline 有待审批变更          │
│           │  • weizhen 同步了 47 个资产                           │
└──────────┴──────────────────────────────────────────────────────┘
```

#### 资产管理页

```
┌─────────────────────────────────────────────────────────────────┐
│  资产管理 / 团队: 支付团队                                         │
├─────────────────────────────────────────────────────────────────┤
│  [筛选: 类型 ▼] [筛选: 状态 ▼] [搜索资产名]         [+ 新建资产]  │
├──────────────────────────────────────────────────────────────────┤
│  名称                  类型     版本    来源    状态    操作       │
├──────────────────────────────────────────────────────────────────┤
│  code-reviewer         agent   2.1.0   team   active  编辑|历史  │
│  security-reviewer     agent   1.0.0   ↑dept  locked  查看      │
│  tdd-workflow          skill   3.0.1   team   active  编辑|历史  │
│  /wsd:execute          command 1.2.0   ↑wsd   active  查看      │
│  pre-commit-check      hook    1.0.0   team   active  编辑|测试  │
│  payment-mcp           mcp     1.1.0   team   ⚠️审批中 查看       │
└──────────────────────────────────────────────────────────────────┘
```

#### 资产详情页（含版本历史）

```
┌─────────────────────────────────────────────────────────────────┐
│  code-reviewer (agent) — 支付团队                                 │
│  v2.1.0 | 活跃 | 已审批 | 37个仓库在用 | 2026-04-14更新          │
├─────────────────────────────────────────────────────────────────┤
│  [预览] [编辑] [版本历史] [使用统计] [测试]                        │
├─────────────────────────────────────────────────────────────────┤
│  继承自:  企业层 code-reviewer v1.0.0                             │
│  覆盖层:  部门层 code-reviewer v1.5.0                             │
│  当前层:  ✓ 团队层 code-reviewer v2.1.0                           │
│  被覆盖:  3个仓库有自己的 code-reviewer                           │
├─────────────────────────────────────────────────────────────────┤
│  变更描述: 增加支付安全检查规则（PCI-DSS 合规）                     │
│                                                                   │
│  [内容预览]                                                        │
│  ---                                                              │
│  name: code-reviewer                                              │
│  description: ...                                                 │
│  ---                                                              │
│  # 支付团队代码审查规范...                                          │
└─────────────────────────────────────────────────────────────────┘
```

#### 需求看板（整合 wsd）

```
┌─────────────────────────────────────────────────────────────────┐
│  需求看板 / 仓库: payment-service                                  │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│ PROPOSED │  SPEC    │  PLAN    │ EXECUTE  │  VERIFY  │  DONE    │
│  (2)     │  (1)     │  (3)     │  (4)     │  (1)     │  (12)    │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ REQ-001  │ REQ-003  │ REQ-005  │ REQ-007  │ REQ-011  │ REQ-...  │
│ 手机验证  │ 退款流程  │ 风控规则  │ 账单详情  │ 多货币    │          │
│ @weizhen │ @li      │ @zhang   │ @wang    │ @chen    │          │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ REQ-002  │          │ REQ-006  │ REQ-008  │          │          │
│ 微信支付  │          │ 对账系统  │ 费率管理  │          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

#### 使用统计 & 成本分析

```
┌─────────────────────────────────────────────────────────────────┐
│  使用统计 / 本月                                                   │
├──────────────────────────────────────────────────────────────────┤
│  Token 消耗趋势                    Top 使用资产                   │
│  ┌────────────────────────┐       1. wsd-executor       45.2%  │
│  │    ／╲                  │       2. code-reviewer      22.1%  │
│  │   ╱  ╲___╱╲            │       3. tdd-workflow        12.3%  │
│  │  ╱         ╲___        │       4. security-reviewer   8.7%  │
│  └────────────────────────┘       5. architect           6.2%  │
│  本月: 12.4M tokens | $124        其他                    5.5%  │
├──────────────────────────────────────────────────────────────────┤
│  团队分布             需求交付周期         测试覆盖率              │
│  后端: 45%           平均: 3.2天          平均: 82%              │
│  前端: 30%           最快: 0.5天          最高: 97%              │
│  算法: 25%           最慢: 12天           最低: 71%              │
└──────────────────────────────────────────────────────────────────┘
```

---

## 五、CLI 工具（wsdm）

### 5.1 命令体系

```bash
# 资产管理
wsdm asset list [--type=agent] [--layer=team]   # 列出资产
wsdm asset get <name>                            # 查看资产详情
wsdm asset push <file>                           # 上传资产
wsdm asset pull <name> [--version=1.2.0]        # 下载资产
wsdm asset diff <name>                           # 对比本地与远程
wsdm asset versions <name>                       # 查看版本历史
wsdm asset approve <name>                        # 审批资产（需权限）
wsdm asset deprecate <name>                      # 废弃资产

# 同步
wsdm sync                                        # 全量同步（推荐）
wsdm sync --dry-run                              # 预览变更
wsdm sync --layer=team                           # 只同步团队层
wsdm sync --force                                # 强制覆盖本地修改

# 团队管理
wsdm team list                                   # 列出所有团队
wsdm team create <name> [--dept=backend]         # 创建团队
wsdm team members <name>                         # 查看成员
wsdm team add-member <team> <user>               # 添加成员

# 部署
wsdm deploy --user=weizhen                       # 为指定用户部署
wsdm deploy --team=payment                       # 为整个团队部署
wsdm deploy --repo=org/payment-service           # 为仓库部署

# 审计
wsdm audit log [--from=2026-04-01]              # 查看审计日志
wsdm audit asset <name>                          # 查看资产使用记录
wsdm audit compliance                            # 合规报告

# 需求集成（调用 wsd）
wsdm req list [--status=EXECUTING]               # 列出需求
wsdm req metrics [--period=month]                # 需求统计
wsdm req export [--format=csv]                   # 导出报表

# 插件市场
wsdm market list                                 # 列出可用包
wsdm market publish <pkg>                        # 发布包到市场
wsdm market install <pkg>                        # 安装包
```

### 5.2 配置文件

```yaml
# ~/.wsdm/config.yaml
server:
  url: https://wsd-manager.internal.company.com
  token: ${WSDM_TOKEN}  # 从环境变量读取

user:
  id: weizhen
  dept: backend
  teams:
    - payment-team
    - user-team

sync:
  autoSync: true          # 启动 Claude Code 时自动同步
  conflictStrategy: remote # 冲突时以远程为准
  excludePersonal: false   # 是否同步个人层

localPaths:
  global: ~/.claude        # 全局资产路径
  project: .claude         # 项目资产路径
```

---

## 六、核心 API 设计

### 6.1 RESTful API

```
# 资产 API
GET    /api/v1/assets?type=agent&layer=team&owner=payment-team
GET    /api/v1/assets/:id
POST   /api/v1/assets
PUT    /api/v1/assets/:id
DELETE /api/v1/assets/:id
GET    /api/v1/assets/:id/versions
POST   /api/v1/assets/:id/approve
POST   /api/v1/assets/:id/deprecate

# 解析 API（核心功能）
POST   /api/v1/resolve
Body: { userId, repoId, assetTypes }
Response: { agents[], skills[], commands[], rules[], hooks[], claudeMd }

# 同步 API
POST   /api/v1/sync
Body: { userId, repoId, dryRun }
Response: { toAdd[], toUpdate[], toRemove[], warnings[] }

# 团队 API
GET    /api/v1/teams
GET    /api/v1/teams/:id/assets
GET    /api/v1/teams/:id/members

# 需求 API（与 wsd 联动）
GET    /api/v1/requirements?repoId=&status=
POST   /api/v1/requirements/events
GET    /api/v1/requirements/metrics

# 统计 API
GET    /api/v1/metrics/tokens?period=month&team=payment
GET    /api/v1/metrics/assets/usage?name=code-reviewer
GET    /api/v1/metrics/requirements/cycle-time
```

### 6.2 WebSocket（实时通知）

```typescript
// 客户端订阅
ws.subscribe('asset.updated', { layer: 'team', owner: 'payment-team' });
ws.subscribe('requirement.status_changed', { repoId: 'payment-service' });
ws.subscribe('sync.completed', { userId: 'weizhen' });

// 服务端推送
ws.emit('asset.updated', { name: 'code-reviewer', version: '2.2.0' });
ws.emit('requirement.status_changed', {
  reqId: 'REQ-20260414-001',
  from: 'EXECUTING',
  to: 'VERIFY'
});
```

---

## 七、安全与合规

### 7.1 身份认证

```
支持认证方式：
├── LDAP/AD（企业目录服务）
├── SSO（单点登录，SAML 2.0 / OIDC）
├── GitHub OAuth（研发团队常用）
└── API Token（CI/CD 场景）
```

### 7.2 权限模型（RBAC）

```typescript
// 角色定义
type Role = 
  | 'platform-admin'    // 可管理企业层资产
  | 'dept-admin'        // 可管理部门层资产
  | 'team-lead'         // 可管理团队层资产
  | 'developer'         // 可管理仓库层资产 + 同步
  | 'viewer';           // 只读

// 权限检查
function canManageAsset(user: User, asset: Asset): boolean {
  if (user.role === 'platform-admin') return true;
  if (user.role === 'dept-admin' && asset.layer === 'dept' 
      && user.dept === asset.owner) return true;
  if (user.role === 'team-lead' && asset.layer === 'team'
      && user.teams.includes(asset.owner)) return true;
  if (asset.layer === 'personal' && asset.owner === user.id) return true;
  return false;
}
```

### 7.3 敏感资产管控

```json
// 企业层：设置需要审核的资产类型
{
  "compliance": {
    "requireApproval": ["mcp", "hooks"],      // MCP 和 hooks 需审批
    "restrictedLayers": {
      "enterprise": ["platform-admin"],        // 企业层只有平台管理员可改
      "dept": ["dept-admin", "platform-admin"]
    },
    "auditAll": true,                          // 全量审计
    "scanSecrets": true,                       // 扫描资产中的密钥
    "allowedMcpServers": [                     // MCP 服务器白名单
      "context7", "playwright", "github",
      "internal-tools"
    ]
  }
}
```

---

## 八、企业内部生态集成

### 8.1 Jira 集成

```typescript
// 需求状态双向同步
jiraIntegration.on('issue.updated', async (issue) => {
  if (issue.status === 'In Progress') {
    await wsd.propose(issue.summary, { jiraId: issue.key });
  }
  if (issue.status === 'Done') {
    await wsd.archive(issue.key);
  }
});

// wsd 状态变更 → 更新 Jira
wsd.on('requirement.status_changed', async (req) => {
  await jira.updateIssueStatus(req.jiraId, WSD_TO_JIRA_STATUS[req.status]);
});
```

### 8.2 飞书集成

```typescript
// 需求状态变更时发送飞书通知
wsd.on('requirement.status_changed', async (req) => {
  await feishu.sendMessage({
    chatId: team.feishuChatId,
    content: `需求 ${req.id} 状态变更: ${req.prevStatus} → ${req.status}`,
    buttons: [
      { text: '查看详情', url: `${wsdManagerUrl}/req/${req.id}` },
      { text: '确认通过', action: 'approve', data: req.id }
    ]
  });
});

// 飞书文档同步到 wsd 规格
feishuIntegration.syncDocToSpec(feishuDocId, wsdReqId);
```

### 8.3 GitLab/GitHub 集成

```yaml
# .gitlab-ci.yml 集成示例
stages:
  - asset-sync
  - build
  - deploy

asset-sync:
  stage: asset-sync
  script:
    - wsdm sync --repo=$CI_PROJECT_PATH --ci-mode
    - wsdm audit compliance --fail-on-violation
  only:
    - merge_requests
    - main
```

### 8.4 企业内部模型支持

```json
// .wsd/config.json
{
  "modelRouting": {
    "default": "claude-sonnet-4-6",
    "complex": "claude-opus-4-6",
    "fallback": "internal-llm-api",    // 企业私有模型
    "sensitive": "local-llm"           // 涉密场景用本地模型
  },
  "internalLlm": {
    "baseUrl": "https://llm.internal.company.com/v1",
    "apiKey": "${INTERNAL_LLM_KEY}",
    "model": "company-llm-v2"
  }
}
```

---

## 九、技术栈选型

### 9.1 推荐技术栈

| 组件 | 技术选型 | 理由 |
|------|----------|------|
| **后端 API** | Node.js + Fastify | 与 Claude Code 生态一致（JS/TS），ECC 也是 Node.js |
| **数据库** | PostgreSQL | 资产元数据 + 审计日志 |
| **资产存储** | Git（内部 GitLab）| 资产即代码，天然版本管理 |
| **搜索** | ElasticSearch | 资产全文搜索 |
| **缓存** | Redis | API 响应缓存 + 实时通知 |
| **前端** | Next.js + Tailwind | SSR + 组件库成熟 |
| **CLI** | TypeScript + Commander.js | 与 GSD CLI 保持一致 |
| **认证** | Passport.js + LDAP/SAML | 企业集成成熟方案 |
| **消息队列** | Redis Pub/Sub | 轻量，适合中小规模 |

### 9.2 部署架构

```
┌─────────────────────────────────────────────────────────┐
│                   企业内网                               │
│                                                          │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────┐    │
│  │  Web UI  │   │  API     │   │  Worker           │    │
│  │ (Next.js)│   │ (Fastify)│   │ (资产同步/分析)     │    │
│  └──────────┘   └──────────┘   └──────────────────┘    │
│        │              │                 │               │
│  ┌─────▼──────────────▼─────────────────▼─────────┐    │
│  │              Load Balancer                       │    │
│  └─────────────────────────────────────────────────┘    │
│        │              │                                  │
│  ┌─────▼──────┐  ┌────▼──────┐  ┌──────────────────┐   │
│  │ PostgreSQL │  │  Redis    │  │ 内部 GitLab       │   │
│  │ (元数据)    │  │ (缓存/MQ) │  │ (资产存储)         │   │
│  └────────────┘  └───────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────┘
        │
   外部 Claude API / 内部 LLM
```

---

## 十、实施路线图

### Phase 1：基础平台（4周）
- [ ] 资产注册表（Registry）基础功能
- [ ] 四层继承 Resolver
- [ ] `wsdm sync` CLI 核心命令
- [ ] 基础 Web UI（资产浏览 + 团队管理）
- [ ] LDAP/SSO 认证

### Phase 2：分发与协作（3周）
- [ ] 内部插件市场
- [ ] CI/CD 集成（GitLab CI）
- [ ] Jira/飞书 通知集成
- [ ] 资产审批流程
- [ ] 审计日志

### Phase 3：wsd 联动（3周）
- [ ] wsd 事件上报接口
- [ ] 需求看板（Web UI）
- [ ] Token 使用统计
- [ ] 需求交付周期分析
- [ ] 飞书 Bot 通知

### Phase 4：智能化（持续迭代）
- [ ] 资产质量评分（基于使用效果）
- [ ] 智能资产推荐（根据仓库技术栈）
- [ ] 资产 A/B 测试（对比不同版本效果）
- [ ] 自动发现冲突资产
- [ ] 成本优化建议
