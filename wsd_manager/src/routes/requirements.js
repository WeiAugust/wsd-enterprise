'use strict';
const express = require('express');
const router = express.Router();
const reqs = require('../core/requirements');

// GET /api/requirements?status=xxx&team=xxx&owner=xxx
router.get('/', (req, res) => {
  try {
    const { status, team, owner, limit } = req.query;
    const data = reqs.listRequirements({ status, team, owner, limit: parseInt(limit) || 50 });
    res.json({ success: true, data, total: data.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/requirements/stats
router.get('/stats', (req, res) => {
  try {
    res.json({ success: true, data: reqs.getStats() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/requirements/audit?date=YYYY-MM-DD
router.get('/audit', (req, res) => {
  try {
    const { date, limit } = req.query;
    const data = reqs.readAuditLogs({ date, limit: parseInt(limit) || 100 });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/requirements/:reqId
router.get('/:reqId', (req, res) => {
  try {
    const data = reqs.getRequirement(req.params.reqId);
    if (!data) return res.status(404).json({ success: false, error: 'Requirement not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/requirements — create or update
router.post('/', (req, res) => {
  try {
    const { reqId, title, status, team, owner, description } = req.body;
    if (!reqId || !title) {
      return res.status(400).json({ success: false, error: 'reqId and title are required' });
    }
    const data = reqs.upsertRequirement({ reqId, title, status: status || 'PROPOSED', team, owner, description });
    reqs.appendAuditLog({ event: 'UPSERTED', reqId, actor: req.headers['x-actor'] || 'api' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/requirements/:reqId/status
router.patch('/:reqId/status', (req, res) => {
  try {
    const { status, actor, comment } = req.body;
    if (!status) return res.status(400).json({ success: false, error: 'status is required' });

    const existing = reqs.getRequirement(req.params.reqId);
    if (!existing) return res.status(404).json({ success: false, error: 'Requirement not found' });

    const updated = reqs.upsertRequirement({ ...existing, status });
    reqs.appendAuditLog({ event: 'STATUS_CHANGED', reqId: req.params.reqId, from: existing.status, to: status, actor, comment });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/requirements/:reqId
router.delete('/:reqId', (req, res) => {
  try {
    const ok = reqs.deleteRequirement(req.params.reqId);
    if (!ok) return res.status(404).json({ success: false, error: 'Requirement not found' });
    reqs.appendAuditLog({ event: 'DELETED', reqId: req.params.reqId, actor: req.headers['x-actor'] || 'api' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
