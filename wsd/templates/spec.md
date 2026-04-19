# 规格文档：{{FEATURE_NAME}}

> 需求：{{REQ_ID}} | 版本：1.0.0 | 状态：draft
> 创建时间：{{CREATED_AT}} | 作者：{{AUTHOR}}

---

## Feature: {{FEATURE_NAME}}

<!--
本文档采用 BDD（行为驱动开发）格式描述功能规格。
每个 Scenario 对应一个测试用例的来源。
格式：GIVEN（前置条件）/ WHEN（用户操作）/ THEN（预期结果）
-->

### Scenario 1: 正常流程（Happy Path）

**GIVEN** 用户已登录系统
**AND** ...前置条件...

**WHEN** 用户执行...操作

**THEN** 系统应当...
**AND** ...附加断言...

---

### Scenario 2: 边界情况

**GIVEN** ...

**WHEN** ...

**THEN** ...

---

### Scenario 3: 错误处理

**GIVEN** ...异常前置条件...

**WHEN** 用户执行...操作

**THEN** 系统应当返回错误提示：...
**AND** 系统应当保持数据一致性

---

## 验收标准（Acceptance Criteria）

| ID | 标准 | 优先级 | 测试方式 |
|----|------|--------|---------|
| AC-01 | | must | 自动化 |
| AC-02 | | must | 自动化 |
| AC-03 | | should | 手动 |

## 非功能需求

### 性能
- 响应时间：（P99 < Xms）
- 并发数：
- 数据规模：

### 安全
- 认证要求：
- 授权范围：
- 数据脱敏：

### 可用性
- SLA：

## 测试覆盖要求

- [ ] 单元测试覆盖核心逻辑（>80%）
- [ ] 集成测试覆盖 API 端点
- [ ] E2E 测试覆盖主流程（Scenario 1）
- [ ] 边界场景手动验证

## 数据流（可选）

```
用户 → API → 业务逻辑 → 数据库
             ↓
         外部服务
```

## 接口契约（可选）

### 请求
```
{{METHOD}} {{PATH}}
Content-Type: application/json

{
  "field": "value"
}
```

### 响应
```json
{
  "success": true,
  "data": {}
}
```

---

*此文件由 `/wsd:spec` 命令生成，经 wsd-analyst 基于 proposal.md 自动生成*
*审批后状态变更为 `approved`，不得再修改*
