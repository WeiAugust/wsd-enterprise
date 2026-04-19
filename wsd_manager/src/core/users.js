'use strict';
/**
 * Users — 用户管理
 * 用户属于某个组织节点（可以是任意层级）
 */

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const DATA_DIR = path.resolve(process.env.WSD_DATA_DIR || path.join(__dirname, '../../data'));
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// ── 持久化 ────────────────────────────────────────────────────────────────────

function loadUsers() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(USERS_FILE)) return { users: [] };
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch {
    return { users: [] };
  }
}

function saveUsers(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

function listUsers(orgId) {
  const { users } = loadUsers();
  if (orgId !== undefined) {
    return users.filter(u => u.orgId === orgId);
  }
  return users;
}

function getUser(id) {
  const { users } = loadUsers();
  return users.find(u => u.id === id) || null;
}

function createUser({ name, email, orgId, role = 'member', avatar = '' }) {
  if (!name || !email || !orgId) throw new Error('name, email, orgId are required');

  const data = loadUsers();
  if (data.users.find(u => u.email === email)) {
    throw new Error(`User with email ${email} already exists`);
  }

  const user = {
    id: `usr-${randomUUID().slice(0, 8)}`,
    name,
    email,
    orgId,
    role,       // 'admin' | 'member'
    avatar,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.users.push(user);
  saveUsers(data);
  return user;
}

function updateUser(id, updates) {
  const data = loadUsers();
  const idx = data.users.findIndex(u => u.id === id);
  if (idx < 0) throw new Error(`User ${id} not found`);
  data.users[idx] = {
    ...data.users[idx],
    ...updates,
    id,
    email: data.users[idx].email, // immutable
    updatedAt: new Date().toISOString(),
  };
  saveUsers(data);
  return data.users[idx];
}

function deleteUser(id) {
  const data = loadUsers();
  const user = data.users.find(u => u.id === id);
  if (!user) throw new Error(`User ${id} not found`);
  data.users = data.users.filter(u => u.id !== id);
  saveUsers(data);
  return user;
}

function getUsersByOrgs(orgIds) {
  const { users } = loadUsers();
  return users.filter(u => orgIds.includes(u.orgId));
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getUsersByOrgs,
};
