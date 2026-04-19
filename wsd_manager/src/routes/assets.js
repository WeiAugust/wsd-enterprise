'use strict';
const express = require('express');
const router = express.Router();
const registry = require('../core/registry');

// GET /api/assets/resolve?teamId=xxx&deptId=xxx
router.get('/resolve', (req, res) => {
  try {
    const { teamId, deptId } = req.query;
    const resolved = registry.resolveAssets({ teamId, deptId });
    res.json({ success: true, data: resolved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/assets/stats
router.get('/stats', (req, res) => {
  try {
    res.json({ success: true, data: registry.getStats() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/assets/enterprise
router.get('/enterprise', (req, res) => {
  try {
    const data = registry.getEnterprise();
    if (!data) return res.status(404).json({ success: false, error: 'Enterprise registry not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/assets/teams
router.get('/teams', (req, res) => {
  try {
    res.json({ success: true, data: registry.listTeams() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/assets/teams/:teamId
router.get('/teams/:teamId', (req, res) => {
  try {
    const data = registry.getTeam(req.params.teamId);
    if (!data) return res.status(404).json({ success: false, error: 'Team not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/assets/teams/:teamId/:assetType
// Body: { name, file, description, version, tags }
router.post('/teams/:teamId/:assetType', (req, res) => {
  try {
    const { teamId, assetType } = req.params;
    const validTypes = ['agents', 'skills', 'commands', 'rules', 'mcp'];
    if (!validTypes.includes(assetType)) {
      return res.status(400).json({ success: false, error: `Invalid asset type. Must be one of: ${validTypes.join(', ')}` });
    }
    const result = registry.upsertTeamAsset(teamId, assetType, req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/assets/departments
router.get('/departments', (req, res) => {
  try {
    res.json({ success: true, data: registry.listDepartments() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
