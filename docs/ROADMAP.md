# WSD 建设规划路线图

> 从当前原型到生产可用的企业级 AI 需求管理系统
> 版本：v1.1 | 最后更新：2026-04-19

---

## 当前状态评估

### 已完成（设计与原型）

| 模块 | 状态 | 说明 |
|------|------|------|
| wsd 命令（19个） | ✅ 完成 | 所有命令的 Markdown 定义完整 |
| wsd 代理（6个） | ✅ 完成 | analyst/architect/planner/executor/reviewer/verifier |
| wsd 技能（4个） | ✅ 完成 | lifecycle/context-guard/spec-writing/deep-interview |
| wsd Hooks（7个） | ✅ 完成 | 包含 AI 编码统计 hooks |
| wsd 安装脚本 | ✅ 完成 | 含 git hook 安装、gitignore 更新 |
| wsd 外部集成 | ✅ 完成 | Jira、飞书适配器 |
| wsd_manager API | ✅ 完成 | 需求/资产/成本/组织 REST API |
| wsd_manager Web UI | ✅ 完成 | 基础仪表盘（暗色主题） |
| wsd_manager CLI（wsdm） | ✅ 完成 | sync/list/publish/ingest/teams |
| Docker 部署 | ✅ 完成 | docker-compose.yml + .env.example |
| AI 编码统计 | ✅ 完成 | git hook + PostToolUse hook 双路采集 |

### 差距分析：距离"生产可用"还缺什么

当前是**可演示的原型**，距离团队日常使用还有以下关键差距：

```
原型阶段        →  生产可用阶段
─────────────────────────────────────────────
Markdown 定义    →  经过实际使用验证的命令
hooks 脚本       →  经过边界测试的健壮脚本
单文件存储       →  支持并发的数据层
手动配置        →  一键安装 + 自动配置
无认证 API      →  RBAC 权限控制
单人演示        →  多人协作场景验证
```

---

## Phase 1：可用化（Minimum Viable Product）

**目标**：让一个真实团队能够日常使用，完整跑通一个需求的生命周期。  
**验收标准**：5个工程师的团队，连续2周使用 wsd 管理需求，无明显阻断问题。

### 1.1 端到端验证

**当前痛点**：命令的 Markdown 定义存在，但 Claude 实际执行时是否符合预期未经系统验证。

- [ ] **编写端到端测试脚本**：模拟完整的 PROPOSE → ARCHIVE 流程，验证每个阶段产出物格式正确
- [ ] **测试边界场景**：context 超限时的阻断行为、rollback 后的状态一致性、concurrent 两个需求时的冲突处理
- [ ] **修复验证中发现的问题**：Markdown 命令定义的歧义、状态机跳转的遗漏场景

### 1.2 CLAUDE.md 精炼

CLAUDE.md 是最关键的文件，它直接决定 Claude 的行为质量。

- [ ] **重写 wsd-lifecycle.md**：增加"1% 规则"（参考 Superpowers），确保 Claude 始终检查当前 wsd 状态
- [ ] **补充场景决策树**：覆盖更多用户说话方式（"帮我改一下这个接口" → 触发 quickfix 决策）
- [ ] **增加负面示例**：列举 Claude 不该做的事（不在没有规格时直接写代码、不自动推进阶段）

### 1.3 Hooks 健壮性

- [ ] **lifecycle-guard.js**：补充更多非法操作的检测（如直接修改 `.wsd/` 目录下的状态文件）
- [ ] **ai-code-tracker.js**：处理边界情况（大文件、二进制文件、符号链接）
- [ ] **ai-commit-analyzer.js**：处理 merge commit、空 commit、rebase 场景
- [ ] **context-monitor.js**：验证上下文百分比计算的准确性，与 Claude Code 实际行为对齐
- [ ] **session-inject.py**：测试 STATE.md 不存在时的优雅降级

### 1.4 安装体验

- [ ] **`install.sh` 错误处理**：Node.js 未安装时给出明确提示；`.git` 不存在时跳过 git hook 安装
- [ ] **`uninstall.sh`**：支持干净卸载，恢复原有 git hooks
- [ ] **安装验证脚本**：`verify-install.sh`，检查所有组件安装正确
- [ ] **首次使用引导**：安装后打印 "Getting Started" 引导，第一次 `/wsd:propose` 前的新手提示

### 1.5 wsd_manager 基础稳定性

- [ ] **并发安全**：当前 JSON 文件存储无并发锁，多人同时写入会损坏数据 → 加文件锁或迁移到 SQLite
- [ ] **数据备份**：`wsd-data/` 目录的定期备份脚本
- [ ] **健康检查增强**：`/api/health` 增加数据文件完整性检查

---

## Phase 2：团队协作

**目标**：支持 5-20 人的工程团队日常协作，多人同时推进多个需求。  
**验收标准**：一个完整项目周期（约1个月）内，所有需求通过 wsd 管理，wsd_manager 看板准确反映状态。

### 2.1 多人协作场景

