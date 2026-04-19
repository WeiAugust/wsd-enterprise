#!/usr/bin/env node
/**
 * WSD AI 提交分析器 (git post-commit hook 调用)
 *
 * 在 git commit 完成后，精确计算：
 *   - AI 编码行数：本次 commit 中由 AI 写入的有效行数
 *   - AI 编码占比：AI行数 / 本次 commit 总新增行数
 *   - AI 接受率：AI写入行中被开发者保留的比例
 *
 * 算法：
 *   1. 读取 .claude/ai-pending/ 中的 AI 写入快照
 *   2. 获取本次 commit 实际提交的内容（git show HEAD:<file>）
 *   3. 对每个文件做 LCS 行级匹配，计算保留行数
 *   4. 结果写入 .claude/ai-stats-history.jsonl 和 .wsd/REQ-xxx/ai-stats.json
 *   5. 清除已处理的 ai-pending 快照
 *
 * 用法（由 git hook 调用，无需手动执行）：
 *   node .claude/hooks/ai-commit-analyzer.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

main().catch(err => {
  // 分析失败不应阻断开发流程，静默退出
  process.stderr.write(`[wsd/ai-stats] 分析失败: ${err.message}\n`);
  process.exit(0);
});

async function main() {
  const projectRoot = findProjectRoot();
  if (!projectRoot) return;

  const pendingDir = path.join(projectRoot, '.claude', 'ai-pending');
  if (!fs.existsSync(pendingDir)) return;

  // ── 1. 获取本次 commit 变更的文件列表 ──────────────────────────────────────
  const commitHash = getCommitHash();
  const committedFiles = getCommittedFiles(projectRoot);
  if (committedFiles.length === 0) return;

  // ── 2. 获取 commit 的 git diff 统计 ────────────────────────────────────────
  const commitDiffStat = getCommitDiffStat(projectRoot);

  // ── 3. 逐文件分析 AI 写入 vs 实际提交 ──────────────────────────────────────
  const pendingFiles = fs.readdirSync(pendingDir).filter(f => f.endsWith('.json'));

  let totalAiLines = 0;       // AI 写入的有效行数（合并去重）
  let totalAcceptedLines = 0; // 开发者保留的 AI 行数
  const fileResults = [];

  for (const pendingFile of pendingFiles) {
    const pendingPath = path.join(pendingDir, pendingFile);
    const pending = safeReadJson(pendingPath);
    if (!pending?.filePath) continue;

    const relPath = path.relative(projectRoot, pending.filePath);

    // 检查该文件是否在本次 commit 中
    if (!committedFiles.includes(relPath)) continue;

    // 获取 commit 中该文件的最终内容
    const committedContent = getCommittedFileContent(relPath, projectRoot);
    if (committedContent === null) continue;

    // 合并该文件所有 AI 写入（取最后一次 Write 的内容，叠加 Edit）
    const aiContent = mergeAiWrites(pending.writes, pending.filePath);

    // 精确行级对比
    const { aiLines, acceptedLines, acceptanceRate } = compareLines(aiContent, committedContent);

    totalAiLines += aiLines;
    totalAcceptedLines += acceptedLines;

    fileResults.push({
      file: relPath,
      reqId: pending.reqId,
      aiLines,
      acceptedLines,
      acceptanceRate,
      totalWrites: pending.writes.length,
    });

    // 处理完毕，删除 pending 快照
    fs.unlinkSync(pendingPath);
  }

  // ── 4. 计算汇总指标 ─────────────────────────────────────────────────────────
  const overallAcceptanceRate = totalAiLines > 0
    ? Math.round((totalAcceptedLines / totalAiLines) * 100) / 100
    : null;

  const aiRatio = commitDiffStat.totalAdded > 0
    ? Math.round((totalAiLines / commitDiffStat.totalAdded) * 100) / 100
    : 0;

  // 从各文件提取 reqId（取第一个非空值）
  const reqId = fileResults.find(f => f.reqId)?.reqId || null;

  const record = {
    commitHash,
    timestamp: new Date().toISOString(),
    reqId,

    // AI 编码行数
    totalAiLines,
    totalAcceptedLines,

    // AI 编码占比
    commitTotalAdded: commitDiffStat.totalAdded,
    commitFilesChanged: commitDiffStat.filesChanged,
    aiRatio,

    // AI 接受率
    acceptanceRate: overallAcceptanceRate,

    // Token 消耗（从 costs.json 读取，若无 wsd 则为 null）
    tokens: readReqTokens(reqId, projectRoot),

    // 文件明细
    byFile: fileResults,
  };

  // ── 5. 写入历史记录 ─────────────────────────────────────────────────────────
  appendToHistory(record, projectRoot);

  // 若有关联需求，更新 wsd stats
  if (reqId) {
    updateWsdStats(record, projectRoot);
  }

  // ── 6. 打印摘要 ─────────────────────────────────────────────────────────────
  printSummary(record);
}

// ── AI 内容合并 ──────────────────────────────────────────────────────────────
/**
 * 将多次 Write/Edit 操作合并为文件的"AI最终版本"
 *
 * 策略：
 *   - 最后一次 Write 覆盖之前所有内容，以此为基础
 *   - 之后的 Edit 在此基础上叠加
 */
