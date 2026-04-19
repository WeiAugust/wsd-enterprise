'use strict';
/**
 * Orgs — 组织架构管理
 * 层级：enterprise → department → team → repository
 * 每个层级可指定管理员
 */

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const DATA_DIR = path.resolve(process.env.WSD_DATA_DIR || path.join(__dirname, '../../data'));
const ORGS_FILE = path.join(DATA_DIR, 'orgs.json');

const ORG_TYPES = ['enterprise', 'department', 'team', 'repository'];

// ── 持久化 ────────────────────────────────────────────────────────────────────

function loadOrgs() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(ORGS_FILE)) return seedOrgs();
    return JSON.parse(fs.readFileSync(ORGS_FILE, 'utf8'));
  } catch {
    return { orgs: [] };
  }
}

function saveOrgs(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ORGS_FILE, JSON.stringify(data, null, 2));
}

function seedOrgs() {
  const data = {
    orgs: [
      {
        id: 'ent-default',
        name: '企业总部',
        type: 'enterprise',
        parentId: null,
        admins: [],
        description: '企业根组织',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ]
  };
  saveOrgs(data);
  return data;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

function listOrgs(parentId) {
  const { orgs } = loadOrgs();
  if (parentId !== undefined) {
    return orgs.filter(o => o.parentId === parentId);
  }
  return orgs;
}

function getOrg(id) {
  const { orgs } = loadOrgs();
  return orgs.find(o => o.id === id) || null;
}

function createOrg({ name, type, parentId = null, description = '', admins = [] }) {
  if (!name) throw new Error('name is required');
  if (!ORG_TYPES.includes(type)) throw new Error(`type must be one of: ${ORG_TYPES.join(', ')}`);

  // validate parent type hierarchy
  if (parentId) {
    const parent = getOrg(parentId);
    if (!parent) throw new Error(`Parent org ${parentId} not found`);
    const parentIdx = ORG_TYPES.indexOf(parent.type);
    const childIdx = ORG_TYPES.indexOf(type);
    if (childIdx !== parentIdx + 1) {
      throw new Error(`A ${type} must be a direct child of ${ORG_TYPES[childIdx - 1]}`);
    }
  }

  const data = loadOrgs();
  const org = {
    id: `${type.slice(0, 4)}-${randomUUID().slice(0, 8)}`,
    name,
    type,
    parentId,
    admins,
    description,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.orgs.push(org);
  saveOrgs(data);
  return org;
}

function updateOrg(id, updates) {
  const data = loadOrgs();
  const idx = data.orgs.findIndex(o => o.id === id);
  if (idx < 0) throw new Error(`Org ${id} not found`);
  data.orgs[idx] = {
    ...data.orgs[idx],
    ...updates,
    id,
    type: data.orgs[idx].type, // immutable
    updatedAt: new Date().toISOString(),
  };
  saveOrgs(data);
  return data.orgs[idx];
}

function deleteOrg(id) {
  const data = loadOrgs();
  const org = data.orgs.find(o => o.id === id);
  if (!org) throw new Error(`Org ${id} not found`);
  // check no children
  const children = data.orgs.filter(o => o.parentId === id);
  if (children.length > 0) throw new Error(`Cannot delete org with children`);
  data.orgs = data.orgs.filter(o => o.id !== id);
  saveOrgs(data);
  return org;
}

// ── 管理员管理 ────────────────────────────────────────────────────────────────

function addAdmin(orgId, userId) {
  const data = loadOrgs();
  const idx = data.orgs.findIndex(o => o.id === orgId);
  if (idx < 0) throw new Error(`Org ${orgId} not found`);
  if (!data.orgs[idx].admins.includes(userId)) {
    data.orgs[idx].admins.push(userId);
    data.orgs[idx].updatedAt = new Date().toISOString();
    saveOrgs(data);
  }
  return data.orgs[idx];
}

function removeAdmin(orgId, userId) {
  const data = loadOrgs();
  const idx = data.orgs.findIndex(o => o.id === orgId);
  if (idx < 0) throw new Error(`Org ${orgId} not found`);
  data.orgs[idx].admins = data.orgs[idx].admins.filter(id => id !== userId);
  data.orgs[idx].updatedAt = new Date().toISOString();
  saveOrgs(data);
  return data.orgs[idx];
}

// ── 层级查询 ──────────────────────────────────────────────────────────────────

function getAncestors(orgId) {
  const { orgs } = loadOrgs();
  const map = Object.fromEntries(orgs.map(o => [o.id, o]));
  const result = [];
  let current = map[orgId];
  while (current && current.parentId) {
    current = map[current.parentId];
    if (current) result.unshift(current);
  }
  return result;
}

function getDescendants(orgId) {
  const { orgs } = loadOrgs();
  const result = [];
  const queue = [orgId];
  while (queue.length) {
    const id = queue.shift();
    const children = orgs.filter(o => o.parentId === id);
    for (const child of children) {
      result.push(child);
      queue.push(child.id);
    }
  }
  return result;
}

function buildTree() {
  const { orgs } = loadOrgs();
  const map = {};
  for (const org of orgs) {
    map[org.id] = { ...org, children: [] };
  }
  const roots = [];
  for (const org of orgs) {
    if (org.parentId && map[org.parentId]) {
      map[org.parentId].children.push(map[org.id]);
    } else {
      roots.push(map[org.id]);
    }
  }
  return roots;
}

// ── 权限检查 ──────────────────────────────────────────────────────────────────

function isAdmin(orgId, userId) {
  const org = getOrg(orgId);
  if (!org) return false;
  // check this org and all ancestors
  const ancestors = getAncestors(orgId);
  return [org, ...ancestors].some(o => o.admins.includes(userId));
}

module.exports = {
  listOrgs,
  getOrg,
  createOrg,
  updateOrg,
  deleteOrg,
  addAdmin,
  removeAdmin,
  getAncestors,
  getDescendants,
  buildTree,
  isAdmin,
  ORG_TYPES,
};