- [ ] **需求分配**：`/wsd:assign REQ-xxx weizhen`，需求负责人记录到 meta.json
- [ ] **并发需求隔离**：同一仓库多个人同时推进不同需求，`STATE.md` 支持多活跃需求展示
- [ ] **@mention 通知**：状态变更时通过飞书/Slack 通知相关人员（`notify_on: ["spec_approve", "done"]`）
- [ ] **需求评论**：`/wsd:comment REQ-xxx 这个规格还需要补充异常场景`，记录到 meta.json

### 2.2 外部系统真正打通

当前 Jira/飞书适配器只是骨架，需要完整实现：

- [ ] **Jira 双向同步**：需求状态变更 → 更新 Jira Story 状态；Jira 评论 → 同步到 wsd
- [ ] **飞书任务同步**：飞书任务创建 → 自动 `/wsd:propose`；wsd DONE → 飞书任务完成
- [ ] **飞书多维表格**：将需求看板数据同步到飞书多维表格，供非技术人员查看
- [ ] **Webhook 配置 UI**：在 wsd_manager Web UI 中配置集成，而非手动改 config.json

### 2.3 权限控制

- [ ] **RBAC 实现**：developer/tech-lead/admin 三级权限，强制在 API 层校验
- [ ] **权限校验 hook**：`lifecycle-guard.js` 增加权限检查（当前只检查状态合法性）
- [ ] **操作者记录**：所有状态变更记录操作者 git 用户名，而非"unknown"
- [ ] **wsd_manager 登录**：Web UI 增加基础认证（JWT 或 OAuth），防止未授权访问

### 2.4 需求看板增强

- [ ] **wsd_manager Web UI**：需求看板支持拖拽改变状态（Kanban 视图）
- [ ] **过滤与搜索**：按团队/负责人/状态/时间筛选需求
- [ ] **需求详情页**：点击需求查看完整 proposal.md、tasks.md、audit 日志
- [ ] **周报生成**：`/wsd:report --week`，汇总本周需求进展，推送到飞书群

### 2.5 wsd_manager 资产管理完善

- [ ] **组织树 CRUD**：Web UI 支持增加/删除/重命名组织节点
- [ ] **资产版本化**：每次编辑创建新草稿版本，`publish` 后新版本才对订阅者可见
- [ ] **资产搜索**：按名称/类型/标签搜索资产
- [ ] **资产预览**：在 Web UI 中预览 agent/skill 的 Markdown 内容

---

## Phase 3：企业级管控

**目标**：满足企业安全、合规、成本管理要求，支持跨团队（50人+）使用。

### 3.1 安全与合规

- [ ] **审计日志不可篡改**：当前 `.jsonl` 文件可被手动修改 → 增加 HMAC 签名或迁移到 append-only 存储
- [ ] **敏感信息脱敏**：审计日志中的 API token、密码等自动脱敏
- [ ] **数据驻留**：支持配置数据只存储在指定地域（企业合规需求）
- [ ] **MCP 白名单**：企业层可以配置允许使用的 MCP 服务器白名单，通过 lifecycle-guard 强制
- [ ] **AI 模型白名单**：企业可以限制只能使用特定模型（如禁止发送代码到第三方云端模型）

### 3.2 企业内部 LLM 适配

- [ ] **LLM 网关接口**：`modelRouting.fallback` 实现真正的 HTTP 代理，转发到企业内部模型
- [ ] **流式响应**：内部 LLM 支持流式返回，避免长时间等待
- [ ] **模型质量评估**：对比内部模型与 Claude 的输出质量（在 wsd-verifier 阶段评分）

### 3.3 成本管理

- [ ] **Token 预算**：为每个需求/团队设置 Token 配额，超限时告警
- [ ] **成本仪表盘**：Web UI 展示按需求/团队/时间维度的成本分析
- [ ] **ROI 报告**：AI 编码统计 + Token 成本 → 自动生成"AI 投入产出分析"报告
- [ ] **异常成本告警**：单个需求 Token 消耗超过阈值时，邮件/飞书通知负责人

### 3.4 大规模部署

- [ ] **高可用部署**：wsd_manager 支持多实例部署（当前单进程）
- [ ] **数据迁移**：从 JSON 文件迁移到 PostgreSQL（50人以上团队的数据量需求）
- [ ] **LDAP/SSO 集成**：用户身份对接企业 LDAP 或 SSO（而非手动在 wsd_manager 创建用户）
- [ ] **GitLab CI 集成**：GitLab MR 创建时自动检查是否有对应 wsd 需求，未关联的 MR 不允许合并

---

## Phase 4：AI 能力深化

**目标**：让 WSD 不只是流程管理工具，而是能从使用中学习、持续优化的智能系统。

### 4.1 自动学习机制

- [ ] **`/wsd:learn`** — 从已归档需求中提炼高频技术方案
  ```
  /wsd:learn --from=archive --pattern=auth
  → 分析过去3个月所有认证相关需求的实现
  → 生成团队专属 skill：auth-patterns.md
  → 推送到 wsd_manager 团队资产库
  ```

