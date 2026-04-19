'use strict';
/**
 * WSD × 飞书 集成适配器
 * 支持：飞书任务、飞书多维表格、飞书文档
 * 配置：.wsd/config.json → integrations.feishu
 */

const https = require('https');

class FeishuAdapter {
  constructor(config) {
    this.appId = config.appId;
    this.appSecret = config.appSecret;
    this.baseUrl = 'https://open.feishu.cn/open-apis';
    this._token = null;
    this._tokenExpiry = 0;
  }

  async _getToken() {
    if (this._token && Date.now() < this._tokenExpiry - 60000) return this._token;
    const res = await this._post('/auth/v3/tenant_access_token/internal', {
      app_id: this.appId,
      app_secret: this.appSecret,
    }, false);
    this._token = res.tenant_access_token;
    this._tokenExpiry = Date.now() + (res.expire || 7200) * 1000;
    return this._token;
  }

  _request(method, path, body, useAuth = true) {
    return new Promise(async (resolve, reject) => {
      const headers = { 'Content-Type': 'application/json; charset=utf-8' };
      if (useAuth) headers['Authorization'] = `Bearer ${await this._getToken()}`;
      const data = body ? JSON.stringify(body) : null;
      if (data) headers['Content-Length'] = Buffer.byteLength(data);

      const url = new URL(this.baseUrl + path);
      const req = https.request({ hostname: url.hostname, port: 443, path: url.pathname + url.search, method, headers }, res => {
        let buf = '';
        res.on('data', c => buf += c);
        res.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve(buf); } });
      });
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  }

  _post(path, body, useAuth = true) { return this._request('POST', path, body, useAuth); }
  _get(path) { return this._request('GET', path, null, true); }

  // ── 任务集成 ────────────────────────────────────────────────────────────────

  // 从飞书任务导入为 WSD 需求
  async importTask(taskId) {
    const res = await this._get(`/task/v2/tasks/${taskId}?user_id_type=open_id`);
    if (res.code !== 0) throw new Error(`飞书API错误: ${res.msg}`);
    const task = res.data.task;
    return {
      title: task.summary,
      description: task.description || '',
      dueDate: task.due?.timestamp,
      externalRef: { system: 'feishu', taskId, url: `https://applink.feishu.cn/client/todo/detail?id=${taskId}` },
      assignees: (task.members || []).filter(m => m.role === 'assignee').map(m => m.id),
    };
  }

  // 创建飞书任务（需求提案时同步）
  async createTask({ title, description, reqId, dueTimestamp }) {
    const body = {
      summary: `[WSD:${reqId}] ${title}`,
      description: description || '',
      ...(dueTimestamp ? { due: { timestamp: String(dueTimestamp), is_all_day: false } } : {}),
      origin: { platform_i18n_name: { zh_cn: 'WSD Manager', en_us: 'WSD Manager' } },
    };
    const res = await this._post('/task/v2/tasks', body);
    if (res.code !== 0) throw new Error(`创建任务失败: ${res.msg}`);
    return res.data.task;
  }

  // 更新任务状态
  async updateTaskStatus(taskId, completed) {
    const res = await this._request('PATCH', `/task/v2/tasks/${taskId}`, {
      task: { completed_at: completed ? String(Date.now()) : '0' },
      update_fields: ['completed_at'],
    });
    if (res.code !== 0) throw new Error(`更新任务失败: ${res.msg}`);
    return res.data.task;
  }

  // ── 多维表格（Bitable）集成 ─────────────────────────────────────────────────

  // 向多维表格追加需求记录
  async appendToBitable(appToken, tableId, record) {
    const res = await this._post(`/bitable/v1/apps/${appToken}/tables/${tableId}/records`, { fields: record });
    if (res.code !== 0) throw new Error(`写入多维表格失败: ${res.msg}`);
    return res.data.record;
  }

  // 查询多维表格中的需求
  async queryBitable(appToken, tableId, filter) {
    const path = `/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=20${filter ? '&filter=' + encodeURIComponent(filter) : ''}`;
    const res = await this._get(path);
    if (res.code !== 0) throw new Error(`查询多维表格失败: ${res.msg}`);
    return res.data.items || [];
  }

  // ── 通知 ───────────────────────────────────────────────────────────────────

  // 发送飞书消息通知（Webhook 方式）
  static async sendWebhook(webhookUrl, { title, content, color = 'green' }) {
    const colorMap = { green: 'turquoise', red: 'red', yellow: 'yellow', blue: 'blue' };
    const body = JSON.stringify({
      msg_type: 'interactive',
      card: {
        header: { title: { tag: 'plain_text', content: title }, template: colorMap[color] || 'blue' },
        elements: [{ tag: 'div', text: { tag: 'lark_md', content } }],
      }
    });
    return new Promise((resolve, reject) => {
      const url = new URL(webhookUrl);
      const req = https.request({
        hostname: url.hostname, port: 443, path: url.pathname + url.search, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      }, res => { let b = ''; res.on('data', c => b += c); res.on('end', () => resolve(JSON.parse(b))); });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}

module.exports = FeishuAdapter;
