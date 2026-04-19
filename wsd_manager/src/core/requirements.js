'use strict';
/**
 * Requirements — 需求状态聚合模块
 * 扫描各项目的 .wsd/ 目录，聚合需求状态
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.WSD_DATA_DIR || path.join(process.cwd(), '.wsd-manager-data');
const REQS_FILE = path.join(DATA_DIR, 'requirements.json');

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadRequirements() {
  ensureDataDir();
  try {
    return JSON.parse(fs.readFileSync(REQS_FILE, 'utf8'));
  } catch {
    return { requirements: [], lastUpdated: null };
  }
}

function saveRequirements(data) {
  ensureDataDir();
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(REQS_FILE, JSON.stringify(data, null, 2));
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

function listRequirements({ status, team, owner, limit = 50 } = {}) {
  const data = loadRequirements();
  let reqs = data.requirements || [];

  if (status) reqs = reqs.filter(r => r.status === status);
  if (team) reqs = reqs.filter(r => r.team === team);
  if (owner) reqs = reqs.filter(r => r.owner === owner);

  return reqs.slice(0, limit).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function getRequirement(reqId) {
  const data = loadRequirements();
  return data.requirements.find(r => r.reqId === reqId) || null;
}

function upsertRequirement(req) {
  const data = loadRequirements();
  const idx = data.requirements.findIndex(r => r.reqId === req.reqId);

  req.updatedAt = new Date().toISOString();

  if (idx >= 0) {
    data.requirements[idx] = { ...data.requirements[idx], ...req };
  } else {
    req.createdAt = req.createdAt || req.updatedAt;
    data.requirements.push(req);
  }
  saveRequirements(data);
  return req;
}

function deleteRequirement(reqId) {
  const data = loadRequirements();
  const before = data.requirements.length;
  data.requirements = data.requirements.filter(r => r.reqId !== reqId);
  if (data.requirements.length < before) {
    saveRequirements(data);
    return true;
  }
  return false;
}

// ── 统计 ──────────────────────────────────────────────────────────────────────

const STATUS_ORDER = [
  'PROPOSED', 'SPECCING', 'SPEC_APPROVED', 'PLANNING', 'PLAN_APPROVED',
  'EXECUTING', 'BLOCKED', 'IMPLEMENTED', 'VERIFYING', 'DONE', 'ARCHIVED',
  'CANCELLED', 'NEEDS_REWORK'
];

function getStats() {
  const reqs = loadRequirements().requirements || [];
  const byStatus = {};
  for (const s of STATUS_ORDER) byStatus[s] = 0;
  for (const r of reqs) byStatus[r.status] = (byStatus[r.status] || 0) + 1;

  const active = reqs.filter(r => !['ARCHIVED', 'CANCELLED'].includes(r.status));
  const blocked = reqs.filter(r => r.status === 'BLOCKED');

  return {
    total: reqs.length,
    active: active.length,
    blocked: blocked.length,
    byStatus,
    avgCycleTime: computeAvgCycleTime(reqs),
  };
}

function computeAvgCycleTime(reqs) {
  const done = reqs.filter(r => r.status === 'ARCHIVED' && r.createdAt && r.updatedAt);
  if (!done.length) return null;
  const avgMs = done.reduce((sum, r) => sum + (new Date(r.updatedAt) - new Date(r.createdAt)), 0) / done.length;
  const hours = Math.round(avgMs / 3600000);
  return `${hours}h`;
}

// ── 审计日志 ──────────────────────────────────────────────────────────────────

function appendAuditLog(entry) {
  ensureDataDir();
  const logFile = path.join(DATA_DIR, `audit-${new Date().toISOString().slice(0, 10)}.jsonl`);
  fs.appendFileSync(logFile, JSON.stringify({ ...entry, ts: new Date().toISOString() }) + '\n');
}

function readAuditLogs({ date, limit = 100 } = {}) {
  ensureDataDir();
  const target = date || new Date().toISOString().slice(0, 10);
  const logFile = path.join(DATA_DIR, `audit-${target}.jsonl`);
  try {
    return fs.readFileSync(logFile, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(l => JSON.parse(l))
      .slice(-limit);
  } catch {
    return [];
  }
}

module.exports = {
  listRequirements,
  getRequirement,
  upsertRequirement,
  deleteRequirement,
  getStats,
  appendAuditLog,
  readAuditLogs,
  DATA_DIR,
};
