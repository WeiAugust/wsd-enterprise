'use strict';
/**
 * WSD Manager API Server
 * 企业级 Claude Code 资产管理平台
 *
 * 端口：3030（默认）
 * 环境变量：
 *   PORT        - 监听端口（默认 3030）
 *   WSD_DATA_DIR - 数据存储目录（默认 .wsd-manager-data/）
 *   AUTH_TOKEN  - API 鉴权 Token（不设置则无鉴权，仅开发环境）
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const assetsRouter = require('./routes/assets');
const requirementsRouter = require('./routes/requirements');
const orgsRouter = require('./routes/orgs');
const usersRouter = require('./routes/users');
const assetstoreRouter = require('./routes/assetstore');
const subscriptionsRouter = require('./routes/subscriptions');
const costsRouter = require('./routes/costs');

const app = express();
const PORT = parseInt(process.env.PORT || '3030', 10);

// ── 中间件 ────────────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

// 简单 Token 鉴权（生产建议换成 JWT 或 OAuth）
const AUTH_TOKEN = process.env.AUTH_TOKEN;
if (AUTH_TOKEN) {
  app.use('/api', (req, res, next) => {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (token !== AUTH_TOKEN) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    next();
  });
}

// 请求日志（简版）
app.use((req, _res, next) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  }
  next();
});

// ── API 路由 ──────────────────────────────────────────────────────────────────

app.use('/api/assets', assetsRouter);
app.use('/api/requirements', requirementsRouter);
app.use('/api/orgs', orgsRouter);
app.use('/api/users', usersRouter);
app.use('/api/assetstore', assetstoreRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/costs', costsRouter);

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: require('../package.json').version || '1.0.0',
    timestamp: new Date().toISOString(),
    dataDir: process.env.WSD_DATA_DIR || '.wsd-manager-data',
  });
});

// GET /api/info
app.get('/api/info', (req, res) => {
  const registry = require('./core/registry');
  const reqs = require('./core/requirements');
  try {
    res.json({
      success: true,
      data: {
        registry: registry.getStats(),
        requirements: reqs.getStats(),
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 静态 Web UI ───────────────────────────────────────────────────────────────

const webDir = path.join(__dirname, '../web/public');
if (fs.existsSync(webDir)) {
  app.use(express.static(webDir));
  // SPA fallback
  app.get('*', (req, res) => {
    const indexFile = path.join(webDir, 'index.html');
    if (fs.existsSync(indexFile)) {
      res.sendFile(indexFile);
    } else {
      res.status(404).send('Web UI not found');
    }
  });
}

// ── 错误处理 ──────────────────────────────────────────────────────────────────

app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ── 启动 ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════╗
║   WSD Manager API Server                 ║
║   http://localhost:${PORT}                  ║
║                                          ║
║   API:    /api/orgs       组织架构       ║
║          /api/users      用户管理        ║
║          /api/assetstore 资产管理        ║
║          /api/subscriptions 订阅链接     ║
║          /api/health                     ║
║   Web UI: http://localhost:${PORT}           ║
╚══════════════════════════════════════════╝
`);
  });
}

module.exports = app; // for testing
