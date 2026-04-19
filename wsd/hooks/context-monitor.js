#!/usr/bin/env node
/**
 * WSD 上下文监控器 (PostToolUse Hook)
 *
 * 监控上下文使用量，在高使用率时输出警告
 * 配置方式（settings.json）：
 * {
 *   "hooks": {
 *     "PostToolUse": [{
 *       "matcher": ".*",
 *       "command": "node .claude/hooks/context-monitor.js"
 *     }]
 *   }
 * }
 *
 * 注意：Claude Code 不直接暴露 token 计数，
 * 此 hook 通过 CLAUDE_CONTEXT_TOKENS 环境变量（如有）或
 * 对话轮次估算上下文使用量。
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);

    // 尝试从环境变量获取 token 信息（Claude Code 未来可能提供）
    const usedTokens = parseInt(process.env.CLAUDE_CONTEXT_TOKENS_USED || '0');
    const maxTokens = parseInt(process.env.CLAUDE_CONTEXT_TOKENS_MAX || '200000');

    if (usedTokens > 0) {
      const usagePercent = Math.round((usedTokens / maxTokens) * 100);
      outputWarning(usagePercent, usedTokens, maxTokens);
    } else {
      // 无法获取精确 token 数时，记录工具调用次数用于估算
      trackToolUsage();
    }

    // hook 不修改输入，直接透传
    process.stdout.write(input);
  } catch {
    process.stdout.write(input);
  }
});

function outputWarning(percent, used, max) {
  if (percent >= 80) {
    console.error(`
🛑 [WSD Context Guard] 上下文使用率 ${percent}%（${used}/${max} tokens）

上下文已高度使用，继续执行可能导致质量下降。
建议：完成当前任务后，在新会话中继续
      /wsd:execute <req-id>  （WSD会从保存的进度继续）
`);
  } else if (percent >= 60) {
    console.error(`
⚠️  [WSD Context Guard] 上下文使用率 ${percent}%

建议在完成当前任务后考虑切换新会话。
`);
  }
}

function trackToolUsage() {
  // 估算方案：在 ~/.wsd/session-stats.json 中记录工具调用次数
  const statsFile = path.join(os.homedir(), '.wsd', 'session-stats.json');

  let stats = { toolCalls: 0, startTime: Date.now() };
  try {
    if (fs.existsSync(statsFile)) {
      stats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
    }
  } catch {}

  stats.toolCalls += 1;

  try {
    fs.mkdirSync(path.dirname(statsFile), { recursive: true });
    fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
  } catch {}

  // 基于工具调用次数的粗略估算警告阈值
  // 每次工具调用约消耗 1k-5k tokens，100次调用约 50K+ tokens
  if (stats.toolCalls >= 150) {
    console.error(`
⚠️  [WSD Context Guard] 本会话已执行 ${stats.toolCalls} 次工具调用
    上下文可能较长，建议关注响应质量
`);
  }
}
