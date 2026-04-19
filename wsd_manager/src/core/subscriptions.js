'use strict';
/**
 * Subscriptions — 订阅链接管理
 * 用户选择资产 → 生成订阅 token → wsdm install <url> 安装到本地
 */

const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');

const DATA_DIR = path.resolve(process.env.WSD_DATA_DIR || path.join(__dirname, '../../data'));
const SUBS_FILE = path.join(DATA_DIR, 'subscriptions.json');

// ── 持久化 ────────────────────────────────────────────────────────────────────

function loadSubs() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(SUBS_FILE)) return { subscriptions: [] };
    return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8'));
  } catch {
    return { subscriptions: [] };
  }
}

function saveSubs(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SUBS_FILE, JSON.stringify(data, null, 2));
}

// ── 生成订阅 ──────────────────────────────────────────────────────────────────

/**
 * 创建订阅
 * @param {object} options
 * @param {string} options.userId - 订阅者 ID
 * @param {string} options.orgId - 所属组织 ID
 * @param {string[]} options.selectedAssetIds - 用户选中的资产 ID（含必选）
 * @param {string[]} options.mandatoryAssetIds - 必选资产 ID
 * @param {string} [options.label] - 订阅名称
 * @param {number|null} [options.ttlDays] - 有效期天数，null=永不过期
 */
function createSubscription({ userId, orgId, selectedAssetIds, mandatoryAssetIds, label = '', ttlDays = null }) {
  if (!userId || !orgId || !selectedAssetIds?.length) {
    throw new Error('userId, orgId, selectedAssetIds are required');
  }

  // 确保必选资产都包含在内
  const allIds = Array.from(new Set([...mandatoryAssetIds, ...selectedAssetIds]));

  const token = randomBytes(20).toString('hex');
  const now = new Date();
  const sub = {
    id: `sub-${token.slice(0, 8)}`,
    token,
    label,
    userId,
    orgId,
    selectedAssetIds: allIds,
    mandatoryAssetIds,
    createdAt: now.toISOString(),
    expiresAt: ttlDays ? new Date(now.getTime() + ttlDays * 86400000).toISOString() : null,
  };

  const data = loadSubs();
  data.subscriptions.push(sub);
  saveSubs(data);
  return sub;
}

function getSubscription(token) {
  const { subscriptions } = loadSubs();
  const sub = subscriptions.find(s => s.token === token);
  if (!sub) return null;
  if (sub.expiresAt && new Date(sub.expiresAt) < new Date()) {
    return { ...sub, expired: true };
  }
  return sub;
}

function getSubscriptionById(id) {
  const { subscriptions } = loadSubs();
  return subscriptions.find(s => s.id === id) || null;
}

function listSubscriptions(userId, orgId) {
  const { subscriptions } = loadSubs();
  if (userId && orgId) {
    // 个人订阅 + 同 org 的团队订阅（去重）
    const set = new Set();
    return subscriptions.filter(s => {
      if ((s.userId === userId || s.orgId === orgId) && !set.has(s.id)) {
        set.add(s.id);
        return true;
      }
      return false;
    });
  }
  if (userId) return subscriptions.filter(s => s.userId === userId);
  if (orgId) return subscriptions.filter(s => s.orgId === orgId);
  return subscriptions;
}

function deleteSubscription(id) {
  const data = loadSubs();
  const sub = data.subscriptions.find(s => s.id === id);
  if (!sub) throw new Error(`Subscription ${id} not found`);
  data.subscriptions = data.subscriptions.filter(s => s.id !== id);
  saveSubs(data);
  return sub;
}

module.exports = {
  createSubscription,
  getSubscription,
  getSubscriptionById,
  listSubscriptions,
  deleteSubscription,
};