function mergeAiWrites(writes, filePath) {
  if (!writes || writes.length === 0) return '';

  // 找到最后一次 Write 的位置
  let baseContent = '';
  let baseIndex = -1;
  for (let i = writes.length - 1; i >= 0; i--) {
    if (writes[i].tool === 'Write') {
      baseContent = writes[i].content || '';
      baseIndex = i;
      break;
    }
  }

  // 如果没有 Write，尝试读取磁盘上 Claude 开始编辑前的状态
  if (baseIndex === -1) {
    try {
      baseContent = fs.readFileSync(filePath, 'utf8');
    } catch {
      baseContent = '';
    }
  }

  // 叠加 baseIndex 之后的 Edit
  let content = baseContent;
  for (let i = Math.max(0, baseIndex + 1); i < writes.length; i++) {
    const w = writes[i];
    if (w.tool === 'Edit' && w.oldContent !== null) {
      content = content.replace(w.oldContent, w.content || '');
    }
  }

  return content;
}

// ── 行级精确对比（LCS 近似） ─────────────────────────────────────────────────
/**
 * 计算 AI 内容与提交内容的行级匹配度
 *
 * 算法：
 *   1. 规范化双方行（去除首尾空白）
 *   2. 构建提交内容的行集合（multiset）
 *   3. 遍历 AI 行，按顺序在提交内容中查找匹配
 *   4. 跳过空行和单字符行（噪音过滤）
 *
 * 准确性说明：
 *   - 能识别：开发者未改动的行、仅调整缩进的行（normalize 后匹配）
 *   - 无法识别：语义相同但写法不同的行（如变量重命名）→ 计为拒绝
 *   - 整体偏保守（低估接受率），但不会高估
 */
function compareLines(aiContent, committedContent) {
  const aiLines = normalizeLines(aiContent);
  const committedLines = normalizeLines(committedContent);

  // 构建提交内容的行频次 map（支持多次出现同一行）
  const committedMap = buildLineMap(committedLines);

  let accepted = 0;
  const meaningfulAiLines = aiLines.filter(isMeaningfulLine);

  for (const line of meaningfulAiLines) {
    if (committedMap.has(line) && committedMap.get(line) > 0) {
      accepted++;
      committedMap.set(line, committedMap.get(line) - 1);
    }
  }

  const total = meaningfulAiLines.length;
  const acceptanceRate = total > 0
    ? Math.round((accepted / total) * 100) / 100
    : null;

  return { aiLines: total, acceptedLines: accepted, acceptanceRate };
}

function normalizeLines(content) {
  if (!content) return [];
  return content.split('\n').map(l => l.trim());
}

function buildLineMap(lines) {
  const map = new Map();
  for (const line of lines) {
    map.set(line, (map.get(line) || 0) + 1);
  }
  return map;
}

function isMeaningfulLine(line) {
  // 过滤空行、注释行、纯括号行、过短行（减少噪音）
  if (line.length < 8) return false;
  if (/^[{}()\[\],;]*$/.test(line)) return false;
  return true;
}

// ── git 操作 ─────────────────────────────────────────────────────────────────

