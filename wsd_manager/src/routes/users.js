'use strict';
const express = require('express');
const router = express.Router();
const users = require('../core/users');

// GET /api/users — 列出用户（可按 orgId 过滤）
router.get('/', (req, res) => {
  try {
    const list = users.listUsers(req.query.orgId);
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/users/:id
router.get('/:id', (req, res) => {
  try {
    const user = users.getUser(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/users
router.post('/', (req, res) => {
  try {
    const user = users.createUser(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/users/:id
router.put('/:id', (req, res) => {
  try {
    const user = users.updateUser(req.params.id, req.body);
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/users/:id
router.delete('/:id', (req, res) => {
  try {
    const user = users.deleteUser(req.params.id);
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
