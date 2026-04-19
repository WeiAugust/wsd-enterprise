'use strict';
/**
 * Token 成本追踪模块
 * 记录各组织/团队/需求的 Token 使用量
 *
 * 数据模型：
 *   { id, orgId, teamId, reqId, model, inputTokens, outputTokens,
 *     costUsd, operation, recordedAt }
 */

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const DATA_DIR = path.resolve(process.env.WSD_DATA_DIR || path.join(__dirname, '../../data'));
const COSTS_FILE = path.join(DATA_DIR, 'costs.json');

// Token 单价（USD per 1M tokens，2026 定价）
const PRICING = {
  'claude-opus-4-6':    { input: 15.0, output: 75.0 },
  'claude-sonnet-4-6':  { input: 3.0,  output: 15.0 },
  'claude-haiku-4-5':   { input: 0.8,  output: 4.0  },
  'default':            { input: 3.0,  output: 15.0 },
};

function load() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(COSTS_FILE)) return { records: [] };
    return JSON.parse(fs.readFileSync(COSTS_FILE, 'utf8'));
  } catch {
    return { records: [] };
  }
}

function save(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(COSTS_FILE, JSON.stringify(data, null, 2));
}

function calcCost(model, inputTokens, outputTokens) {
  const price = PRICING[model] || PRICING.default;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

// ── 写入 ──────────────────────────────────────────────────────────────────────

function recordUsage({ orgId, teamId, reqId, model, inputTokens, outputTokens, operation }) {
  if (!orgId || inputTokens == null) throw new Error('orgId and inputTokens are required');
  const data = load();
  const record = {
    id: randomUUID(),
    orgId,
    teamId: teamId || null,
    reqId: reqId || null,
    model: model || 'claude-sonnet-4-6',
    inputTokens: Number(inputTokens) || 0,
    outputTokens: Number(outputTokens) || 0,
    costUsd: calcCost(model || 'claude-sonnet-4-6', Number(inputTokens) || 0, Number(outputTokens) || 0),
    operation: operation || 'unknown',
    recordedAt: new Date().toISOString(),
  };
  data.records.push(record);
  save(data);
  return record;
}

// ── 查询 ──────────────────────────────────────────────────────────────────────

function listRecords({ orgId, teamId, reqId, from, to, limit = 500 } = {}) {
  const { records } = load();
  return records
    .filter(r => {
      if (orgId && r.orgId !== orgId) return false;
      if (teamId && r.teamId !== teamId) return false;
      if (reqId && r.reqId !== reqId) return false;
      if (from && r.recordedAt < from) return false;
      if (to && r.recordedAt > to) return false;
      return true;
    })
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .slice(0, limit);
}

function getStats({ orgId, from, to } = {}) {
  const records = listRecords({ orgId, from, to, limit: 0 });
  // limit:0 means get all, but our impl slices — let's call directly
  const { records: all } = load();
  const filtered = all.filter(r => {
    if (orgId && r.orgId !== orgId) return false;
    if (from && r.recordedAt < from) return false;
    if (to && r.recordedAt > to) return false;
    return true;
  });

  const totalCost = filtered.reduce((s, r) => s + r.costUsd, 0);
  const totalInput = filtered.reduce((s, r) => s + r.inputTokens, 0);
  const totalOutput = filtered.reduce((s, r) => s + r.outputTokens, 0);

  // 按 orgId 分组
  const byOrg = {};
  for (const r of filtered) {
    if (!byOrg[r.orgId]) byOrg[r.orgId] = { orgId: r.orgId, costUsd: 0, tokens: 0, count: 0 };
    byOrg[r.orgId].costUsd += r.costUsd;
    byOrg[r.orgId].tokens += r.inputTokens + r.outputTokens;
    byOrg[r.orgId].count += 1;
  }

  // 按模型分组
  const byModel = {};
  for (const r of filtered) {
    if (!byModel[r.model]) byModel[r.model] = { model: r.model, costUsd: 0, tokens: 0 };
    byModel[r.model].costUsd += r.costUsd;
    byModel[r.model].tokens += r.inputTokens + r.outputTokens;
  }

  // 按天分组（最近 30 天趋势）
  const byDay = {};
  for (const r of filtered) {
    const day = r.recordedAt.slice(0, 10);
    if (!byDay[day]) byDay[day] = { date: day, costUsd: 0, tokens: 0 };
    byDay[day].costUsd += r.costUsd;
    byDay[day].tokens += r.inputTokens + r.outputTokens;
  }

  // 按需求分组（TopN）
  const byReq = {};
  for (const r of filtered) {
    if (!r.reqId) continue;
    if (!byReq[r.reqId]) byReq[r.reqId] = { reqId: r.reqId, costUsd: 0, tokens: 0 };
    byReq[r.reqId].costUsd += r.costUsd;
    byReq[r.reqId].tokens += r.inputTokens + r.outputTokens;
  }

  return {
    total: { costUsd: totalCost, inputTokens: totalInput, outputTokens: totalOutput, count: filtered.length },
    byOrg: Object.values(byOrg).sort((a, b) => b.costUsd - a.costUsd),
    byModel: Object.values(byModel).sort((a, b) => b.costUsd - a.costUsd),
    byDay: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)).slice(-30),
    topReqs: Object.values(byReq).sort((a, b) => b.costUsd - a.costUsd).slice(0, 10),
  };
}

module.exports = { recordUsage, listRecords, getStats, PRICING };
