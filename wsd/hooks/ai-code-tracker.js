#!/usr/bin/env node
/**
 * WSD AI 编码指标追踪器 (PostToolUse Hook)
 *
 * 拦截 Claude Code 的 Write/Edit 操作，将 AI 写入内容保存到
 * .claude/ai-pending/ 暂存区。git post-commit hook 触发时，
 * ai-commit-analyzer.js 读取暂存区并精确计算各项指标。
 *
 * 无论是否使用 wsd-executor，只要安装了 WSD 并配置了 Hook，
 * 此脚本均会自动工作。
 *
 * 数据存储：
 *   .claude/ai-pending/<file-hash>.json   ← AI 写入快照（git commit 前）
 *   .wsd/REQ-xxx/ai-snapshots/            ← 同步到 wsd 需求目录（若活跃需求存在）
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let input = '';
process.stdin.on('data', chunk => (input += chunk));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const toolName = data?.tool_name || '';
    const toolInput = data?.tool_input || {};

    if (['Write', 'Edit'].includes(toolName)) {
      trackAiCode(toolName, toolInput);
    }

    process.stdout.write(input);
  } catch {
    process.stdout.write(input);
  }
});

// ── 核心：记录 AI 写入 ───────────────────────────────────────────────────────

function trackAiCode(toolName, toolInput) {
  const filePath = toolInput?.file_path || '';
  if (!filePath || !isCodeFile(filePath)) return;

  const projectRoot = findProjectRoot();
  if (!projectRoot) return;

  const pendingDir = path.join(projectRoot, '.claude', 'ai-pending');
  fs.mkdirSync(pendingDir, { recursive: true });

  // 计算本次写入的内容和行数
  const { content, linesAdded, linesRemoved } = extractWriteInfo(toolName, toolInput);
  if (!content && linesAdded === 0) return;

  // 读取或创建该文件的暂存记录
  const pendingFile = path.join(pendingDir, fileKey(filePath) + '.json');
  const pending = loadPending(pendingFile);

  // 追加本次写入记录
  pending.filePath = filePath;
  pending.projectRoot = projectRoot;
  pending.reqId = detectActiveReqId(projectRoot);
  pending.writes.push({
    tool: toolName,
    content,
    linesAdded,
    linesRemoved,
    timestamp: new Date().toISOString(),
    // 保存 Edit 的 old_string 用于精确计算变更范围
    oldContent: toolName === 'Edit' ? (toolInput?.old_string || '') : null,
  });
  pending.totalAiLinesAdded += linesAdded;
  pending.lastUpdated = new Date().toISOString();

  fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 2));

  // 同步到 wsd 需求目录（若当前有活跃需求）
  if (pending.reqId) {
    syncToWsdReq(pending, projectRoot);
  }
}

// ── 提取写入信息 ─────────────────────────────────────────────────────────────

function extractWriteInfo(toolName, toolInput) {
  if (toolName === 'Write') {
    const content = toolInput?.content || '';
    return {
      content,
      linesAdded: countNonBlankLines(content),
      linesRemoved: 0,
    };
  }

  if (toolName === 'Edit') {
    const oldStr = toolInput?.old_string || '';
    const newStr = toolInput?.new_string || '';
    return {
      content: newStr,
      linesAdded: countNonBlankLines(newStr),
      linesRemoved: countNonBlankLines(oldStr),
    };
  }

  return { content: '', linesAdded: 0, linesRemoved: 0 };
}

// ── 同步到 wsd 需求目录 ──────────────────────────────────────────────────────

function syncToWsdReq(pending, projectRoot) {
  const wsdDir = path.join(projectRoot, '.wsd');
  if (!fs.existsSync(wsdDir)) return;

  const reqDir = path.join(wsdDir, pending.reqId);
  const snapshotDir = path.join(reqDir, 'ai-snapshots');
  fs.mkdirSync(snapshotDir, { recursive: true });

  const snapshotFile = path.join(snapshotDir, fileKey(pending.filePath) + '.json');
  fs.writeFileSync(snapshotFile, JSON.stringify(pending, null, 2));
}

// ── 辅助 ─────────────────────────────────────────────────────────────────────

function loadPending(pendingFile) {
  try {
    return JSON.parse(fs.readFileSync(pendingFile, 'utf8'));
  } catch {}
  return {
    filePath: null,
    projectRoot: null,
    reqId: null,
    totalAiLinesAdded: 0,
    writes: [],
    lastUpdated: null,
  };
}

function countNonBlankLines(content) {
  if (!content) return 0;
  return content.split('\n').filter(l => l.trim().length > 0).length;
}

function fileKey(filePath) {
  return crypto.createHash('md5').update(filePath).digest('hex').slice(0, 12) +
    '_' + path.basename(filePath).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function isCodeFile(filePath) {
  // 排除 .wsd/ 和 .claude/ 本身
  if (filePath.includes('/.wsd/') || filePath.includes('/.claude/')) return false;
  if (filePath.includes('\\.wsd\\') || filePath.includes('\\.claude\\')) return false;

  const ext = path.extname(filePath).toLowerCase();
  const codeExts = [
    '.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs',
    '.py', '.java', '.go', '.rs', '.cs', '.cpp', '.c', '.h',
    '.swift', '.kt', '.rb', '.php', '.vue', '.svelte',
    '.css', '.scss', '.less', '.html', '.sql',
    '.sh', '.bash', '.zsh', '.yaml', '.yml',
  ];
  return codeExts.includes(ext);
}

function detectActiveReqId(projectRoot) {
  if (process.env.WSD_REQ_ID) return process.env.WSD_REQ_ID;
  try {
    const stateFile = path.join(projectRoot, '.wsd', 'STATE.md');
    const content = fs.readFileSync(stateFile, 'utf8');
    const match = content.match(/当前需求[:：]\s*(REQ-\d{8}-\d{3})/);
    return match ? match[1] : null;
  } catch {}
  return null;
}

function findProjectRoot() {
  // 优先找 .git
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // 回退：找 .claude
  dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, '.claude'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
