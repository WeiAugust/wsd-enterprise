'use strict';
/**
 * WSD × Jira 集成适配器
 * 用法：在 .wsd/config.json 中配置 integrations.jira
 */

const https = require('https');
const http = require('http');

class JiraAdapter {
  constructor(config) {
    // config: { baseUrl, email, token, project }
    this.baseUrl = config.baseUrl?.replace(/\/$/, '');
    this.auth = Buffer.from(`${config.email}:${config.token}`).toString('base64');
    this.project = config.project;
    this.issueLabel = config.issueLabel || 'wsd-managed';
  }

  _request(method, path, body) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + path);
      const mod = url.protocol === 'https:' ? https : http;
      const data = body ? JSON.stringify(body) : null;
      const req = mod.request({
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          'Authorization': `Basic ${this.auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        }
      }, (res) => {
        let buf = '';
        res.on('data', c => buf += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(buf) }); }
          catch { resolve({ status: res.statusCode, data: buf }); }
        });
      });
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  }

  // 从 Jira Issue 导入为 WSD 需求
  async importIssue(issueKey) {
    const res = await this._request('GET', `/rest/api/3/issue/${issueKey}`);
    if (res.status !== 200) throw new Error(`Jira API error ${res.status}: ${JSON.stringify(res.data)}`);
    const issue = res.data;
    return {
      title: issue.fields.summary,
      description: issue.fields.description?.content?.[0]?.content?.[0]?.text || '',
      priority: issue.fields.priority?.name || 'Medium',
      externalRef: { system: 'jira', key: issueKey, url: `${this.baseUrl}/browse/${issueKey}` },
      reporter: issue.fields.reporter?.displayName || '',
      assignee: issue.fields.assignee?.displayName || '',
    };
  }

  // 创建 Jira Issue（需求提案时可选同步）
  async createIssue({ title, description, reqId }) {
    const body = {
      fields: {
        project: { key: this.project },
        summary: `[WSD:${reqId}] ${title}`,
        description: { version: 1, type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: description || '' }] }] },
        issuetype: { name: 'Story' },
        labels: [this.issueLabel],
      }
    };
    const res = await this._request('POST', '/rest/api/3/issue', body);
    if (res.status !== 201) throw new Error(`Create issue failed ${res.status}`);
    return res.data;
  }

  // 同步 WSD 状态到 Jira 评论
  async addStatusComment(issueKey, wsdStatus, reqId) {
    const body = {
      body: { version: 1, type: 'doc', content: [{ type: 'paragraph', content: [
        { type: 'text', text: `[WSD 状态更新] ${reqId} → ${wsdStatus}` }
      ]}]}
    };
    await this._request('POST', `/rest/api/3/issue/${issueKey}/comment`, body);
  }

  // 搜索项目 Issues
  async searchIssues(jql, maxResults = 20) {
    const q = encodeURIComponent(jql);
    const res = await this._request('GET', `/rest/api/3/search?jql=${q}&maxResults=${maxResults}&fields=summary,status,priority,assignee`);
    if (res.status !== 200) throw new Error(`Search failed ${res.status}`);
    return res.data.issues || [];
  }
}

module.exports = JiraAdapter;
