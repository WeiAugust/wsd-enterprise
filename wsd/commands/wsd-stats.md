# /wsd:stats — AI 编码统计

查看指定需求的 AI 编码统计数据：AI 编码行数、占比、接受率、Token 消耗。

## 用法

```
/wsd:stats [req-id]
/wsd:stats [req-id] --detail
/wsd:stats --all [--from=YYYY-MM-DD] [--to=YYYY-MM-DD]
```

## 参数

| 参数 | 说明 |
|------|------|
| `req-id` | 需求ID（省略时使用当前活跃需求） |
| `--detail` | 显示文件级明细 |
| `--all` | 汇总所有需求（管理视角） |
| `--from / --to` | 时间范围过滤 |

## 执行步骤

1. 确认 req-id（省略时从 `.wsd/STATE.md` 读取当前需求）
2. 检查 `.wsd/<req-id>/ai-stats.json` 是否存在
3. 调用 `ai-stats-calculator.js` 重新计算最新数据
4. 格式化输出统计报告

## 输出示例

```
╔══════════════════════════════════════════════════════╗
║         AI 编码统计报告  REQ-20260419-001           ║
╠══════════════════════════════════════════════════════╣
║  AI 编码行数    342        (28 次编辑)              ║
║  AI 编码占比    78.3%      (总变更 437 行)          ║
║  AI 接受率      82.5%      (archive 后精确)         ║
╠══════════════════════════════════════════════════════╣
║  Token 消耗     145,230                             ║
║   ├ 输入        128,400                             ║
║   └ 输出         16,830                             ║
║  预估费用       $0.6368                             ║
╚══════════════════════════════════════════════════════╝
```

**注意**：
- `AI 编码占比` 在 `/wsd:verify` 后即可查看
- `AI 接受率` 在 `/wsd:archive` 后精确计算（archive 前为估算值）

## --detail 明细

```
文件级 AI 编码明细：
  src/api/users.ts      AI写入 120行  编辑 8次
  src/models/user.ts    AI写入  85行  编辑 5次
  tests/users.test.ts   AI写入  97行  编辑 6次
  src/utils/auth.ts     AI写入  40行  编辑 9次
```

## 实现

```bash
# 调用计算器
node .claude/hooks/ai-stats-calculator.js <req-id> --stage=verify
```

对于 `--all` 模式，汇总 `.wsd/` 目录下所有需求的 `ai-stats.json`。

## 与 wsd 生命周期的集成

| 阶段 | AI 统计行为 |
|------|-------------|
| `EXECUTING` | Hook 自动记录每次 Write/Edit |
| `IMPLEMENTED` | 可查看实时 AI 编码行数和 Token |
| `VERIFYING` | 计算 AI 编码占比（vs git diff） |
| `ARCHIVED` | 精确计算 AI 接受率，写入归档报告 |

## 权限

`viewer+`（所有人可查看）
