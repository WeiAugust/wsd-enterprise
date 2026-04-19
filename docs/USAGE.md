# WSD 使用指南

> 基于 Claude Code 的企业级 AI 需求一站式交付框架
> 版本：v1.1 | 最后更新：2026-04-19

---

## 目录

1. [安装与配置](#一安装与配置)
2. [标准工作流](#二标准工作流完整生命周期)
3. [场景案例集](#三场景案例集)
4. [AI 编码统计](#四ai-编码统计)
5. [wsd_manager 管理控制台](#五wsd_manager-管理控制台)
6. [配置参考](#六配置参考)
7. [常见问题](#七常见问题)

---

## 一、安装与配置

### 1.1 前置条件

- Claude Code CLI 已安装（[官方文档](https://docs.anthropic.com/claude-code)）
- Node.js 18+（用于 hooks 脚本）
- Git（用于 AI 编码统计 git hook）
- Docker（可选，用于 wsd_manager 服务）

### 1.2 安装 wsd 插件

```bash
# 克隆仓库（或从 wsd_manager 订阅链接安装）
git clone https://your-internal-server/wsd_all.git
cd wsd_all

# 方式 A：安装到当前项目（推荐，开发者常用）
cd /your/project
/path/to/wsd_all/wsd/install.sh --init-project

# 方式 B：全局安装（适合个人使用）
/path/to/wsd_all/wsd/install.sh --global

# 方式 C：从 wsd_manager 订阅安装（企业推荐）
node wsd_all/wsd_manager/cli/wsdm.js sync --team=your-team
```

`--init-project` 会额外完成：
- 创建 `.wsd/` 目录及 `config.json` 模板
- 自动安装 git post-commit hook（AI 编码统计）
- 更新 `.gitignore`（排除 `.wsd/audit/`、`.claude/ai-pending/`）

### 1.3 启动 wsd_manager（可选）

```bash
cd wsd_all
cp .env.example .env      # 按需修改端口、数据目录
mkdir -p wsd-data

docker compose up -d      # 后台启动

# 验证
curl http://localhost:3030/api/health
# 访问 Web UI：http://localhost:3030
```

### 1.4 项目初始化配置

编辑 `.wsd/config.json`：

```json
{
  "team": "backend-team",
  "wsdManagerUrl": "http://localhost:3030",
  "permissions": {
    "propose": ["all"],
    "spec_approve": ["tech-lead"],
    "plan_approve": ["tech-lead", "pm"],
    "archive": ["tech-lead"]
  },
  "modelRouting": {
    "analyst":   "claude-opus-4-6",
    "architect": "claude-opus-4-6",
    "executor":  "claude-sonnet-4-6",
    "reviewer":  "claude-sonnet-4-6",
    "verifier":  "claude-sonnet-4-6"
  },
  "integrations": {
    "jira": {
      "baseUrl": "https://company.atlassian.net",
      "email": "${JIRA_EMAIL}",
      "token": "${JIRA_TOKEN}",
      "project": "PROJ"
    },
    "feishu": {
      "appId": "${FEISHU_APP_ID}",
      "appSecret": "${FEISHU_APP_SECRET}",
      "webhook": "${FEISHU_WEBHOOK}"
    }
  }
}
```

---

## 二、标准工作流（完整生命周期）

### 案例：新增手机号验证码登录

#### Step 1 — 提案（PROPOSE）

```
/wsd:propose 用户登录支持手机号+验证码方式
```

**发生了什么**：`wsd-analyst`（opus 模型）对你进行深度访谈，最多 5 轮：
- "这个需求的目标用户是已注册用户还是也覆盖新用户注册？"
- "验证码有效期和重试次数的业务规则？"
- "是否要同时废弃旧的密码登录方式？"

访谈完成后生成 `.wsd/requirements/REQ-20260419-001/proposal.md`：

```markdown
# REQ-20260419-001: 手机号验证码登录

## 目标用户：已注册用户（手机号已绑定）
## 核心功能
- [ ] 发送短信验证码（60s 倒计时，每日最多 10 次）
- [ ] 验证码登录（6 位数字，5 分钟有效期）
- [ ] 连续失败 5 次锁定账号 10 分钟
## Out of Scope：新用户注册流程、邮箱验证码
## 验收标准
1. 正常登录全流程 < 5s
2. 验证码过期提示明确
3. 锁定后给出剩余时间
## 技术约束：需接入已有短信服务商 API
```

#### Step 2 — 规格（SPEC）

```
/wsd:spec
```

生成 BDD 格式规格 `.wsd/requirements/REQ-20260419-001/specs/functional.md`：

```gherkin
Feature: 手机号验证码登录

Scenario: 正常登录
  GIVEN 用户已注册手机号 13800138000
  WHEN 用户请求发送验证码
  AND 5分钟内输入正确的6位验证码
  THEN 系统返回 access_token 和 refresh_token
  AND 创建登录会话，记录设备信息

Scenario: 验证码过期
  GIVEN 已发送验证码且超过5分钟
  WHEN 用户提交该验证码
  THEN 返回 401，错误信息"验证码已过期，请重新获取"

Scenario: 连续失败锁定
  GIVEN 同一手机号验证失败已达5次
  WHEN 再次尝试登录
  THEN 返回 429，错误信息"账号已锁定，9分30秒后重试"

Scenario: 超出每日发送限制
  GIVEN 该手机号今日已发送10次验证码
  WHEN 请求发送新验证码
  THEN 返回 429，错误信息"今日发送次数已达上限"
```

**人工确认**：检查规格是否覆盖所有场景，输入 `yes` 继续。

#### Step 3 — 计划（PLAN）

```
/wsd:plan
```

`wsd-planner` 生成 `tasks.md`（每个任务 ≤ 2h）：

```
TASK-01: 创建数据库表 sms_verifications（含索引）        [后端] 1h
TASK-02: SmsService - 发送、验证、频率限制逻辑           [后端] 2h
TASK-03: AuthController - /auth/sms/send + /verify     [后端] 1.5h
TASK-04: 锁定逻辑 + Redis 计数器                       [后端] 1h
TASK-05: 前端登录表单 - 验证码输入 + 倒计时组件          [前端] 1.5h
TASK-06: 单元测试（SmsService 覆盖率 >80%）             [测试] 1.5h
TASK-07: E2E 测试（全流程 + 异常场景）                   [测试] 1h
```

**人工确认**：确认任务拆分合理，输入 `yes` 继续。

#### Step 4 — 执行（EXECUTE）

```
/wsd:execute
```

AI 自动调度，每个任务在**独立子代理**中执行（防止 Context Rot），TDD 模式：

```
[执行中] TASK-01 ████████████████████ DONE (commit: a1b2c3d)
[执行中] TASK-02 ████████████████████ DONE (commit: d4e5f6g)
[执行中] TASK-03 ████████████████░░░░ 80%...
[等待]   TASK-04
...

实时进度：3/7 任务完成 | 上下文使用：42%
```

执行过程中 AI 编码统计 hook 自动记录每次 Write/Edit。

#### Step 5 — 验收（VERIFY）

```
/wsd:verify
```

`wsd-verifier` 对照 `specs/functional.md` 逐条核查：

```
✅ Scenario: 正常登录 — 代码覆盖，测试通过
✅ Scenario: 验证码过期 — 代码覆盖，错误码正确
✅ Scenario: 连续失败锁定 — 代码覆盖，剩余时间计算正确
✅ Scenario: 每日限制 — 代码覆盖，Redis 计数器验证通过
⚠️  安全检查：验证码未做防枚举（建议加 HMAC 签名）

验收结果：PASS（1个建议项，不阻断交付）
```

**人工最终确认**：输入 `yes` 标记 DONE。

#### Step 6 — 归档（ARCHIVE）

```
/wsd:archive REQ-20260419-001
```

自动执行：
- 计算 AI 编码统计（接受率、占比）
- 规格合并到 `.wsd/specs/auth/sms-login.md`
- 生成归档报告（含 AI 统计）
- 向 wsd_manager 上报最终状态

---

## 三、场景案例集

### 场景 A：极小改动（quickfix）

适用：≤5 个文件的改动，改动意图清晰。

```
/wsd:quickfix 修复登录页面按钮在 Safari 下点击无响应的问题
```

跳过规格和计划，直接实现 → 验证 → 完成。耗时约 15 分钟。

**判断标准**：
- 改动文件 ≤ 5 个
- 不涉及接口变更
- 不影响核心业务逻辑

---

### 场景 B：生产故障热修复（hotfix）

```
/wsd:hotfix 验证码校验逻辑有误，导致所有验证码校验失败
```

最简流程：直接进入 HOTFIX_EXECUTING → 完成后输出热修复报告。不创建完整需求文档，但永久保留审计日志。

**何时使用**：
- 生产系统故障影响用户
- 安全漏洞需要立即修复
- 不能等待完整需求流程

---

### 场景 C：开发中需求变更（amend）

需求已在 PLAN_APPROVED 状态，PM 要求增加"微信登录"：

```
/wsd:amend REQ-20260419-001 增加微信登录作为备选方式，与手机号登录并列
```

系统自动分级：

| 变更级别 | 描述 | 本例判断 |
|---------|------|---------|
| M0 | 措辞/说明调整 | — |
| M1 | 范围小幅扩展 | — |
| M2 | **架构/接口调整** | ← 本例（需增加 OAuth 流程） |
| M3 | 核心逻辑重构 | — |
| M4 | 推倒重来 | — |

M2 变更 → 回退到 SPEC_APPROVED，重新设计技术方案。

---

### 场景 D：验收发现 Bug（bugfix）

验收时发现：锁定后倒计时显示不准确。

```
/wsd:bugfix REQ-20260419-001 锁定后前端显示剩余时间与后端不一致
```

状态流：VERIFYING → BUGFIX → [修复] → VERIFYING

不影响其他任务进度，bug 记录到 `meta.json` 的 `bugs` 数组，归档时计入质量指标。

---

### 场景 E：从 Jira 导入需求

```
/wsd:import jira PROJ-1234
```

自动拉取 Jira Story，转换为 WSD proposal.md 格式，然后正常走 `/wsd:spec` 流程。

支持字段映射：
- Story Title → 需求标题
- Description → 背景与动机
- Acceptance Criteria → 验收标准草稿
- Story Points → 规模参考

---

### 场景 F：从飞书导入

```
/wsd:import feishu https://company.feishu.cn/docs/xxxxxx
```

解析飞书文档结构，提取需求描述，生成 proposal.md 初稿。

---

### 场景 G：多仓库前后端分离

在 `.wsd/config.json` 配置多仓库：

```json
{
  "repos": {
    "backend": { "path": "../backend-service", "branch": "feat/sms-login" },
    "frontend": { "path": "../frontend-app", "branch": "feat/sms-login" }
  }
}
```

执行时任务自动分配到对应仓库的子代理：

```
/wsd:execute

→ TASK-01~04: 在 ../backend-service 中执行
→ TASK-05:    在 ../frontend-app 中执行
→ TASK-06~07: 各自仓库执行后汇总
```

---

### 场景 H：需求阻塞与恢复

```
# 标记阻塞（等待第三方短信服务商审批）
/wsd:block REQ-20260419-001 等待短信服务商 API 权限审批，预计3个工作日

# 查看所有阻塞中的需求
/wsd:list --status=BLOCKED

# 解除阻塞，自动恢复执行
/wsd:unblock REQ-20260419-001
```

阻塞期间可继续执行无依赖的其他任务（TASK-05 前端部分）。

---

### 场景 I：回退到上一阶段

```
# 规格确认后发现有遗漏，需要重新做规格（需 team-lead 权限）
/wsd:rollback REQ-20260419-001

# 将回退到 SPECCING 状态，可重新运行 /wsd:spec
```

---

### 场景 J：仅使用 Claude Code 无 wsd 流程时的统计

开发者直接用 Claude Code 写代码，不走 wsd 完整流程：

```
# 正常用 Claude Code 写代码（AI 自动追踪 Write/Edit）
# 写完后正常 git commit
git add .
git commit -m "feat: 实现短信验证码发送逻辑"

# commit 完成后，终端会显示：
# [wsd/ai-stats] commit a1b2c3d | AI行数 127 | 占比 73.2% | 接受率 81.5% | tokens 45,230 ($0.2341)

# 随时查看当前需求统计
/wsd:stats REQ-20260419-001
/wsd:stats REQ-20260419-001 --detail   # 显示文件级明细
```

---

## 四、AI 编码统计

WSD 内置 AI 编码统计能力，无论是否使用 wsd-executor，**只要安装了 WSD 的 hooks，每次 git commit 后自动触发统计**。

### 4.1 统计指标说明

| 指标 | 含义 | 计算方式 |
|------|------|---------|
| **AI 编码行数** | Claude 写入的有效代码行数 | PostToolUse hook 捕获所有 Write/Edit，去空行统计 |
| **AI 编码占比** | AI 写的行数 / 本次 commit 总新增行数 | `AI行数 / git diff-tree --stat` |
| **AI 接受率** | 开发者保留的 AI 代码比例 | AI 快照 vs `git show HEAD:<file>` 行级对比 |
| **Token 消耗** | 本需求消耗的 API tokens | costs.js 按 reqId 汇总 |

### 4.2 查看统计

```
# 查看当前需求统计
/wsd:stats

# 查看指定需求
/wsd:stats REQ-20260419-001

# 详细文件级明细
/wsd:stats REQ-20260419-001 --detail

# 汇总所有需求（管理视角）
/wsd:stats --all --from=2026-04-01
```

**输出示例**：

```
╔══════════════════════════════════════════════════════╗
║     AI 编码统计报告  REQ-20260419-001               ║
╠══════════════════════════════════════════════════════╣
║  AI 编码行数    342        (28 次编辑)              ║
║  AI 编码占比    78.3%      (总变更 437 行)          ║
║  AI 接受率      82.5%                               ║
╠══════════════════════════════════════════════════════╣
║  Token 消耗     145,230                             ║
║   ├ 输入        128,400                             ║
║   └ 输出         16,830                             ║
║  预估费用       $0.6368                             ║
╚══════════════════════════════════════════════════════╝
```

### 4.3 统计数据存储位置

```
.claude/
  ai-pending/          ← AI 写入临时快照（commit 后清空）
  ai-stats-history.jsonl  ← 历史记录（每次 commit 追加一条）

.wsd/REQ-xxx/
  ai-stats.json        ← 该需求累计统计（含接受率、占比、tokens）
  ai-snapshots/        ← AI 原始内容快照（archive 后归档）
```

---

## 五、wsd_manager 管理控制台

### 5.1 Web UI

访问 `http://localhost:3030`，包含以下视图：

- **仪表盘**：需求总数/进行中/完成率、Token 消耗趋势
- **企业资产**：企业基线资产浏览与编辑
- **团队资产**：各团队资产管理（含继承关系可视化）
- **需求看板**：跨项目/跨团队需求状态一览
- **审计日志**：操作记录查询与导出
- **成本分析**：按需求/团队/时间的 Token 消耗统计

### 5.2 CLI 工具（wsdm）

```bash
# 同步团队资产到本地
node wsd_manager/cli/wsdm.js sync --team=backend-team

# 发布本地资产到注册中心（需权限）
node wsd_manager/cli/wsdm.js publish --asset=agents/my-agent.md --team=backend-team

# 从飞书文档生成 Skill
node wsd_manager/cli/wsdm.js ingest \
  --source=feishu \
  --url="https://company.feishu.cn/docs/xxxxxx" \
  --type=skill \
  --name=payment-patterns \
  --team=payment-team

# 查看团队有效资产（含继承）
node wsd_manager/cli/wsdm.js list --team=backend-team --resolved

# 查看需求状态
node wsd_manager/cli/wsdm.js reqs --status=EXECUTING

# 查看 Token 成本
node wsd_manager/cli/wsdm.js costs --team=backend-team --from=2026-04-01
```

### 5.3 REST API

```bash
# 查看团队继承后的有效资产
GET /api/assets/resolve?teamId=backend-team

# 上报需求状态（供 CI/CD 集成）
POST /api/requirements
{
  "reqId": "REQ-20260419-001",
  "title": "手机号验证码登录",
  "status": "EXECUTING",
  "team": "backend-team",
  "owner": "weizhen"
}

# 更新需求状态
PATCH /api/requirements/REQ-20260419-001/status
{ "status": "DONE", "actor": "weizhen", "comment": "验收通过" }

# Token 成本统计
GET /api/costs/stats?orgId=company&from=2026-04-01

# 审计日志查询
GET /api/audit?reqId=REQ-20260419-001&from=2026-04-01
```

### 5.4 资产订阅分发（企业推荐）

管理员在 wsd_manager 中为团队生成订阅 token，开发者一键安装：

```bash
# 开发者执行（新人入职时）
node wsd_manager/cli/wsdm.js sync \
  --token=sub_xxxxxxxx \
  --server=https://wsdm.company.com

# 效果：将团队的 agents/skills/rules/commands 同步到 ~/.claude/
```

---

## 六、配置参考

### .wsd/config.json（完整字段）

```json
{
  "team": "backend-team",
  "wsdManagerUrl": "http://localhost:3030",

  "permissions": {
    "propose": ["all"],
    "spec_approve": ["tech-lead", "architect"],
    "plan_approve": ["tech-lead", "pm"],
    "execute": ["developer"],
    "verify_approve": ["qa", "pm"],
    "archive": ["tech-lead"],
    "rollback": ["tech-lead"]
  },

  "modelRouting": {
    "analyst":   "claude-opus-4-6",
    "architect": "claude-opus-4-6",
    "planner":   "claude-sonnet-4-6",
    "executor":  "claude-sonnet-4-6",
    "reviewer":  "claude-sonnet-4-6",
    "verifier":  "claude-sonnet-4-6",
    "fallback":  "internal-llm-gateway"
  },

  "integrations": {
    "jira": {
      "baseUrl": "https://company.atlassian.net",
      "email": "${JIRA_EMAIL}",
      "token": "${JIRA_TOKEN}",
      "project": "PROJ",
      "syncOnPropose": true,
      "syncOnArchive": true,
      "statusMapping": {
        "PROPOSED": "Backlog",
        "EXECUTING": "In Progress",
        "DONE": "Done"
      }
    },
    "feishu": {
      "appId": "${FEISHU_APP_ID}",
      "appSecret": "${FEISHU_APP_SECRET}",
      "webhook": "${FEISHU_WEBHOOK}",
      "notifyOnStatusChange": true,
      "notifyRoles": ["tech-lead", "pm"]
    }
  },

  "repos": {
    "backend": { "path": "." },
    "frontend": { "path": "../frontend" }
  },

  "contextLimits": {
    "warnAt": 0.60,
    "blockAt": 0.80
  }
}
```

### settings.json（hooks 配置）

```json
{
  "statusLine": {
    "command": "bash .claude/hooks/statusline.sh"
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "command": "node .claude/hooks/lifecycle-guard.js",
        "description": "阻止跳过阶段的非法操作"
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit|Bash",
        "command": "node .claude/hooks/audit-logger.js",
        "description": "记录操作到 .wsd/audit/"
      },
      {
        "matcher": "Write|Edit",
        "command": "node .claude/hooks/ai-code-tracker.js",
        "description": "AI 编码统计：记录写入快照"
      },
      {
        "matcher": ".*",
        "command": "node .claude/hooks/context-monitor.js",
        "description": "上下文用量监控"
      }
    ],
    "UserPromptSubmit": [
      {
        "command": "python3 .claude/hooks/session-inject.py",
        "description": "注入当前需求状态到会话"
      }
    ]
  }
}
```

---

## 七、常见问题

**Q: 上下文快满了怎么办？**

`context-monitor.js` 在 60% 时自动警告，80% 时阻止新任务启动。解决方式：

```
/wsd:execute --task TASK-04   # 指定从某个任务开始，开启新会话
```

**Q: 需求被阻塞了怎么处理？**

```
/wsd:block REQ-xxx 等待第三方审批，预计3个工作日
# 阻塞期间可继续做其他不依赖此任务的工作

/wsd:unblock REQ-xxx   # 解除后自动提示继续
```

**Q: 如何查看所有进行中的需求？**

```
/wsd:status              # Claude 内文字看板
/wsd:list --status=EXECUTING
http://localhost:3030    # Web UI 可视化看板
```

**Q: AI 接受率很低（< 50%）意味着什么？**

表示开发者对 AI 生成的代码做了大量修改。可能的原因：
- AI 不了解项目特定约定（建议在 `.claude/rules/` 中补充项目规范）
- 任务粒度太粗（建议拆得更细，≤ 1h/任务）
- 规格不够精确（建议完善 BDD 场景）

**Q: 团队新成员如何快速接入？**

```bash
# 一键完成：安装 WSD + 同步团队资产 + 初始化项目
./wsd/install.sh --init-project
node wsd_manager/cli/wsdm.js sync --team=backend-team

# 新成员只需运行以上两行，即可获得与团队一致的 AI 工具配置
```

**Q: 如何从 Cursor 迁移到 Claude Code？**

WSD 的资产格式（YAML frontmatter + Markdown）与 ECC 兼容，后续计划支持 Cursor 适配目录。当前建议：

1. 将现有 Cursor Rules 整理为 `.claude/rules/` 格式
2. 在 `wsd_manager` 中登记为团队规则资产
3. 同步到团队成员的 Claude Code 环境

**Q: 需求 ID 格式是什么？**

`REQ-YYYYMMDD-NNN`，例如 `REQ-20260419-001`。同一天多个需求按序号递增。

**Q: 归档后规格放在哪里？**

规格合并到 `.wsd/specs/<feature-area>/`，例如：
```
.wsd/specs/
  auth/
    sms-login.md          ← 手机号验证码登录规格
    oauth.md              ← OAuth 登录规格
  payment/
    checkout.md
```

归档的规格是团队的"活文档"，下次做相关需求时 AI 自动参考。
