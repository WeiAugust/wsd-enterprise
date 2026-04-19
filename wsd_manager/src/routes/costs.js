'use strict';
const express = require('express');
const router = express.Router();
const costs = require('../core/costs');

// GET /api/costs/stats?orgId=&from=&to=
router.get('/stats', (req, res) => {
  try {
    const { orgId, from, to } = req.query;
    res.json({ success: true, data: costs.getStats({ orgId, from, to }) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/costs?orgId=&teamId=&reqId=&limit=
router.get('/', (req, res) => {
  try {
    const { orgId, teamId, reqId, from, to, limit } = req.query;
    const data = costs.listRecords({ orgId, teamId, reqId, from, to, limit: Number(limit) || 100 });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/costs — 记录一次 Token 使用
// Body: { orgId, teamId, reqId, model, inputTokens, outputTokens, operation }
router.post('/', (req, res) => {
  try {
    const record = costs.recordUsage(req.body);
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/costs/pricing — 返回当前定价表
router.get('/pricing', (req, res) => {
  res.json({ success: true, data: costs.PRICING });
});

module.exports = router;
