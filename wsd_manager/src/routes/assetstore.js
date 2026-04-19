'use strict';
/**
 * AssetStore Routes — 新版资产管理 API（含发布工作流）
 */
const express = require('express');
const router = express.Router();
const store = require('../core/assetstore');
const orgs = require('../core/orgs');

// GET /api/assetstore — 列出资产（支持 orgId/type/status/mandatory 过滤）
router.get('/', (req, res) => {
  try {
    const { orgId, type, status, mandatory } = req.query;
    const filters = {};
    if (orgId) filters.orgId = orgId;
    if (type) filters.type = type;
    if (status) filters.status = status;
    if (mandatory !== undefined) filters.mandatory = mandatory === 'true';
    const list = store.listAssets(filters);
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/assetstore/visible — 获取对某组织可见的已发布资产
router.get('/visible', (req, res) => {
  try {
    const { orgId } = req.query;
    if (!orgId) return res.status(400).json({ success: false, error: 'orgId is required' });
    const ancestors = orgs.getAncestors(orgId).map(o => o.id);
    const list = store.getVisibleAssets(orgId, ancestors);
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/assetstore/:id
router.get('/:id', (req, res) => {
  try {
    const asset = store.getAsset(req.params.id);
    if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });
    res.json({ success: true, data: asset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/assetstore
router.post('/', (req, res) => {
  try {
    const asset = store.createAsset(req.body);
    res.status(201).json({ success: true, data: asset });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/assetstore/:id
router.put('/:id', (req, res) => {
  try {
    const asset = store.updateAsset(req.params.id, req.body);
    res.json({ success: true, data: asset });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/assetstore/:id
router.delete('/:id', (req, res) => {
  try {
    const asset = store.deleteAsset(req.params.id);
    res.json({ success: true, data: asset });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/assetstore/:id/submit — 提交审核
router.post('/:id/submit', (req, res) => {
  try {
    const asset = store.submitForReview(req.params.id);
    res.json({ success: true, data: asset });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/assetstore/:id/publish — 发布资产（需要管理员权限）
router.post('/:id/publish', (req, res) => {
  try {
    const { publishedBy } = req.body;
    if (!publishedBy) return res.status(400).json({ success: false, error: 'publishedBy is required' });

    const asset = store.getAsset(req.params.id);
    if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });

    // 权限检查：发布者必须是该资产所属组织的管理员
    if (!orgs.isAdmin(asset.orgId, publishedBy)) {
      return res.status(403).json({ success: false, error: 'Only org admins can publish assets' });
    }

    const { note } = req.body;
    const updated = store.publishAsset(req.params.id, publishedBy, note);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/assetstore/:id/unpublish — 取消发布
router.post('/:id/unpublish', (req, res) => {
  try {
    const asset = store.unpublishAsset(req.params.id);
    res.json({ success: true, data: asset });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── 多文件管理 ────────────────────────────────────────────────────────────────

// PUT /api/assetstore/:id/files/:fileName — 新增或更新附加文件（路径用 base64 或 query 传）
router.put('/:id/files', (req, res) => {
  try {
    const { fileName, content, description } = req.body;
    if (!fileName || content === undefined) {
      return res.status(400).json({ success: false, error: 'fileName and content are required' });
    }
    const asset = store.upsertExtraFile(req.params.id, fileName, content, description);
    res.json({ success: true, data: asset });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/assetstore/:id/files — 删除附加文件
router.delete('/:id/files', (req, res) => {
  try {
    const { fileName } = req.body;
    if (!fileName) return res.status(400).json({ success: false, error: 'fileName is required' });
    const asset = store.removeExtraFile(req.params.id, fileName);
    res.json({ success: true, data: asset });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── 依赖关系管理 ─────────────────────────────────────────────────────────────

// GET /api/assetstore/:id/dependencies — 获取依赖图
router.get('/:id/dependencies', (req, res) => {
  try {
    const graph = store.getDependencyGraph(req.params.id);
    res.json({ success: true, data: graph });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/assetstore/:id/dependencies — 添加依赖关系
router.post('/:id/dependencies', (req, res) => {
  try {
    const dep = store.addDependency(req.params.id, req.body);
    res.status(201).json({ success: true, data: dep });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/assetstore/:id/dependencies/:depId — 删除依赖关系
router.delete('/:id/dependencies/:depId', (req, res) => {
  try {
    const asset = store.removeDependency(req.params.id, req.params.depId);
    res.json({ success: true, data: asset });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/assetstore/meta/types — 返回所有资产类型元数据
router.get('/meta/types', (req, res) => {
  res.json({ success: true, data: store.TYPE_META });
});

module.exports = router;
