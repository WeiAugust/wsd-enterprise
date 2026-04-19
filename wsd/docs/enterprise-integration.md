# WSD 企业生态集成指南

> 快速接入公司内部技术栈：代码托管、CI/CD、部署、项目管理、监控、LLM 网关

---

## 一、配置入口

所有集成在 `.wsd/config.json` 的 `integrations` 节点配置，敏感凭据**只放环境变量**，不写入文件。

```json
{
  "integrations": {
    "codeHosting": { "type": "gitlab", ... },
    "cicd": { "type": "jenkins", ... },
    "projectMgmt": { "type": "feishu", ... },
    "deployment": { "type": "kubernetes", ... },
    "monitoring": { "type": "prometheus", ... },
    "llmGateway": { "endpoint": "...", ... },
    "notify": { "type": "dingtalk", ... }
  }
}
```

---

## 二、代码托管（GitLab 优先）

```json
"codeHosting": {
  "type": "gitlab",
  "baseUrl": "https://gitlab.company.com",
  "project": "group/repo",
  "tokenEnv": "GITLAB_TOKEN",
  "defaultBranch": "main",
  "mrTemplate": ".gitlab/merge_request_templates/wsd.md",
  "syncBack": {
    "createMR": true,        // wsd:execute 完成后自动创建 MR
    "mrTitlePrefix": "[WSD]",
    "assignReviewer": true   // 根据 meta.json owner 指定 reviewer
  }
}
```

**wsd 触发时机**：
- `wsd:execute` 完成 → 自动创建 MR，标题含需求 ID
- `wsd:verify` 通过 → 自动在 MR 上添加 verified 标签
- `wsd:archive` → 合并 MR，关闭关联 issue

**GitHub / Gitee / Gerrit**：将 `type` 改为 `github` / `gitee` / `gerrit`，其余字段同理。

---

## 三、CI/CD 集成

### Jenkins

```json
"cicd": {
  "type": "jenkins",
  "baseUrl": "https://jenkins.company.com",
  "tokenEnv": "JENKINS_TOKEN",
  "triggerOnExecuteComplete": {
    "job": "project-name/build",
    "waitForResult": false   // 异步触发，不阻塞 wsd
  },
  "failureHook": "wsd:block {reqId} CI构建失败: {buildUrl}"
}
```

### GitLab CI / GitHub Actions

```json
"cicd": {
  "type": "gitlab-ci",
  "pipelineVar": "WSD_REQ_ID",  // 注入到 pipeline 的环境变量
  "triggerOnExecuteComplete": true
}
```

**wsd 触发逻辑**：
- 每个 task 完成后 → 触发增量 CI（单模块测试）
- `wsd:execute` 全部完成 → 触发完整 CI pipeline
- CI 失败 → 自动调用 `wsd:block <req-id> CI失败`，附带失败日志链接

---

## 四、部署集成

### Kubernetes / ArgoCD

```json
"deployment": {
  "type": "argocd",
  "baseUrl": "https://argocd.company.com",
  "tokenEnv": "ARGOCD_TOKEN",
  "appName": "my-service",
  "environments": {
    "dev":  { "autoSync": true  },
    "stg":  { "autoSync": false, "requireApproval": "team-lead" },
    "prod": { "autoSync": false, "requireApproval": "dept-admin" }
  }
}
```

**触发逻辑**：
- `wsd:verify` 通过 → 触发 dev 环境自动部署
- `wsd:archive` → 提示 stg/prod 部署，需要对应权限审批

### Helm / 自定义脚本

```json
"deployment": {
  "type": "script",
  "deployScript": ".wsd/scripts/deploy.sh",
  "envVars": { "DEPLOY_ENV": "dev", "WSD_REQ_ID": "{reqId}" }
}
```

---

## 五、项目管理系统

### 飞书（优先）

```json
"projectMgmt": {
  "type": "feishu",
  "appId": "cli_xxxx",
  "appSecretEnv": "FEISHU_APP_SECRET",
  "spaceId": "xxxx",
  "docSyncEnabled": true,    // 规格文档同步到飞书文档
  "taskSyncEnabled": true,   // tasks.md 同步到飞书任务
  "statusMapping": {
    "PROPOSED":      "待评审",
    "SPEC_APPROVED": "规格确认",
    "EXECUTING":     "开发中",
    "VERIFYING":     "验收中",
    "DONE":          "已完成"
  },
  "notifyOnPhaseChange": true  // 阶段变更时飞书消息通知
}
```

