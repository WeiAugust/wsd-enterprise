---
description: 执行验收检查 — 对照规格逐条验证，生成验收报告
---

# /wsd:verify

**用法**：`/wsd:verify [req-id]`

## 前置条件

需求状态必须为 `IMPLEMENTED`。

## 执行流程

### Step 1 — 读取验收规格

读取 `.wsd/requirements/<req-id>/specs/acceptance.md`，提取所有验收条件（AC-xxx）。

### Step 2 — 调用 wsd-verifier 子代理

为 `wsd-verifier` 构建验收上下文包：
- 完整的验收规格（acceptance.md）
- 功能规格（functional.md）
- 所有实现提交记录（commits.json）
- 任务完成状态（tasks.md）

`wsd-verifier` 对每个验收条件执行：
1. 检查代码实现是否覆盖该条件
2. 运行相关测试
3. 检查边界条件处理
4. 评估为 PASS / FAIL / PARTIAL

### Step 3 — 生成验收报告

生成 `.wsd/requirements/<req-id>/verification.md`

### Step 4 — 呈现结果，等待人工确认

```
📊 验收报告生成完成

  通过：8/10
  失败：1/10
  部分：1/10

详情：.wsd/requirements/<req-id>/verification.md

❌ 有未通过的验收条件，需要修复后重新验收：
  AC-003: 并发登录限制 — FAIL
  AC-007: 密码重置邮件 — PARTIAL（邮件模板缺失）

修复后重新运行：/wsd:verify <req-id>
全部通过后确认：/wsd:approve-verify <req-id>
```

## 产物格式 — verification.md

```markdown
# 验收报告 — REQ-YYYYMMDD-NNN

> 验收时间：YYYY-MM-DD HH:mm | 验收人：wsd-verifier
> 整体结果：⚠️ PARTIAL（8/10通过）

## 验收结果汇总

| 验收条件 | 结果 | 说明 |
|---------|------|------|
| AC-001 | ✅ PASS | 用户注册正常流程验证通过 |
| AC-002 | ✅ PASS | 用户登录正常流程验证通过 |
| AC-003 | ❌ FAIL | 并发登录限制未实现 |
| AC-004 | ✅ PASS | 密码强度验证通过 |
| AC-005 | ✅ PASS | Token过期处理通过 |
| AC-006 | ✅ PASS | 用户注销功能通过 |
| AC-007 | ⚠️ PARTIAL | 密码重置流程实现，但邮件模板缺失 |
| AC-P01 | ✅ PASS | 登录接口响应 < 200ms |
| AC-S01 | ✅ PASS | 密码加密存储验证通过 |
| AC-B01 | ✅ PASS | 无效Token处理通过 |

## 失败详情

### AC-003: 并发登录限制

**期望**：同一账号最多允许3个设备同时登录，超出后踢出最早的设备
**实际**：未发现相关限制逻辑
**代码位置**：需要在 `src/auth/session.service.ts` 中添加

**建议修复**：
- 在 Redis 中维护用户会话列表
- 新登录时检查活跃会话数
- 超出时淘汰最旧会话

### AC-007: 密码重置邮件（部分通过）

**已完成**：密码重置Token生成和验证逻辑
**未完成**：邮件发送服务集成，缺少 `email-templates/password-reset.html`

## 测试覆盖情况

- 单元测试覆盖率：87%（目标：≥80% ✅）
- E2E测试：6/8场景通过
- 性能测试：所有接口 P95 < 200ms ✅

## 安全检查

- [ ] ✅ 无硬编码密钥
- [ ] ✅ SQL注入防护
- [ ] ✅ XSS防护
- [ ] ✅ 密码bcrypt加密
- [ ] ⚠️ 登录频率限制（建议加强）
```
