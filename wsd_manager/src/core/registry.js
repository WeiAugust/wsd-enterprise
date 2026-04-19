'use strict';
/**
 * Registry — 资产注册中心核心模块
 * 负责：读取/写入/继承解析 四层资产
 */

const fs = require('fs');
const path = require('path');

const REGISTRY_DIR = path.resolve(__dirname, '../../registry');

const LAYERS = ['enterprise', 'departments', 'teams'];

// ── 读取 ──────────────────────────────────────────────────────────────────────

function readIndex(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function getEnterprise() {
  return readIndex(path.join(REGISTRY_DIR, 'enterprise', 'index.json'));
}

function getDepartment(deptId) {
  return readIndex(path.join(REGISTRY_DIR, 'departments', deptId, 'index.json'));
}

function getTeam(teamId) {
  // teams may be nested under departments or flat
  const flatPath = path.join(REGISTRY_DIR, 'teams', teamId, 'index.json');
  if (fs.existsSync(flatPath)) return readIndex(flatPath);

  // search under departments
  const depts = listDepartments();
  for (const dept of depts) {
    const nested = path.join(REGISTRY_DIR, 'departments', dept.id, 'teams', teamId, 'index.json');
    if (fs.existsSync(nested)) return readIndex(nested);
  }
  return null;
}

// ── 列表 ──────────────────────────────────────────────────────────────────────

function listDepartments() {
  const dir = path.join(REGISTRY_DIR, 'departments');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => fs.statSync(path.join(dir, f)).isDirectory())
    .map(id => ({ id, ...readIndex(path.join(dir, id, 'index.json')) }))
    .filter(Boolean);
}

function listTeams() {
  const result = [];
  // flat teams/
  const flatDir = path.join(REGISTRY_DIR, 'teams');
  if (fs.existsSync(flatDir)) {
    fs.readdirSync(flatDir)
      .filter(f => fs.statSync(path.join(flatDir, f)).isDirectory())
      .forEach(id => result.push({ id, _source: 'teams', ...readIndex(path.join(flatDir, id, 'index.json')) }));
  }
  return result;
}

// ── 继承解析器 ────────────────────────────────────────────────────────────────

/**
 * 解析某个上下文下的有效资产（五层继承合并）
 * 优先级（高 → 低）：individual > repo > team > department > enterprise
 */
function resolveAssets({ teamId, deptId } = {}) {
  const layers = [];

  const enterprise = getEnterprise();
  if (enterprise) layers.push({ _name: 'enterprise', ...enterprise.assets });

  if (deptId) {
    const dept = getDepartment(deptId);
    if (dept) layers.push({ _name: `dept:${deptId}`, ...dept.assets });
  }

  if (teamId) {
    const team = getTeam(teamId);
    if (team) layers.push({ _name: `team:${teamId}`, ...team.assets });
  }

  const resolved = {
    agents: {},
    skills: {},
    commands: {},
    rules: {},
    hooks: [],
    mcp: {},
  };

  for (const layer of layers) {
    const layerName = layer._name;

    for (const type of ['agents', 'skills', 'commands', 'rules', 'mcp']) {
      for (const asset of (layer[type] || [])) {
        resolved[type][asset.name] = { ...asset, _layer: layerName };
      }
    }

    for (const hook of (layer.hooks || [])) {
      resolved.hooks.push({ ...hook, _layer: layerName });
    }
  }

  // 将对象形式的 agents/skills 等转回数组
  const output = { hooks: resolved.hooks };
  for (const type of ['agents', 'skills', 'commands', 'rules', 'mcp']) {
    output[type] = Object.values(resolved[type]);
  }
  return output;
}

// ── 写入 ──────────────────────────────────────────────────────────────────────

function upsertTeamAsset(teamId, assetType, asset) {
  const teamDir = path.join(REGISTRY_DIR, 'teams', teamId);
  const indexPath = path.join(teamDir, 'index.json');

  fs.mkdirSync(teamDir, { recursive: true });

  let index = readIndex(indexPath) || {
    layer: 'team',
    teamId,
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    assets: {}
  };

  if (!index.assets[assetType]) index.assets[assetType] = [];

  const existing = index.assets[assetType].findIndex(a => a.name === asset.name);
  if (existing >= 0) {
    index.assets[assetType][existing] = { ...index.assets[assetType][existing], ...asset };
  } else {
    index.assets[assetType].push(asset);
  }

  index.updatedAt = new Date().toISOString();
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  return index;
}

// ── 统计 ──────────────────────────────────────────────────────────────────────

function getStats() {
  const enterprise = getEnterprise();
  const teams = listTeams();

  const countAssets = (index) => {
    if (!index || !index.assets) return 0;
    return Object.values(index.assets).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
  };

  return {
    enterprise: {
      totalAssets: countAssets(enterprise),
      layers: enterprise ? Object.keys(enterprise.assets || {}) : []
    },
    teams: {
      count: teams.length,
      list: teams.map(t => ({ id: t.id, teamId: t.teamId, totalAssets: countAssets(t) }))
    },
    totalManagedAssets: countAssets(enterprise) + teams.reduce((s, t) => s + countAssets(t), 0)
  };
}

module.exports = {
  getEnterprise,
  getDepartment,
  getTeam,
  listDepartments,
  listTeams,
  resolveAssets,
  upsertTeamAsset,
  getStats,
  REGISTRY_DIR,
};
