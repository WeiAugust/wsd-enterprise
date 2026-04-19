'use strict';
/**
 * Subscriptions Routes — 订阅链接 API
 */
const express = require('express');
const router = express.Router();
const subs = require('../core/subscriptions');
const store = require('../core/assetstore');
const orgs = require('../core/orgs');

// POST /api/subscriptions — 创建订阅
router.post('/', (req, res) => {
  try {
    const { userId, orgId, selectedAssetIds, label, ttlDays } = req.body;
    if (!userId || !orgId || !selectedAssetIds?.length) {
      return res.status(400).json({ success: false, error: 'userId, orgId, selectedAssetIds are required' });
    }

    // 获取该组织可见的必选资产 IDs
    const ancestors = orgs.getAncestors(orgId).map(o => o.id);
    const visibleAssets = store.getVisibleAssets(orgId, ancestors);
    const mandatoryAssetIds = visibleAssets.filter(a => a.mandatory).map(a => a.id);

    const sub = subs.createSubscription({
      userId,
      orgId,
      selectedAssetIds,
      mandatoryAssetIds,
      label,
      ttlDays,
    });
    res.status(201).json({ success: true, data: sub });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/subscriptions — 列出订阅（可按 userId / orgId 过滤）
router.get('/', (req, res) => {
  try {
    const list = subs.listSubscriptions(req.query.userId, req.query.orgId);
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/subscriptions/:id
router.get('/:id', (req, res) => {
  try {
    const sub = subs.getSubscriptionById(req.params.id);
    if (!sub) return res.status(404).json({ success: false, error: 'Subscription not found' });
    res.json({ success: true, data: sub });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/subscriptions/:id
router.delete('/:id', (req, res) => {
  try {
    const sub = subs.deleteSubscription(req.params.id);
    res.json({ success: true, data: sub });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/subscribe/:token — 解析订阅（wsdm install 调用此接口）
// 返回完整的资产内容，供 CLI 安装
router.get('/resolve/:token', (req, res) => {
  try {
    const sub = subs.getSubscription(req.params.token);
    if (!sub) return res.status(404).json({ success: false, error: 'Subscription not found' });
    if (sub.expired) return res.status(410).json({ success: false, error: 'Subscription expired' });

    // 获取所有选中的资产内容
    const assets = sub.selectedAssetIds
      .map(id => store.getAsset(id))
      .filter(Boolean)
      .filter(a => a.status === 'published');

    res.json({
      success: true,
      data: {
        subscription: {
          id: sub.id,
          label: sub.label,
          orgId: sub.orgId,
          createdAt: sub.createdAt,
        },
        assets: assets.map(a => ({
          id: a.id,
          name: a.name,
          type: a.type,
          mandatory: a.mandatory,
          version: a.version,
          description: a.description,
          content: a.content,
          tags: a.tags,
        })),
        mandatoryAssetIds: sub.mandatoryAssetIds,
        installInstructions: generateInstallInstructions(assets),
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 生成安装指引（告诉 CLI 哪些文件放哪里）
 */
function generateInstallInstructions(assets) {
  const instructions = [];
  for (const asset of assets) {
    const dir = getInstallDir(asset.type);
    instructions.push({
      assetId: asset.id,
      name: asset.name,
      type: asset.type,
      targetDir: dir,
      filename: `${asset.name}.md`,
      mandatory: asset.mandatory,
    });
  }
  return instructions;
}

function getInstallDir(type) {
  const dirMap = {
    hook: '.claude/hooks',
    agent: '.claude/agents',
    skill: '.claude/skills',
    command: '.claude/commands',
    rule: '.claude/rules',
    mcp: '.claude/mcp',
    template: '.claude/templates',
  };
  return dirMap[type] || '.claude/assets';
}

module.exports = router;