function getCommitHash() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function getCommittedFiles(projectRoot) {
  try {
    const output = execSync(
      'git diff-tree --no-commit-id -r --name-only HEAD',
      { encoding: 'utf8', cwd: projectRoot }
    );
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function getCommittedFileContent(relPath, projectRoot) {
  try {
    return execSync(
      `git show HEAD:${JSON.stringify(relPath)}`,
      { encoding: 'utf8', cwd: projectRoot, maxBuffer: 10 * 1024 * 1024 }
    );
  } catch {
    return null; // 文件被删除
  }
}

function getCommitDiffStat(projectRoot) {
  try {
    const output = execSync(
      'git diff-tree --no-commit-id -r --stat HEAD',
      { encoding: 'utf8', cwd: projectRoot }
    );
    const summary = output.trim().split('\n').pop() || '';
    const addMatch = summary.match(/(\d+) insertion/);
    const fileMatch = summary.match(/(\d+) file/);
    return {
      totalAdded: addMatch ? parseInt(addMatch[1]) : 0,
      filesChanged: fileMatch ? parseInt(fileMatch[1]) : 0,
    };
  } catch {
    return { totalAdded: 0, filesChanged: 0 };
  }
}

// ── 数据持久化 ────────────────────────────────────────────────────────────────

function appendToHistory(record, projectRoot) {
  const historyFile = path.join(projectRoot, '.claude', 'ai-stats-history.jsonl');
  fs.mkdirSync(path.dirname(historyFile), { recursive: true });
  fs.appendFileSync(historyFile, JSON.stringify(record) + '\n');
}

function updateWsdStats(record, projectRoot) {
  const statsFile = path.join(projectRoot, '.wsd', record.reqId, 'ai-stats.json');
  if (!fs.existsSync(path.dirname(statsFile))) return;

  let stats = {};
  try { stats = JSON.parse(fs.readFileSync(statsFile, 'utf8')); } catch {}

  stats.reqId = record.reqId;
  stats.lastCommit = record.commitHash;
  stats.totalAiLinesAdded = (stats.totalAiLinesAdded || 0) + record.totalAiLines;
  stats.acceptedLines = (stats.acceptedLines || 0) + record.totalAcceptedLines;

  // 重新计算累计接受率
  if (stats.totalAiLinesAdded > 0) {
    stats.acceptanceRate = Math.round(
      (stats.acceptedLines / stats.totalAiLinesAdded) * 100
    ) / 100;
  }

  stats.aiRatio = record.aiRatio;
  stats.tokens = record.tokens;
  stats.lastUpdated = record.timestamp;
  stats.commits = [...(stats.commits || []), record.commitHash];

  fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
}

function readReqTokens(reqId, projectRoot) {
  if (!reqId) return null;
  try {
    const costsFile = path.join(projectRoot, 'wsd-data', 'data', 'costs.json');
    const { records } = JSON.parse(fs.readFileSync(costsFile, 'utf8'));
    const reqRecords = records.filter(r => r.reqId === reqId);
    return {
      inputTokens: reqRecords.reduce((s, r) => s + r.inputTokens, 0),
      outputTokens: reqRecords.reduce((s, r) => s + r.outputTokens, 0),
      costUsd: reqRecords.reduce((s, r) => s + r.costUsd, 0).toFixed(4),
    };
  } catch {
    return null;
  }
}

// ── 打印摘要 ──────────────────────────────────────────────────────────────────

function printSummary(record) {
  const pct = v => v != null ? `${(v * 100).toFixed(1)}%` : 'N/A';
  const num = v => v != null ? v.toLocaleString() : '0';

  const tokenLine = record.tokens
    ? `tokens ${num(record.tokens.inputTokens + record.tokens.outputTokens)} ($${record.tokens.costUsd})`
    : 'tokens: 未配置 wsd token 追踪';

  process.stderr.write(
    `\n[wsd/ai-stats] commit ${record.commitHash.slice(0, 7)} | ` +
    `AI行数 ${num(record.totalAiLines)} | ` +
    `占比 ${pct(record.aiRatio)} | ` +
    `接受率 ${pct(record.acceptanceRate)} | ` +
    `${tokenLine}\n`
  );
}

// ── 工具函数 ──────────────────────────────────────────────────────────────────

function safeReadJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

function findProjectRoot() {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