**双向同步**：
- `wsd:propose` → 在飞书创建任务，附 WSD 链接
- 飞书任务状态变更 → 通过 webhook 同步到 wsd（需配置飞书事件订阅）
- `wsd:spec` 完成 → 规格文档推送到飞书 wiki

### Jira

```json
"projectMgmt": {
  "type": "jira",
  "baseUrl": "https://company.atlassian.net",
  "project": "PROJ",
  "apiTokenEnv": "JIRA_API_TOKEN",
  "issueTypeMapping": {
    "default": "Story",
    "hotfix": "Bug",
    "quickfix": "Task"
  }
}
```

### 禅道

```json
"projectMgmt": {
  "type": "zentao",
  "baseUrl": "https://zentao.company.com",
  "tokenEnv": "ZENTAO_TOKEN",
  "productId": "1"
}
```

---

## 六、监控集成

```json
"monitoring": {
  "type": "prometheus",
  "pushgatewayUrl": "https://pushgateway.company.com",
  "metrics": {
    "wsd_req_phase_duration_seconds": true,   // 每阶段耗时
    "wsd_req_total":                  true,   // 需求总数（按状态）
    "wsd_bugfix_total":               true,   // bug 数量
    "wsd_context_usage_percent":      true    // 上下文使用率
  },
  "labels": {
    "team": "{team}",
    "project": "{project}"
  }
}
```

Grafana Dashboard 示例（import JSON）见 `wsd/docs/grafana-dashboard.json`（待创建）。

---

## 七、企业内部 LLM 网关

```json
"llmGateway": {
  "endpoint": "https://llm-gateway.company.com/v1",
  "apiKeyEnv": "COMPANY_LLM_KEY",
  "modelMapping": {
    "claude-opus-4-6":   "company-opus-proxy",
    "claude-sonnet-4-6": "company-sonnet-proxy"
  },
  "timeout": 120000,
  "retries": 2
}
```

在 `settings.json` 中的 `modelOverrides` 配合使用：

```json
{
  "modelOverrides": {
    "wsd-analyst":   { "model": "company-opus-proxy",   "endpoint": "https://llm-gateway.company.com/v1" },
    "wsd-executor":  { "model": "company-sonnet-proxy",  "endpoint": "https://llm-gateway.company.com/v1" }
  }
}
```

支持的网关类型：AWS Bedrock、Azure OpenAI、内部反向代理（兼容 Anthropic API 格式）。

---

## 八、通知集成

```json
"notify": {
  "channels": [
    {
      "type": "dingtalk",
      "webhookEnv": "DINGTALK_WEBHOOK",
      "events": ["PHASE_CHANGE", "BLOCKED", "HOTFIX_STARTED", "VERIFY_FAIL"]
    },
    {
      "type": "wecom",
      "webhookEnv": "WECOM_WEBHOOK",
      "events": ["HOTFIX_STARTED", "VERIFY_FAIL"]
    },
    {
      "type": "email",
      "smtpEnv": "SMTP_URL",
      "recipients": ["team-lead@company.com"],
      "events": ["ARCHIVE"]
    }
  ]
}
```

---

## 九、制品仓库（私有 npm/Maven/PyPI）

在 `wsd-executor` 执行任务前自动配置：

```json
"artifactRegistry": {
  "npm": {
    "registry": "https://nexus.company.com/repository/npm/",
    "tokenEnv": "NPM_TOKEN"
  },
  "maven": {
    "settingsTemplate": ".wsd/templates/maven-settings.xml"
  },
  "pypi": {
    "indexUrl": "https://nexus.company.com/repository/pypi/simple/"
  }
}
```

`wsd-executor` 在写入代码前自动注入 `.npmrc` / `pip.conf`，避免开发者手动配置。

---

## 十、快速集成检查清单

```
□ .wsd/config.json 已配置 integrations
□ 敏感凭据在 .env 或 Secret Manager（不在 config.json 中）
□ .wsd/config.json 已加入 .gitignore 中的敏感字段排除（见 gitignore 模板）
□ 代码托管 webhook 已配置（用于状态双向同步）
□ CI 失败时自动 wsd:block 已测试
□ LLM 网关连通性已验证（wsdm doctor 命令）
□ 通知渠道已测试（wsdm test-notify）
```

运行集成健康检查：

```bash
wsdm doctor              # 检查所有集成的连通性
wsdm doctor --fix        # 自动修复可修复的问题
wsdm test-notify         # 发送测试通知
```
