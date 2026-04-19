'use strict';
const express = require('express');
const router = express.Router();
const orgs = require('../core/orgs');

// GET /api/orgs — 列出所有组织（可按 parentId 过滤）
router.get('/', (req, res) => {
  try {
    const { parentId, tree } = req.query;
    if (tree === '1' || tree === 'true') {
      return res.json({ success: true, data: orgs.buildTree() });
    }
    const list = orgs.listOrgs(parentId);
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/orgs/:id — 获取单个组织
router.get('/:id', (req, res) => {
  try {
    const org = orgs.getOrg(req.params.id);
    if (!org) return res.status(404).json({ success: false, error: 'Org not found' });
    res.json({ success: true, data: org });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/orgs — 创建组织
router.post('/', (req, res) => {
  try {
    const org = orgs.createOrg(req.body);
    res.status(201).json({ success: true, data: org });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/orgs/:id — 更新组织
router.put('/:id', (req, res) => {
  try {
    const org = orgs.updateOrg(req.params.id, req.body);
    res.json({ success: true, data: org });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/orgs/:id — 删除组织
router.delete('/:id', (req, res) => {
  try {
    const org = orgs.deleteOrg(req.params.id);
    res.json({ success: true, data: org });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/orgs/:id/admins — 添加管理员
router.post('/:id/admins', (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });
    const org = orgs.addAdmin(req.params.id, userId);
    res.json({ success: true, data: org });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/orgs/:id/admins/:userId — 移除管理员
router.delete('/:id/admins/:userId', (req, res) => {
  try {
    const org = orgs.removeAdmin(req.params.id, req.params.userId);
    res.json({ success: true, data: org });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/orgs/:id/ancestors — 获取祖先链
router.get('/:id/ancestors', (req, res) => {
  try {
    const ancestors = orgs.getAncestors(req.params.id);
    res.json({ success: true, data: ancestors });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/orgs/:id/descendants — 获取所有子孙
router.get('/:id/descendants', (req, res) => {
  try {
    const descendants = orgs.getDescendants(req.params.id);
    res.json({ success: true, data: descendants });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
