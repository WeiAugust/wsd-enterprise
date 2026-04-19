---
description: 归档已完成需求 — 将规格合并到主规格库，生成归档记录
---

# /wsd:archive

**用法**：`/wsd:archive [req-id]`

## 前置条件

需求状态必须为 `DONE`（通过 `/wsd:approve-verify` 确认）。

## 执行流程

1. 将 `specs/` 下的规格文档合并到 `.wsd/specs/<feature-area>/`
2. **计算 AI 编码统计**：运行 `ai-stats-calculator.js <req-id> --stage=archive`，精确计算 AI 接受率
3. 生成归档摘要（包含：交付物清单、commit 列表、验收报告链接、AI 编码统计）
4. 压缩需求目录为 `.wsd/archive/<req-id>.tar.gz`
5. 更新 `.wsd/STATE.md`，从活跃列表移除
6. 如配置了外部系统，同步更新状态（Jira: 关闭，飞书: 完成）

## 归档摘要格式

```markdown
# 归档记录 — REQ-YYYYMMDD-NNN

> 归档时间：YYYY-MM-DD | 需求标题：<title>
> 交付周期：提案 → 归档 共 N 天

## 交付摘要

- 提案创建：YYYY-MM-DD
- 规格确认：YYYY-MM-DD
- 计划确认：YYYY-MM-DD
- 实现完成：YYYY-MM-DD（N个任务，实际工时 Xh）
- 验收通过：YYYY-MM-DD

## 代码变更

共 N 个 commit，影响 M 个文件：
- abc1234: feat: 初始化数据库迁移
- def5678: feat: 定义用户数据模型
- ...

## 规格归档位置

`.wsd/specs/auth/user-authentication.md`

## AI 编码统计

| 指标 | 数值 |
|------|------|
| AI 编码行数 | N 行（M 次编辑） |
| AI 编码占比 | X%（总变更 N 行） |
| AI 接受率 | X%（开发者保留比例） |
| Token 消耗 | N（输入 N / 输出 N） |
| 预估费用 | $X.XXXX |

## 学习与反思

<wsd-verifier 生成的交付质量评估>
```