- [ ] **`/wsd:scan`** — 扫描存量代码库，生成技术债务需求
  ```
  /wsd:scan --focus=security
  → 调用 security-reviewer agent 扫描代码库
  → 将发现的问题自动创建为 WSD 需求提案
  → 按严重程度排序，推送到 wsd_manager 看板
  ```

- [ ] **规格质量反馈**：在 ARCHIVED 时，wsd-verifier 评分"这次规格的质量"（场景覆盖率、歧义程度），汇总后指导团队改进规格写作

### 4.2 代码库上下文增强

- [ ] **代码库地图**：`/wsd:map`，调用 code-explorer 生成当前项目的架构概览，存入 `.wsd/knowledge/`
- [ ] **相关需求关联**：提案时自动检测与历史需求的关联（如"登录"功能相关的历史 REQ），注入上下文
- [ ] **commit trailers**：wsd-executor 提交时增加结构化 trailers（Constraint/Reasoning/Confidence），提升代码库可审计性

### 4.3 跨平台适配

- [ ] **Cursor 适配**：生成 `.cursor/rules/` 和 Cursor 专用命令，让 Cursor 用户也能使用 WSD 流程
- [ ] **VS Code 插件**：WSD 状态栏原生显示在 VS Code 状态栏，需求状态一目了然
- [ ] **Web IDE 支持**：适配 Cloud IDE（如 Replit、GitHub Codespaces）的 CLAUDE.md 注入机制

### 4.4 团队智能

- [ ] **交付预测**：基于历史需求数据，预测新需求的交付时间（类似 JIRA Smart Estimation）
- [ ] **瓶颈识别**：分析哪个阶段耗时最长（Propose? Plan? Verify?），指导流程优化
- [ ] **AI 接受率趋势**：展示团队 AI 接受率的变化趋势，判断"AI 是否越来越能理解团队代码风格"

---

## 优先级总览

```
优先级矩阵（重要性 × 紧迫性）

P0（立即）：
  ✦ 端到端验证 + 问题修复
  ✦ lifecycle-guard 权限校验
  ✦ wsd_manager 并发安全（文件锁）
  ✦ ai-commit-analyzer 边界处理

P1（Phase 1 内）：
  ✦ install.sh 错误处理 + uninstall.sh
  ✦ CLAUDE.md / wsd-lifecycle.md 精炼
  ✦ Jira/飞书双向同步真正实现
  ✦ wsd_manager RBAC

P2（Phase 2 内）：
  ✦ 多人协作场景
  ✦ 资产版本化
  ✦ 成本仪表盘
  ✦ 周报生成

P3（Phase 3-4）：
  ✦ 高可用部署
  ✦ /wsd:learn 自动学习
  ✦ Cursor 跨平台适配
  ✦ 交付预测
```

---

## 技术债务清单

当前代码中已知的技术债务，需在 Phase 1-2 期间偿还：

| 问题 | 位置 | 影响 | 修复优先级 |
|------|------|------|----------|
| JSON 文件无并发锁 | `wsd_manager/src/core/*.js` | 多人同时写入数据损坏 | P0 |
| ai-stats-calculator 的 limit:0 bug | `costs.js:86` | 统计数据不准 | P0 |
| `getStats` 重复加载文件 | `costs.js:88` | 性能问题 | P1 |
| 审计日志可篡改 | `.wsd/audit/*.jsonl` | 合规风险 | P1 |
| session-inject.py 无错误重试 | `hooks/session-inject.py` | 网络抖动时状态注入失败 | P1 |
| ai-commit-analyzer 忽略 merge commit | `hooks/ai-commit-analyzer.js` | 统计不准确 | P1 |
| STATE.md 只支持单活跃需求 | `wsd/CLAUDE.md` | 多需求并行时状态混乱 | P2 |
| wsd_manager Web UI 无分页 | `web/public/index.html` | 需求多时页面卡顿 | P2 |

---

## 成为完善系统的定义

满足以下条件，即可认为 WSD 达到"完善可用"状态：

### 功能完备性
- [ ] 一个真实团队（5-20人）连续使用3个月，无严重阻断问题
- [ ] 完整 PROPOSE → ARCHIVE 流程耗时 < 5 分钟的用户操作（不含 AI 执行时间）
- [ ] AI 编码统计数据被团队实际用于复盘和改进

### 稳定性
- [ ] wsd_manager 服务 SLA ≥ 99%（允许每月约 7 小时宕机）
- [ ] git hook 失败不影响正常 git 操作（100% 异步，0 阻断）
- [ ] 单个需求数据损坏不影响其他需求（数据隔离）

### 可运维性
- [ ] 新成员入职安装 WSD 耗时 < 10 分钟
- [ ] 出现问题时，运维人员能在 30 分钟内定位根因（完整日志）
- [ ] 版本升级不破坏现有 `.wsd/` 数据（向后兼容）

### 可衡量的业务价值
- [ ] 能够回答："AI 编码在我们团队的实际接受率是多少？"
- [ ] 能够回答："每个需求平均消耗多少 Token？成本是否在预算内？"
- [ ] 能够回答："哪个阶段是我们团队的瓶颈？"
