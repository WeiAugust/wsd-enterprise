---
description: 从已归档需求中提炼高频方案，自动生成团队专属 Skill
argument-hint: [--from=<req-id|all>] [--output=<skill-name>]
---

# /wsd:learn — 从实践中学习，生成团队 Skill

## 用途

分析已归档的 WSD 需求（`.wsd/requirements/*/` 状态为 ARCHIVED），提炼高频出现的：
- 技术方案模式（重复使用的架构决策）
- 实现片段（跨多个需求复用的代码结构）
- 验收标准模板（相似功能的验收条件集合）
- 调试策略（bug 修复中反复有效的排查方法）

输出可直接安装使用的 `.claude/skills/` 技能文件，供团队共享。

## 执行流程

### 第一阶段：归档需求分析（wsd-analyst 代理）

```
遍历 .wsd/requirements/*/meta.json（status === 'ARCHIVED'）
读取每个需求的：
  - proposal.md（背景和目标）
  - design.md（技术方案）
  - tasks.md（任务分解）
  - functional.md（功能规格）
  - .wsd/audit/*.jsonl（操作历史）
提取：
  - 技术栈选择和理由
  - 重复出现的代码模式
  - 验收标准的通用部分
  - Bug 类型和修复方案
```

### 第二阶段：模式识别

识别以下模式（出现 ≥3 次即视为"高频"）：

| 模式类型 | 例子 |
|--------|------|
| 架构模式 | 每次新增 API 都遵循 controller-service-repository 三层 |
| 验证模式 | 用户输入统一用 Zod schema 验证 |
| 错误处理 | API 错误统一封装为 `{ code, message, data }` |
| 测试模式 | 集成测试统一使用 testcontainers 启动 DB |
| 部署模式 | 每次发布前运行 db:migrate + smoke test |

### 第三阶段：Skill 生成

对每个高频模式生成一个 Skill 文件：

```markdown
---
name: <团队前缀>-<模式名>
description: <一行描述，供 Claude 判断相关性>
origin: wsd-learn
generatedAt: <timestamp>
sourceReqs: [REQ-xxx, REQ-yyy, ...]
---

# When to Activate
...（何时触发此技能）

# Pattern
...（具体的实现模式，包含代码示例）

# Examples from Archived Requirements
...（真实需求中的使用案例）
```

输出到：`.wsd/generated-skills/<skill-name>.md`

### 第四阶段：安装确认

```
生成摘要：
  发现 5 个高频模式：
  1. api-error-handling（出现 8 次）→ .wsd/generated-skills/api-error-handling.md
  2. zod-validation（出现 6 次）→ .wsd/generated-skills/zod-validation.md
  3. testcontainers-db（出现 5 次）→ .wsd/generated-skills/testcontainers-db.md
  4. three-tier-api（出现 4 次）→ .wsd/generated-skills/three-tier-api.md
  5. smoke-test-deploy（出现 3 次）→ .wsd/generated-skills/smoke-test-deploy.md

  安装到 ~/.claude/skills/ 供本机使用？(y/n)
  还是发布到 wsd_manager 供团队共享？(wsdm publish)
```

## 使用示例

```bash
# 从所有归档需求学习
/wsd:learn

# 从指定需求学习
/wsd:learn --from=REQ-20260310-001,REQ-20260315-002

# 生成并立即安装到本地
/wsd:learn --install

# 生成并发布到 wsd_manager
/wsd:learn --publish
```

## 与 wsd_manager 集成

生成的 Skill 文件可以通过 `wsdm publish` 上传到 wsd_manager，作为团队资产供所有成员订阅。

这实现了"从实践中沉淀 → 转化为团队标准"的知识管理闭环。

## 注意

- 只分析 ARCHIVED 状态的需求（已完成交付的才有参考价值）
- 模式识别基于文本相似度，生成的 Skill 需人工审核后再共享
- 运行频率建议：每 Sprint 结束时运行一次
