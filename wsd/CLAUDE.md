# WSD — 需求生命周期管理插件

> 企业级 Claude Code 插件，打通从"一句需求"到"可验证交付"的完整链路

## 核心原则

**规范先行（Spec-First）**：若 `.wsd/` 存在，任何代码实现必须先有对应规格。未找到规格的实现请求，引导用户先创建规格（小改动用 `/wsd:quickfix`）。

**人机确认关卡（Human Gates）**：每个阶段完成后必须等待人工确认。禁止自动推进阶段。

**上下文隔离（Context Isolation）**：每个实现任务在独立子代理中执行，防止 Context Rot。上下文 >60% 发出警告，>80% 阻止新任务启动。

**变更可追溯**：所有需求变更（amend/bugfix/hotfix）记录到 meta.json 的 amendments/bugs 数组，归档时计入质量指标。

## 状态感知

会话启动时，如果 `.wsd/STATE.md` 存在，展示活跃需求摘要和下一步操作。

## 完整状态机

```
── 标准流程 ──────────────────────────────────────────────────────────
PROPOSED ──/wsd:spec──> SPECCING ──[确认]──> SPEC_APPROVED
    ──/wsd:plan──> PLANNING ──[确认]──> PLAN_APPROVED
    ──/wsd:execute──> EXECUTING ──[阻塞]──> BLOCKED
                                ──[完成]──> IMPLEMENTED
    ──/wsd:verify──> VERIFYING ──[bug]──> BUGFIX ──[修复]──> VERIFYING
                               ──[通过]──> DONE
    ──/wsd:archive──> ARCHIVED

── 快速通道 ──────────────────────────────────────────────────────────
PROPOSED ──/wsd:quickfix──> QUICK_EXECUTING ──> QUICK_DONE
HOT-xxx  ──/wsd:hotfix──> HOTFIX_EXECUTING ──> HOTFIX_DONE

── 变更流程 ──────────────────────────────────────────────────────────
任意阶段 ──/wsd:amend──> AMENDING ──> 回退到对应阶段继续
任意阶段 ──/wsd:cancel──> CANCELLED

── 回退 ──────────────────────────────────────────────────────────────
任意阶段 ──/wsd:rollback──> 上一阶段（需 team-lead 确认）
```

## 完整命令列表

### 主流程
| 命令 | 说明 | 权限 |
|------|------|------|
| `/wsd:propose <描述>` | 创建需求提案（深度访谈） | developer+ |
| `/wsd:spec [req-id]` | 生成 BDD 规格 | developer+ |
| `/wsd:review [req-id]` | 生成技术方案 | developer+ |
| `/wsd:plan [req-id]` | 拆解实现任务（≤2h/任务） | developer+ |
| `/wsd:execute [req-id] [task-id]` | 驱动分阶段实现 | developer+ |
| `/wsd:verify [req-id]` | 执行验收检查 | developer+ |
| `/wsd:archive [req-id]` | 归档已完成需求 | team-lead+ |

### 快速通道
| 命令 | 说明 | 权限 |
|------|------|------|
| `/wsd:quickfix <描述>` | 小改动快速通道（≤5文件，跳过规格） | developer+ |
| `/wsd:hotfix <描述>` | 生产紧急修复（最简流程） | developer+ |

### 变更管理
| 命令 | 说明 | 权限 |
|------|------|------|
| `/wsd:amend <req-id> <变更>` | 需求变更（自动分级M0-M4，决定回退深度） | developer+ |
| `/wsd:bugfix <req-id> <描述>` | 验收阶段 Bug 修复 | developer+ |
| `/wsd:cancel <req-id> <原因>` | 取消需求 | team-lead+ |
| `/wsd:rollback <req-id>` | 回退阶段 | team-lead+ |

### 状态与协作
| 命令 | 说明 | 权限 |
|------|------|------|
| `/wsd:status` | 需求看板（所有需求状态） | viewer+ |
| `/wsd:list [--status] [--owner]` | 需求列表（支持过滤） | viewer+ |
| `/wsd:show <req-id>` | 需求完整详情 | viewer+ |
| `/wsd:block <req-id> <原因>` | 标记阻塞 | developer+ |
| `/wsd:unblock <req-id>` | 解除阻塞 | developer+ |
| `/wsd:import <source> <id>` | 从 Jira/飞书/GitHub 导入 | developer+ |

## 场景决策树

用户提出改动时，按以下逻辑引导：

```
改动是什么类型？
├── 生产故障/安全漏洞       → /wsd:hotfix
├── 改动极小（≤5文件、清晰）→ /wsd:quickfix
├── 正在进行的需求有变化    → /wsd:amend <req-id>
├── 验收发现 bug            → /wsd:bugfix <req-id>
├── 需求不再需要            → /wsd:cancel <req-id>
└── 新功能/较大改动         → /wsd:propose
```

## 子代理调用策略

| 代理 | 模型 | 职责 |
|------|------|------|
| wsd-analyst | opus | 需求澄清、规格生成、变更影响分析 |
| wsd-architect | opus | 技术方案设计 |
| wsd-planner | sonnet | 任务拆解 |
| wsd-executor | sonnet | 代码实现（隔离执行） |
| wsd-reviewer | sonnet | 代码审查 |
| wsd-verifier | sonnet | 验收核查、bug 分类 |

企业内部 LLM 网关时，通过 `modelOverrides` 映射（见 templates/wsd-config.json）。

## 审计要求

每个阶段转换自动记录到 `.wsd/audit/<date>.jsonl`：操作类型、需求ID、操作者、时间戳、结果。热修复记录永久保留。
