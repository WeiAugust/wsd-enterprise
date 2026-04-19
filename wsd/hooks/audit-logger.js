#!/usr/bin/env node
/**
 * WSD 审计日志器 (PostToolUse Hook)
 *
 * 记录所有 WSD 相关操作到 .wsd/audit/<date>.jsonl
 * 配置方式（settings.json）：
 * {
 *   "hooks": {
 *     "PostToolUse": [{
 *       "matcher": "Write|Edit|Bash",
 *       "command": "node .claude/hooks/audit-logger.js"
 *     }]
 *   }
 * }
 */

const fs = require('fs');
const path = require('path');

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const toolName = data?.tool_name || '';
    const toolInput = data?.tool_input || {};
    const toolResult = data?.tool_result || {};

    // 只记录 WSD 相关操作
    if (shouldAudit(toolName, toolInput)) {
      writeAuditLog({
        timestamp: new Date().toISOString(),
        tool: toolName,
        operation: classifyOperation(toolName, toolInput),
        target: extractTarget(toolInput),
        operator: getOperator(),
        success: !toolResult?.error,
        summary: buildSummary(toolName, toolInput),
      });
    }

    process.stdout.write(input);
  } catch {
    process.stdout.write(input);
  }
});

function shouldAudit(toolName, toolInput) {
  // Write/Edit 操作写入 .wsd/ 目录
  if (['Write', 'Edit'].includes(toolName)) {
    const filePath = toolInput?.file_path || '';
    return filePath.includes('/.wsd/') || filePath.includes('\\.wsd\\');
  }

  // Bash 中包含 wsd: 命令
  if (toolName === 'Bash') {
    const command = toolInput?.command || '';
    return command.includes('wsd:') || command.includes('wsdm ');
  }

  return false;
}

function classifyOperation(toolName, toolInput) {
  if (toolName === 'Bash') {
    const cmd = toolInput?.command || '';
    if (cmd.includes('wsd:propose')) return 'PROPOSE';
    if (cmd.includes('wsd:spec')) return 'SPEC';
    if (cmd.includes('wsd:plan')) return 'PLAN';
    if (cmd.includes('wsd:execute')) return 'EXECUTE';
    if (cmd.includes('wsd:verify')) return 'VERIFY';
    if (cmd.includes('wsd:archive')) return 'ARCHIVE';
    if (cmd.includes('wsd:block')) return 'BLOCK';
    if (cmd.includes('wsd:unblock')) return 'UNBLOCK';
    if (cmd.includes('wsd:approve')) return 'APPROVE';
    return 'WSD_COMMAND';
  }
  if (toolName === 'Write') return 'FILE_CREATE';
  if (toolName === 'Edit') return 'FILE_MODIFY';
  return 'UNKNOWN';
}

function extractTarget(toolInput) {
  // 从命令或文件路径中提取需求ID
  const content = JSON.stringify(toolInput);
  const match = content.match(/REQ-\d{8}-\d{3}/);
  return match ? match[0] : (toolInput?.file_path || toolInput?.command || '').substring(0, 100);
}

function getOperator() {
  try {
    const { execSync } = require('child_process');
    return execSync('git config user.name 2>/dev/null', { encoding: 'utf8' }).trim() || 'unknown';
  } catch {
    return process.env.USER || 'unknown';
  }
}

function buildSummary(toolName, toolInput) {
  if (toolName === 'Bash') {
    return (toolInput?.command || '').substring(0, 200);
  }
  return `${toolName}: ${(toolInput?.file_path || '').replace(process.cwd(), '.')}`;
}

function writeAuditLog(entry) {
  const wsdDir = findWsdDir();
  if (!wsdDir) return;

  const today = new Date().toISOString().split('T')[0];
  const auditDir = path.join(wsdDir, 'audit');
  const auditFile = path.join(auditDir, `${today}.jsonl`);

  try {
    fs.mkdirSync(auditDir, { recursive: true });
    fs.appendFileSync(auditFile, JSON.stringify(entry) + '\n');
  } catch {}
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
