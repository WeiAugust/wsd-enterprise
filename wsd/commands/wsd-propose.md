---
description: 创建需求提案 — 启动深度访谈，生成结构化提案文档
---

# /wsd:propose

**用法**：`/wsd:propose <需求简述>`

**参数**：
- `$ARGUMENTS`：需求的一句话描述（可以很粗略，AI会帮助细化）

## 执行流程

### Step 1 — 初始化检查

检查 `.wsd/` 目录是否存在：
- 不存在：询问用户是否初始化当前项目的 wsd 管理（`/wsd:init`）
- 存在：读取 `.wsd/config.json` 获取项目配置

### Step 2 — 生成需求 ID

格式：`REQ-YYYYMMDD-NNN`（NNN 从 001 开始，当天自增）

读取 `.wsd/requirements/` 下已有目录，计算今日最大序号 + 1。

### Step 3 — 深度访谈（调用 wsd-analyst 代理）

启动 `wsd-analyst` 子代理，传入原始需求描述，要求进行 **苏格拉底式澄清**，最多5轮提问，每轮最多3个问题，聚焦：

1. **用户与场景**：这个需求的用户是谁？在什么场景下使用？
2. **验收标准**：如何判断这个需求"做完了"？用具体例子说明。
3. **边界与约束**：哪些情况明确不在范围内？有什么技术/业务约束？
4. **优先级与风险**：最核心的功能是什么？有哪些已知风险？
5. **依赖关系**：依赖哪些现有功能或外部系统？

访谈完成后，生成结构化 `proposal.md`。

### Step 4 — 创建需求目录

```
.wsd/requirements/<req-id>/
├── proposal.md      ← 本次生成
└── meta.json        ← 初始化状态
```

`meta.json` 初始内容：
```json
{
  "reqId": "<req-id>",
  "title": "<从proposal.md提取>",
  "status": "PROPOSED",
  "phase": 1,
  "owner": "<git config user.name>",
  "createdAt": "<ISO timestamp>",
  "updatedAt": "<ISO timestamp>",
  "tags": [],
  "externalRef": null
}
```

### Step 5 — 更新全局状态

更新 `.wsd/STATE.md`，在活跃需求列表中添加本条记录。

### Step 6 — 展示结果

展示生成的 `proposal.md` 完整内容，并提示下一步：
```
✅ 需求提案已创建：REQ-YYYYMMDD-NNN
📁 位置：.wsd/requirements/REQ-YYYYMMDD-NNN/proposal.md

下一步：
  /wsd:spec REQ-YYYYMMDD-NNN  — 生成行为规格（BDD格式）
  /wsd:show REQ-YYYYMMDD-NNN  — 查看提案详情
```

## 产物格式 — proposal.md

```markdown
# REQ-YYYYMMDD-NNN: <需求标题>

> 状态：PROPOSED | 创建：YYYY-MM-DD | 负责人：<owner>

## 背景与动机

<为什么需要这个功能？解决什么问题？>

## 目标用户

<具体描述目标用户群体，及其使用场景>

## 核心功能范围（In Scope）

- [ ] 功能点1
- [ ] 功能点2
- [ ] 功能点3

## 明确不包含（Out of Scope）

- 不包含：XXX（原因：YYY）

## 验收标准（草稿）

| 场景 | 期望结果 |
|------|---------|
| 正常流程 | ... |
| 边界情况 | ... |
| 错误处理 | ... |

## 技术约束

- 约束1
- 约束2

## 依赖关系

- 依赖模块/系统：XXX
- 外部API：XXX

## 风险与假设

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|---------|
| 风险1 | 中 | 高 | ... |

## 外部引用

- Jira：（如有）
- 设计稿：（如有）
- 需求文档：（如有）
```

## 错误处理

- 需求描述为空：提示用户输入描述
- `.wsd/` 不存在：引导用户运行 `/wsd:init`
- 已有同名需求：展示冲突，询问是创建新的还是更新已有
