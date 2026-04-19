#!/usr/bin/env node
/**
 * WSD 生命周期守卫 (PreToolUse Hook)
 *
 * 防止跳过阶段：在 wsd:execute 之前验证状态机合法性
 * 配置方式（settings.json）：
 * {
 *   "hooks": {
 *     "PreToolUse": [{
 *       "matcher": "Bash",
 *       "command": "node .claude/hooks/lifecycle-guard.js"
 *     }]
 *   }
 * }
 */

const fs = require('fs');
const path = require('path');

// 读取 stdin（PreToolUse hook 接收工具调用参数）
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const toolInput = JSON.parse(input);
    const command = toolInput?.tool_input?.command || '';

    // 只处理 WSD 相关命令
    if (!command.includes('wsd:')) {
      process.stdout.write(input);
      return;
    }

    const result = validateLifecycle(command);
    if (result.blocked) {
      console.error(`[WSD Guard] BLOCKED: ${result.reason}`);
      console.error(`[WSD Guard] 当前状态：${result.currentStatus}`);
      console.error(`[WSD Guard] 期望状态：${result.requiredStatus}`);
      process.exit(2);
    }

    process.stdout.write(input);
  } catch {
    // 解析失败时放行（不干扰非 JSON 输入）
    process.stdout.write(input);
  }
});

function validateLifecycle(command) {
  const wsdDir = findWsdDir();
  if (!wsdDir) return { blocked: false }; // 没有 .wsd 目录则不拦截

  // 从命令中提取 req-id（如果有）
  const reqIdMatch = command.match(/REQ-\d{8}-\d{3}/);
  if (!reqIdMatch) return { blocked: false }; // 没有具体需求ID则不拦截

  const reqId = reqIdMatch[0];
  const metaPath = path.join(wsdDir, 'requirements', reqId, 'meta.json');

  if (!fs.existsSync(metaPath)) return { blocked: false };

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const currentStatus = meta.status;

  // 状态前置条件映射
  const prerequisites = {
    'wsd:spec': ['PROPOSED'],
    'wsd:review': ['PROPOSED', 'SPEC_APPROVED'],
    'wsd:plan': ['SPEC_APPROVED'],
    'wsd:execute': ['PLAN_APPROVED', 'EXECUTING', 'BLOCKED'],
    'wsd:verify': ['IMPLEMENTED'],
    'wsd:archive': ['DONE'],
    'wsd:approve-spec': ['SPECCING'],
    'wsd:approve-plan': ['PLANNING'],
    'wsd:approve-verify': ['VERIFYING'],
  };

  // 从命令中识别操作
  for (const [op, requiredStatuses] of Object.entries(prerequisites)) {
    if (command.includes(op)) {
      if (!requiredStatuses.includes(currentStatus)) {
        return {
          blocked: true,
          reason: `wsd:${op} 需要需求处于 ${requiredStatuses.join('/')} 状态`,
          currentStatus,
          requiredStatus: requiredStatuses.join(' 或 '),
        };
      }
      break;
    }
  }

  return { blocked: false };
}

function findWsdDir() {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, '.wsd');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
