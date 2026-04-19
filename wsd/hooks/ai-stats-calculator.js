#!/usr/bin/env node
/**
 * WSD AI 统计计算器
 *
 * 在 /wsd:verify 和 /wsd:archive 阶段调用，计算：
 *   - AI 编码占比：AI行数 / git diff 总行数
 *   - AI 接受率：最终保留的AI行数 / AI总写入行数
 *
 * 用法：
 *   node ai-stats-calculator.js <req-id> [--stage verify|archive]
 *
 * 输出 JSON 结果，并更新 .wsd/REQ-xxx/ai-stats.json
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const [, , reqId, stageArg] = process.argv;
const stage = stageArg?.replace('--stage=', '') || 'verify';

if (!reqId || !reqId.match(/^REQ-\d{8}-\d{3}$/)) {
  console.error('Usage: node ai-stats-calculator.js <req-id> [--stage=verify|archive]');
  process.exit(1);
}

main();

async function main() {
  const wsdDir = findWsdDir();
  if (!wsdDir) {
    console.error('未找到 .wsd 目录');
    process.exit(1);
  }

  const reqDir = path.join(wsdDir, reqId);
  const statsFile = path.join(reqDir, 'ai-stats.json');
  const snapshotDir = path.join(reqDir, 'ai-snapshots');

  if (!fs.existsSync(statsFile)) {
    console.error(`未找到统计文件：${statsFile}`);
    process.exit(1);
  }

  const stats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));

  // ── 1. 计算 AI 编码占比 ───────────────────────────────────────────────────
  const gitStats = getGitDiffStats(reqId, wsdDir);
  const aiRatio = gitStats.totalAdded > 0
    ? Math.round((stats.totalAiLinesAdded / gitStats.totalAdded) * 100) / 100
    : 0;

  // ── 2. 计算 AI 接受率（archive 阶段才精确计算）────────────────────────────
  let acceptedLines = null;
  let acceptanceRate = null;

  if (stage === 'archive' && fs.existsSync(snapshotDir)) {
    const result = calcAcceptanceRate(snapshotDir, stats);
    acceptedLines = result.acceptedLines;
    acceptanceRate = result.acceptanceRate;
  }

  // ── 3. 读取 Token 消耗 ────────────────────────────────────────────────────
  const tokenStats = getTokenStats(reqId, wsdDir);

  // ── 4. 汇总并写回 ─────────────────────────────────────────────────────────
  const summary = {
    reqId,
    stage,
    calculatedAt: new Date().toISOString(),

    // AI 编码行数
    totalAiLinesAdded: stats.totalAiLinesAdded,
    totalAiEdits: stats.totalAiEdits,

    // AI 编码占比
    gitTotalLinesAdded: gitStats.totalAdded,
    gitFilesChanged: gitStats.filesChanged,
    aiRatio,

    // AI 接受率（archive 时）
    acceptedLines,
    acceptanceRate,

    // Token 消耗
    tokens: tokenStats,

    // 文件级明细
    byFile: Object.entries(stats.byFile).map(([file, s]) => ({
      file: file.replace(process.cwd(), '.'),
      ...s,
    })),
  };

  // 更新 ai-stats.json
  Object.assign(stats, { aiRatio, acceptedLines, acceptanceRate, tokens: tokenStats });
  fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));

  // 输出汇总报告
  printReport(summary);

  // 输出 JSON 供调用方解析
  process.stdout.write('\n__JSON__\n' + JSON.stringify(summary, null, 2) + '\n');
}

// ── git diff 统计 ────────────────────────────────────────────────────────────

function getGitDiffStats(reqId, wsdDir) {
  try {
    // 尝试找到需求对应的 git 基准 commit
    const metaFile = path.join(wsdDir, reqId, 'meta.json');
    let baseCommit = 'HEAD~50'; // 默认回看最近 50 个 commit
    if (fs.existsSync(metaFile)) {
      const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
      baseCommit = meta.baseCommit || meta.startCommit || baseCommit;
    }

    const diffOutput = execSync(
      `git diff --stat ${baseCommit} HEAD 2>/dev/null || git diff --stat HEAD 2>/dev/null`,
      { encoding: 'utf8', cwd: findProjectRoot() }
    );

    // 解析 git diff --stat 输出
    const lines = diffOutput.trim().split('\n');
    const summary = lines[lines.length - 1] || '';
    const filesMatch = summary.match(/(\d+) files? changed/);
    const addMatch = summary.match(/(\d+) insertions?\(\+\)/);

    return {
      totalAdded: addMatch ? parseInt(addMatch[1]) : 0,
      filesChanged: filesMatch ? parseInt(filesMatch[1]) : 0,
      raw: summary,
    };
  } catch {
    return { totalAdded: 0, filesChanged: 0, raw: '' };
  }
}

// ── 接受率计算 ───────────────────────────────────────────────────────────────

function calcAcceptanceRate(snapshotDir, stats) {
  let totalAiLines = 0;
  let acceptedLines = 0;

  const snapshotFiles = fs.readdirSync(snapshotDir).filter(f => f.endsWith('.ai'));

  for (const snapshotFile of snapshotFiles) {
    try {
      const snapshot = JSON.parse(
        fs.readFileSync(path.join(snapshotDir, snapshotFile), 'utf8')
      );
      const filePath = snapshot.filePath;

      if (!fs.existsSync(filePath)) continue;

      // AI 最后写入的版本
      const lastAiWrite = snapshot.history[snapshot.history.length - 1];
      if (!lastAiWrite) continue;

      const aiLines = lastAiWrite.content.split('\n');
      const currentLines = new Set(
        fs.readFileSync(filePath, 'utf8').split('\n')
      );

      // 粗粒度：逐行匹配（忽略空白行差异）
      const retained = aiLines.filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 2 && currentLines.has(line);
      });

      totalAiLines += aiLines.filter(l => l.trim().length > 0).length;
      acceptedLines += retained.length;
    } catch {}
  }

  const acceptanceRate = totalAiLines > 0
    ? Math.round((acceptedLines / totalAiLines) * 100) / 100
    : null;

  return { acceptedLines, acceptanceRate };
}

// ── Token 统计 ────────────────────────────────────────────────────────────────

function getTokenStats(reqId, wsdDir) {
  // 读取 wsd-data/costs.json 中对应需求的 token 消耗
  const costsFile = path.join(
    process.env.WSD_DATA_DIR ||
    path.join(path.dirname(wsdDir), 'wsd-data', 'data'),
    'costs.json'
  );

  try {
    const { records } = JSON.parse(fs.readFileSync(costsFile, 'utf8'));
    const reqRecords = records.filter(r => r.reqId === reqId);

    return {
      inputTokens: reqRecords.reduce((s, r) => s + r.inputTokens, 0),
      outputTokens: reqRecords.reduce((s, r) => s + r.outputTokens, 0),
      totalTokens: reqRecords.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0),
      costUsd: reqRecords.reduce((s, r) => s + r.costUsd, 0).toFixed(4),
      callCount: reqRecords.length,
    };
  } catch {
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: '0.0000', callCount: 0 };
  }
}

// ── 报告输出 ──────────────────────────────────────────────────────────────────

function printReport(summary) {
  const pct = (v) => v != null ? `${(v * 100).toFixed(1)}%` : '待计算';
  const num = (v) => v?.toLocaleString() ?? '0';

  console.log(`
╔══════════════════════════════════════════════════════╗
║         AI 编码统计报告  ${summary.reqId}         ║
╠══════════════════════════════════════════════════════╣
║  AI 编码行数    ${String(num(summary.totalAiLinesAdded)).padEnd(10)} (${summary.totalAiEdits} 次编辑)      ║
║  AI 编码占比    ${pct(summary.aiRatio).padEnd(10)} (总变更 ${num(summary.gitTotalLinesAdded)} 行)  ║
║  AI 接受率      ${pct(summary.acceptanceRate).padEnd(10)}                       ║
╠══════════════════════════════════════════════════════╣
║  Token 消耗     ${String(num(summary.tokens?.totalTokens)).padEnd(10)}                       ║
║   ├ 输入        ${String(num(summary.tokens?.inputTokens)).padEnd(10)}                       ║
║   └ 输出        ${String(num(summary.tokens?.outputTokens)).padEnd(10)}                       ║
║  预估费用       $${String(summary.tokens?.costUsd || '0.0000').padEnd(10)}                      ║
╚══════════════════════════════════════════════════════╝`);
}

// ── 辅助 ─────────────────────────────────────────────────────────────────────

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

function findProjectRoot() {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}
