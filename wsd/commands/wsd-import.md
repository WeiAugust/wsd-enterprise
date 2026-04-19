---
description: 从外部系统导入需求 — 支持Jira/飞书/GitHub Issues，自动转换为WSD格式
---

# /wsd:import

**用法**：`/wsd:import <source> <id>`

**参数**：
- `source`：数据源类型，支持 `jira` / `feishu` / `github` / `linear`
- `id`：外部系统中的需求ID

**示例**：
```
/wsd:import jira PROJ-123
/wsd:import feishu ABC123xyz
/wsd:import github 456
/wsd:import linear ENG-789
```

## 前置条件

`.wsd/config.json` 中已配置对应数据源的连接信息：

```json
{
  "integrations": {
    "jira": {
      "baseUrl": "https://company.atlassian.net",
      "project": "PROJ",
      "apiTokenEnv": "JIRA_API_TOKEN"
    },
    "feishu": {
      "appId": "cli_xxxx",
      "appSecretEnv": "FEISHU_APP_SECRET",
      "spaceId": "xxxx"
    },
    "github": {
      "repo": "owner/repo"
    }
  }
}
```

## 执行流程

### Step 1 — 拉取外部需求数据

根据配置，调用对应API获取需求详情：

**Jira**：`GET /rest/api/3/issue/<id>` 提取 summary, description, acceptance criteria, labels

**飞书**：调用飞书文档/任务API，提取标题、描述、需求背景

**GitHub Issues**：`GET /repos/<owner>/<repo>/issues/<id>` 提取 title, body, labels

### Step 2 — AI 转换为 WSD 格式

调用 `wsd-analyst` 代理，将外部需求文本转换为：
- `proposal.md` 格式（结构化范围文档）
- 自动推断 tags 和技术约束

转换过程中，AI会：
- 识别验收标准（如果原始需求有的话）
- 识别依赖关系
- 标记信息不完整的字段，供后续补充

### Step 3 — 交互式确认

展示转换结果，询问：
```
📥 已从 Jira PROJ-123 导入需求

标题：用户认证系统重构
转换质量：✅ 信息完整

以下字段需要补充（原始需求中未明确）：
  - 验收标准（目前为空）
  - 技术约束（目前为空）

选项：
  1. 接受并保存（后续通过 /wsd:spec 补充）
  2. 立即补充（启动深度访谈）
  3. 取消
```

### Step 4 — 创建需求目录

与 `/wsd:propose` 相同，但 `meta.json` 中额外记录：
```json
{
  "externalRef": {
    "type": "jira",
    "id": "PROJ-123",
    "url": "https://company.atlassian.net/browse/PROJ-123",
    "syncedAt": "2026-04-14T09:00:00Z"
  }
}
```

## 双向同步

如在 `config.json` 中启用 `syncBack: true`，WSD 阶段变更时会同步更新外部系统状态：

| WSD 状态 | Jira 状态 | 飞书状态 |
|---------|----------|---------|
| PROPOSED | In Progress | 进行中 |
| SPEC_APPROVED | In Progress | 规格确认 |
| EXECUTING | In Progress | 开发中 |
| DONE | Done | 已完成 |
| ARCHIVED | Closed | 已归档 |
