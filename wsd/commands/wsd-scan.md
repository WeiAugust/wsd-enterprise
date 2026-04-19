---
description: 扫描代码库，识别技术债务和潜在需求，生成 WSD 提案草稿
argument-hint: [--scope=<path>] [--type=debt|missing|all]
---

# /wsd:scan — 代码库扫描与需求发现

## 用途

扫描现有代码库，自动识别：
- 技术债务（TODO/FIXME/HACK 注释、硬编码配置、无测试模块）
- 缺失功能（已引用但未实现的接口、空函数体、占位实现）
- 安全问题（硬编码密钥、未验证输入、明文存储）
- 架构问题（超大文件、循环依赖、重复代码）

对每类问题自动生成对应的 WSD 需求提案草稿，存入 `.wsd/scan-results/`。

## 执行流程

### 第一阶段：探索分析（wsd-analyst 代理）

```
1. 扫描目标路径（默认 src/，可通过 --scope 指定）
2. 统计文件规模（行数、函数数、测试覆盖情况）
3. 收集特征信号：
   - TODO/FIXME/HACK/XXX 注释计数
   - 无单元测试的模块（无对应 .test.* 或 .spec.*）
   - 超过 800 行的文件
   - 硬编码字符串（IP、URL、密钥模式）
   - 未实现函数（throw new Error('not implemented') 等）
```

### 第二阶段：问题分类

| 类别 | 优先级 | 建议 WSD Track |
|-----|-------|--------------|
| 安全漏洞（硬编码密钥等） | P0 | hotfix |
| 功能缺失（接口未实现） | P1 | normal |
| 技术债务（大文件/无测试） | P2 | normal / quickfix |
| 代码质量（TODO 注释） | P3 | quickfix |

### 第三阶段：生成报告

输出 `.wsd/scan-results/scan-<timestamp>.md`：

```markdown
# 代码库扫描报告 — <日期>

## 扫描范围
- 路径：src/
- 文件数：147
- 代码行：23,847

## 发现摘要
- 🔴 P0 安全问题：2 个
- 🟡 P1 功能缺失：5 个
- 🔵 P2 技术债务：12 个
- ⚪ P3 代码质量：34 个

## P0 安全问题
### S-001：硬编码 API 密钥
位置：src/integrations/stripe.js:23
现象：const SECRET = "sk_live_xxxx"
建议操作：/wsd:hotfix 移除硬编码 Stripe 密钥，改为环境变量

### S-002：SQL 拼接注入风险
位置：src/api/users.js:87
现象：query = `SELECT * FROM users WHERE name = '${name}'`
建议操作：/wsd:hotfix 修复 users 查询 SQL 注入漏洞

## P1 功能缺失
...

## 建议操作
对以下问题已准备 WSD 提案草稿（.wsd/scan-results/proposals/）：
  - REQ-SCAN-001.md（安全：移除硬编码密钥）
  - REQ-SCAN-002.md（安全：修复 SQL 注入）
  - REQ-SCAN-003.md（功能：完善 UserService.updateProfile）

运行 /wsd:propose 确认并正式创建需求。
```

### 第四阶段：可选——自动创建提案

如果用户确认，对 P0/P1 问题调用 `/wsd:propose` 正式创建需求。

## 使用示例

```bash
# 扫描全部问题
/wsd:scan

# 只扫描安全和缺失功能
/wsd:scan --type=debt

# 扫描指定目录
/wsd:scan --scope=src/auth

# 扫描并自动创建 P0 提案
/wsd:scan --auto-propose=p0
```

## 注意

- 扫描结果保存在 `.wsd/scan-results/`，不自动修改任何代码
- 生成的提案是草稿，需通过 `/wsd:propose` 确认后才进入正式流程
- 对于存量项目首次引入 WSD 时特别有用（配合 `/wsd:import` 使用）
