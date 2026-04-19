# wsd_manager 知识内化：内部技术文档 → Claude 资产

> 让每位开发者的 Claude，天生了解公司内部技术栈

---

## 核心思路

企业内部有大量自研组件、内部框架、私有协议，这些知识散落在：
- 飞书 Wiki / Confluence 文档
- 内部 API Gateway 的 Swagger 文档
- 代码仓库的 README / 设计文档
- 架构委员会的规范文档

每次开发者用 Claude 开发时，都要手动粘贴这些文档解释背景。

`wsdm ingest` 解决这个问题：**一次内化，所有开发者永久受益**。

---

## 典型工作流

```
内部文档（飞书/Confluence/OpenAPI）
        ↓
   wsdm ingest <source>
        ↓
wsdm-knowledge-ingester 代理分析文档
        ↓
生成 skill/rule/agent 文件
        ↓
   发布到团队/部门注册中心
        ↓
团队所有开发者 wsdm sync 后自动获得
        ↓
Claude 开发时自动使用内部知识
```

---

## 命令参考

### `wsdm ingest` — 主命令

```bash
# 从飞书文档内化
wsdm ingest feishu <doc-url-or-id> \
  --layer team \
  --team backend-team \
  --asset-type skill           # 指定输出类型（默认自动判断）

# 从 Swagger/OpenAPI 内化
wsdm ingest openapi https://internal-api.company.com/swagger.json \
  --layer department \
  --dept engineering \
  --name use-payment-api

# 从 Confluence 内化
wsdm ingest confluence <page-id> \
  --layer enterprise

# 从 Git 仓库 README 内化
wsdm ingest git https://gitlab.company.com/infra/rpc-framework \
  --paths "docs/,README.md" \
  --name use-internal-rpc

# 批量内化（从配置文件）
wsdm ingest --batch .wsd/ingest-config.json
```

### `wsdm ingest` 批量配置格式

`.wsd/ingest-config.json`：

```json
{
  "sources": [
    {
      "type": "feishu",
      "id": "wiki_page_id_xxx",
      "name": "use-internal-mq",
      "layer": "enterprise",
      "assetType": "skill",
      "description": "内部消息队列 SDK 使用指南"
    },
    {
      "type": "openapi",
      "url": "https://user-service.internal/swagger.json",
      "name": "use-user-service",
      "layer": "department",
      "dept": "engineering",
      "assetType": "skill"
    },
    {
      "type": "confluence",
      "pageId": "12345678",
      "name": "security-standards",
      "layer": "enterprise",
      "assetType": "rule"
    },
    {
      "type": "gitlab",
      "project": "infra/config-center",
      "paths": ["docs/quick-start.md", "docs/api.md"],
      "name": "use-config-center",
      "layer": "team",
      "team": "backend-team",
      "assetType": "skill"
    }
  ]
}
```

运行批量内化：

```bash
wsdm ingest --batch .wsd/ingest-config.json --dry-run   # 预览
wsdm ingest --batch .wsd/ingest-config.json              # 执行
```

### `wsdm ingest refresh` — 更新已有资产

```bash
# 刷新特定资产（文档更新后重新内化）
wsdm ingest refresh use-payment-api

# 刷新所有超过 N 天未更新的资产
wsdm ingest refresh --older-than 30
```

---

## 输出资产示例

### 输入：内部消息队列 SDK 文档

文档摘要（飞书 Wiki）：
- 内部 MQ 基于 Kafka 封装，但 API 不同
- 必须注册 topic，不能直接发
- 消息体需包含 traceId（取自请求上下文）
- 消费者必须实现幂等（框架不保证去重）

**生成的 skill** (`use-internal-mq.md`)：

```markdown
---
name: use-internal-mq
description: 使用内部消息队列时触发 — 发送消息、注册消费者、处理消费逻辑
---

# 内部 MQ 使用指南

## When to Use
- 需要异步发送消息时
- 需要注册消息消费者时

## ⚠️ 内部约束（与开源 Kafka 的关键区别）

1. **必须先注册 topic**，不能直接调用 send（会报 TOPIC_NOT_REGISTERED 错误）
2. **消息体必须包含 traceId**，从 `RequestContext.getTraceId()` 获取
3. **消费者必须幂等**，框架不保证去重，需用消息ID做业务幂等

## 标准发送模式

\`\`\`typescript
import { MQClient } from '@company/mq-sdk';
import { RequestContext } from '@company/context';

// 注册（只在模块初始化时做一次）
MQClient.registerTopic('user.registered', { schema: UserRegisteredEvent });

// 发送
await MQClient.send('user.registered', {
  traceId: RequestContext.getTraceId(),  // 必填！
  payload: { userId, email }
});
\`\`\`

## 标准消费模式

\`\`\`typescript
@MQConsumer('user.registered', { group: 'notification-service' })
class UserRegisteredHandler {
  async handle(msg: MQMessage<UserRegisteredEvent>) {
    // 幂等检查（必须！）
    if (await this.isProcessed(msg.messageId)) return;

    await this.sendWelcomeEmail(msg.payload);
    await this.markProcessed(msg.messageId);
  }
}
\`\`\`

## 常见错误

| 错误 | 原因 | 修复 |
|------|------|------|
| TOPIC_NOT_REGISTERED | 未注册就发送 | 在 Module 初始化时注册 |
| MISSING_TRACE_ID | 忘记传 traceId | 从 RequestContext 获取 |
| 消息重复处理 | 未做幂等 | 用 messageId 做业务去重 |
```

---

## 企业知识资产目录建议

内化后，建议按以下结构组织注册中心资产：

```
registry/enterprise/
├── skills/
│   ├── use-internal-rpc.md        # 内部 RPC 框架
│   ├── use-internal-mq.md         # 内部消息队列
│   ├── use-config-center.md       # 配置中心
│   ├── use-service-mesh.md        # 服务网格
│   └── use-data-platform.md       # 数据平台接入
├── rules/
│   ├── security-standards.md      # 安全规范
│   ├── api-design-standards.md    # API 设计规范
│   └── logging-standards.md       # 日志规范
└── agents/
    └── infra-specialist.md        # 基础设施专家（复杂场景）
```

开发者 `wsdm sync` 后，这些资产自动进入 `~/.claude/skills/` 和 `~/.claude/rules/`，Claude 在相关场景中自动使用。

---

## 持续更新

```bash
# 定期刷新（加入团队 CI/CD）
# .gitlab-ci.yml
refresh-claude-assets:
  schedule: "0 9 * * 1"   # 每周一早上9点
  script:
    - wsdm ingest refresh --older-than 7
    - wsdm publish-all --layer enterprise
```
