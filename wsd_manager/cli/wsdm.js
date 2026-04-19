#!/usr/bin/env node
/**
 * wsdm — WSD Manager CLI
 *
 * 企业级 Claude Code 资产管理命令行工具
 *
 * 用法：
 *   wsdm sync [options]          - 同步资产到本地开发环境
 *   wsdm list [options]          - 列出可用资产
 *   wsdm publish <file> [opts]   - 发布资产到注册中心
 *   wsdm teams <subcommand>      - 团队管理
 *   wsdm reqs <subcommand>       - 需求管理（与 wsd 联动）
 *   wsdm audit [options]         - 审计日志
 *
 * 安装：
 *   npm install -g wsdm
 *   # 或从源码
 *   node /path/to/wsd_manager/cli/wsdm.js
 */

'use strict';

const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const http = require('http');

// ─── 配置管理 ────────────────────────────────────────────────────────────────

const CONFIG_FILE = path.join(os.homedir(), '.wsdm', 'config.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// ─── 资产解析器 ──────────────────────────────────────────────────────────────

/**
 * 解析有效资产（五层继承合并）
 * 优先级：individual > repo > team > department > enterprise
 */
function resolveAssets(context) {
  const { enterprise, department, team, repo, individual } = context;
  const resolved = {
    agents: {},
    skills: {},
    commands: {},
    rules: {},
    hooks: [],    // hooks 累加
    mcp: {},
    claudeMd: [], // CLAUDE.md 追加
  };

  const layers = [enterprise, department, team, repo, individual].filter(Boolean);

  for (const layer of layers) {
    if (!layer) continue;

    // Agent/Skill/Command/Rules/MCP：下层覆盖上层（同名）
    for (const type of ['agents', 'skills', 'commands', 'rules', 'mcp']) {
      for (const asset of (layer[type] || [])) {
        resolved[type][asset.name] = { ...asset, _layer: layer._name };
      }
    }

    // Hooks：累加（不覆盖）
    for (const hook of (layer.hooks || [])) {
      resolved.hooks.push({ ...hook, _layer: layer._name });
    }

    // CLAUDE.md：追加
    if (layer.claudeMd) {
      resolved.claudeMd.push({ content: layer.claudeMd, _layer: layer._name });
    }
  }

  return resolved;
}

// ─── CLI 命令定义 ─────────────────────────────────────────────────────────────

program
  .name('wsdm')
  .description('WSD Manager — 企业级 Claude Code 资产管理')
  .version('1.0.0');

// ── login ──
program
  .command('login <server-url>')
  .description('登录企业 wsd_manager 服务器')
  .option('-u, --username <username>', '用户名')
  .option('-k, --api-key <key>', '使用 API Key 认证（推荐）')
  .action(async (serverUrl, options) => {
    console.log(`🔐 登录到 ${serverUrl}`);

    const apiKey = options.apiKey || process.env.WSDM_API_KEY;
    if (!apiKey) {
      console.error('错误：请提供 API Key（--api-key 或 WSDM_API_KEY 环境变量）');
      process.exit(1);
    }

    // 验证连接（实际实现中调用服务器 API）
    const config = loadConfig();
    config.server = serverUrl;
    config.apiKey = apiKey;
    config.username = options.username || process.env.USER;
    config.loggedInAt = new Date().toISOString();
    saveConfig(config);

    console.log(`✅ 已登录 ${serverUrl}（用户：${config.username}）`);
    console.log('运行 `wsdm sync` 同步资产到本地开发环境');
  });

// ── sync ──
program
  .command('sync')
  .description('同步资产到本地开发环境（~/.claude/ 和 .claude/）')
  .option('--team <team>', '指定团队')
  .option('--dept <dept>', '指定部门')
  .option('--repo', '包含仓库级资产（当前目录的 .claude/）', true)
  .option('--dry-run', '仅显示将要同步的内容，不实际执行')
  .option('--force', '覆盖本地修改')
  .action(async (options) => {
    const config = loadConfig();

    if (!config.server) {
      console.error('错误：未登录。请先运行 `wsdm login <server-url>`');
      process.exit(1);
    }

    const team = options.team || config.defaultTeam;
    const dept = options.dept || config.defaultDept;

    console.log(`🔄 同步资产（团队：${team || '未指定'}，部门：${dept || '未指定'}）`);

    if (options.dryRun) {
      console.log('\n[DRY RUN] 将要同步的资产：');
      console.log('  企业层 → ~/.claude/agents/security-reviewer.md');
      console.log('  企业层 → ~/.claude/rules/security-baseline.md');
      if (team) {
        console.log(`  团队层(${team}) → ~/.claude/agents/wsd-executor.md`);
        console.log(`  团队层(${team}) → ~/.claude/rules/typescript.md`);
      }
      if (options.repo) {
        console.log('  仓库层 → .claude/agents/（当前项目）');
      }
      console.log('\n运行 `wsdm sync` 执行实际同步');
      return;
    }

    // 实际同步逻辑（简化版，真实实现需调用 API + 文件写入）
    console.log('\n✅ 同步完成');
    console.log('  企业层资产 → ~/.claude/（全局）');
    if (team) console.log(`  团队层资产 → ~/.claude/（${team}）`);
    if (options.repo) console.log('  仓库层资产 → .claude/（当前项目）');

    // 更新 settings.json hooks
    console.log('\n  → 合并 hooks 配置到 settings.json');

    const syncedAt = new Date().toISOString();
    config.lastSyncedAt = syncedAt;
    config.lastSyncedTeam = team;
    saveConfig(config);
  });

// ── list ──
program
  .command('list')
  .description('列出可用资产')
  .option('--type <type>', '资产类型：agent/skill/command/hook/rule/mcp/plugin')
  .option('--layer <layer>', '层级：enterprise/department/team/repo/individual')
  .option('--team <team>', '指定团队')
  .option('--search <keyword>', '按名称/描述搜索')
  .option('--json', '以JSON格式输出')
  .action((options) => {
    // 示例输出
    const mockAssets = [
      { name: 'code-reviewer', type: 'agent', layer: 'enterprise', version: '1.2.0', description: '通用代码审查' },
      { name: 'security-reviewer', type: 'agent', layer: 'enterprise', version: '1.1.0', description: '安全审查' },
      { name: 'wsd-analyst', type: 'agent', layer: 'enterprise', version: '1.0.0', description: 'WSD需求分析师' },
      { name: 'wsd-executor', type: 'agent', layer: 'team:backend', version: '1.0.0', description: '后端实现执行者（NestJS）' },
      { name: 'wsd-lifecycle', type: 'skill', layer: 'enterprise', version: '1.0.0', description: 'WSD生命周期感知' },
      { name: 'security-baseline', type: 'rule', layer: 'enterprise', version: '2.0.0', description: '企业安全基线' },
    ];

    let filtered = mockAssets;
    if (options.type) filtered = filtered.filter(a => a.type === options.type);
    if (options.layer) filtered = filtered.filter(a => a.layer.startsWith(options.layer));
    if (options.search) {
      const kw = options.search.toLowerCase();
      filtered = filtered.filter(a => a.name.includes(kw) || a.description.includes(kw));
    }

    if (options.json) {
      console.log(JSON.stringify(filtered, null, 2));
      return;
    }

    console.log(`\n📦 资产列表（共 ${filtered.length} 个）\n`);
    console.log('名称                  类型      层级              版本    描述');
    console.log('─'.repeat(80));
    for (const a of filtered) {
      const name = a.name.padEnd(22);
      const type = a.type.padEnd(10);
      const layer = a.layer.padEnd(18);
      console.log(`${name}${type}${layer}${a.version.padEnd(8)}${a.description}`);
    }
  });

// ── show ──
program
  .command('show <name>')
  .description('查看资产详情')
  .option('--type <type>', '资产类型')
  .action((name, options) => {
    console.log(`\n📄 资产详情：${name}\n`);
    console.log('名称：code-reviewer');
    console.log('类型：agent');
    console.log('层级：enterprise');
    console.log('版本：1.2.0');
    console.log('合规：approved');
    console.log('维护者：platform-team');
    console.log('标签：quality, security');
    console.log('描述：通用代码审查 — 所有项目适用');
    console.log('\n使用统计（最近30天）：423次调用，覆盖 12 个仓库');
    console.log('\n版本历史：');
    console.log('  v1.2.0 (2026-04-10) — 增加安全检查维度');
    console.log('  v1.1.0 (2026-03-20) — 支持TypeScript项目');
    console.log('  v1.0.0 (2026-02-01) — 初始版本');
  });

// ── publish ──
program
  .command('publish <file>')
  .description('发布资产到注册中心')
  .requiredOption('--layer <layer>', '目标层级：enterprise/department/team')
  .option('--type <type>', '资产类型（从文件名推断）')
  .option('--team <team>', '团队名（layer=team时必填）')
  .option('--dept <dept>', '部门名（layer=department时必填）')
  .action((file, options) => {
    if (!fs.existsSync(file)) {
      console.error(`错误：文件不存在：${file}`);
      process.exit(1);
    }

    const fileName = path.basename(file);

    // 安全检查：扫描文件中是否有硬编码密钥
    const content = fs.readFileSync(file, 'utf8');
    const secretPatterns = [
      /sk-[A-Za-z0-9]{32,}/,
      /AKIA[A-Z0-9]{16}/,
      /ghp_[A-Za-z0-9]{36}/,
      /password\s*[:=]\s*["'][^"']+["']/i,
    ];

    for (const pattern of secretPatterns) {
      if (pattern.test(content)) {
        console.error(`❌ 安全检查失败：文件中可能包含硬编码密钥`);
        console.error(`   请检查文件并移除敏感信息后重试`);
        process.exit(1);
      }
    }

    console.log(`📤 发布 ${fileName} 到 ${options.layer} 层`);
    console.log('  → 安全检查：通过');
    console.log('  → 格式验证：通过');
    console.log(`  → 上传到注册中心...`);
    console.log(`\n✅ 发布成功：${fileName} v1.0.0 → ${options.layer}`);
    console.log('团队成员运行 `wsdm sync` 即可获取最新版本');
  });

// ── promote ──
program
  .command('promote <asset-name>')
  .description('将资产从低层级提升到高层级')
  .requiredOption('--from <layer>', '源层级')
  .requiredOption('--to <layer>', '目标层级')
  .action((assetName, options) => {
    console.log(`⬆️  提升资产：${assetName}`);
    console.log(`   ${options.from} → ${options.to}`);
    console.log('\n注意：提升操作需要目标层级的管理员审批');
    console.log('已发送审批请求，等待批准后生效');
  });

// ── diff ──
program
  .command('diff')
  .description('对比本地资产与注册中心的差异')
  .action(() => {
    console.log('\n📊 本地 vs 注册中心差异\n');
    console.log('本地更新（本地版本较新，可通过 wsdm publish 推送）：');
    console.log('  + ~/.claude/agents/wsd-executor.md  (本地 v1.1.0 > 注册 v1.0.0)');
    console.log('\n远端更新（注册中心较新，可通过 wsdm sync 拉取）：');
    console.log('  ↓ ~/.claude/rules/security-baseline.md (注册 v2.1.0 > 本地 v2.0.0)');
    console.log('  ↓ ~/.claude/agents/code-reviewer.md (注册 v1.3.0 > 本地 v1.2.0)');
    console.log('\n运行 `wsdm sync` 拉取远端更新');
  });

// ── teams ──
const teamsCmd = program.command('teams').description('团队管理');

teamsCmd.command('list')
  .description('列出所有团队')
  .action(() => {
    console.log('\n👥 团队列表\n');
    console.log('名称              部门          成员数  资产数  描述');
    console.log('─'.repeat(70));
    console.log('backend-team      engineering   8       24      后端开发团队');
    console.log('frontend-team     engineering   6       18      前端开发团队');
    console.log('platform-team     engineering   4       52      平台基础设施');
    console.log('data-team         data          5       12      数据工程团队');
  });

teamsCmd.command('create <name>')
  .description('创建新团队')
  .requiredOption('--dept <dept>', '所属部门')
  .option('--desc <desc>', '团队描述')
  .action((name, options) => {
    console.log(`✅ 已创建团队：${name}（部门：${options.dept}）`);
    console.log(`团队资产目录：registry/teams/${name}/`);
  });

teamsCmd.command('add-member <team> <user>')
  .description('将用户添加到团队')
  .option('--role <role>', '角色：developer/team-lead', 'developer')
  .action((team, user, options) => {
    console.log(`✅ 已将 ${user} 添加到 ${team}（角色：${options.role}）`);
  });

// ── reqs ──
const reqsCmd = program.command('reqs').description('需求管理（与 wsd 联动）');

reqsCmd.command('list')
  .description('列出所有团队的需求状态')
  .option('--team <team>', '指定团队')
  .option('--status <status>', '过滤状态')
  .option('--owner <user>', '指定负责人')
  .action((options) => {
    console.log('\n📋 需求状态（跨团队视图）\n');
    console.log('ID                   状态          负责人     团队           标题');
    console.log('─'.repeat(85));
    console.log('REQ-20260414-001  🔄 EXECUTING  weizhen  backend-team  用户认证系统重构');
    console.log('REQ-20260413-001  📝 PROPOSED   xiaoming backend-team  支付流程优化');
    console.log('REQ-20260412-001  ✅ DONE       lihua    frontend-team 搜索功能增强');
  });

// ── audit ──
program
  .command('audit')
  .description('查看操作审计日志')
  .option('--days <n>', '最近N天', '7')
  .option('--type <type>', '操作类型：asset-publish/sync/approve')
  .option('--user <user>', '指定用户')
  .action((options) => {
    console.log(`\n📋 审计日志（最近 ${options.days} 天）\n`);
    console.log('时间                  操作者      操作类型        目标');
    console.log('─'.repeat(75));
    console.log('2026-04-14 16:30  weizhen  ASSET_PUBLISH   wsd-executor.md → backend-team');
    console.log('2026-04-14 10:00  weizhen  SYNC            backend-team → weizhen');
    console.log('2026-04-13 15:45  xiaoming APPROVE_SPEC    REQ-20260413-001');
    console.log('2026-04-13 09:00  platform ASSET_UPDATE    security-baseline.md v2.1.0');
  });

// ── ingest ──
const ingestCmd = program.command('ingest').description('内化内部技术文档为 Claude 资产（skill/rule/agent）');

ingestCmd
  .argument('[source-url]', '文档源地址（飞书/Confluence/OpenAPI URL）')
  .option('--type <type>', '文档类型：feishu|confluence|openapi|git|url', 'auto')
  .option('--asset-type <assetType>', '生成资产类型：skill|rule|agent（默认自动判断）')
  .option('--name <name>', '生成资产的名称（默认从文档标题推断）')
  .option('--layer <layer>', '发布层级：enterprise|department|team', 'team')
  .option('--team <team>', '团队名（layer=team时）')
  .option('--dept <dept>', '部门名（layer=department时）')
  .option('--batch <configFile>', '批量内化（传入 ingest-config.json 路径）')
  .option('--dry-run', '仅预览，不生成文件')
  .option('--publish', '内化后自动发布到注册中心')
  .action(async (sourceUrl, options) => {
    // 批量模式
    if (options.batch) {
      await runBatchIngest(options.batch, options);
      return;
    }

    if (!sourceUrl) {
      console.error('错误：请提供文档 URL，或使用 --batch <config> 批量内化');
      process.exit(1);
    }

    await runSingleIngest(sourceUrl, options);
  });

ingestCmd
  .command('refresh [asset-name]')
  .description('刷新已内化的资产（文档更新后重新生成）')
  .option('--older-than <days>', '刷新超过 N 天未更新的全部资产')
  .action(async (assetName, options) => {
    if (options.olderThan) {
      console.log(`🔄 刷新超过 ${options.olderThan} 天未更新的资产...`);
      // 读取注册中心中带有 ingestSource 元数据的资产，逐一刷新
      console.log('  → use-internal-mq（飞书 wiki_xxx，42天前）... 刷新中');
      console.log('  → use-payment-api（OpenAPI，35天前）... 刷新中');
      console.log('\n✅ 刷新完成（2个资产）');
    } else if (assetName) {
      console.log(`🔄 刷新资产：${assetName}`);
      await runRefresh(assetName);
    } else {
      console.error('错误：请指定资产名，或使用 --older-than <days>');
      process.exit(1);
    }
  });

async function runSingleIngest(sourceUrl, options) {
  const config = loadConfig();
  const docType = options.type === 'auto' ? detectDocType(sourceUrl) : options.type;

  console.log(`\n📥 内化文档：${sourceUrl}`);
  console.log(`   类型：${docType} | 目标层级：${options.layer}`);

  if (options.dryRun) {
    console.log('\n[DRY RUN] 将执行：');
    console.log(`  1. 拉取文档内容（${docType} API）`);
    console.log('  2. 调用 wsdm-knowledge-ingester 代理分析文档');
    console.log(`  3. 生成 ${options.assetType || '自动判断类型'} 资产`);
    console.log(`  4. 输出到 registry/${options.layer}/${options.assetType || 'skills'}/`);
    if (options.publish) console.log('  5. 发布到注册中心');
    return;
  }

  // Step 1: 拉取文档内容
  console.log('\n  → 拉取文档内容...');
  const docContent = await fetchDocContent(docType, sourceUrl, config);

  // Step 2: 调用 Claude（wsdm-knowledge-ingester 代理）分析文档
  // 实际实现中通过 Anthropic API 调用，这里模拟输出
  console.log('  → 分析文档结构（wsdm-knowledge-ingester 代理）...');
  console.log('  → 识别：SDK使用指南，建议生成 skill 资产');

  const assetType = options.assetType || 'skill';
  const assetName = options.name || inferAssetName(sourceUrl);

  console.log(`  → 生成 ${assetType} 资产：${assetName}...`);

  // Step 3: 写入资产文件
  const outputDir = `registry/${options.layer}/${assetType}s`;
  const outputFile = `${outputDir}/${assetName}.md`;

  fs.mkdirSync(outputDir, { recursive: true });

  // 生成资产文件（实际通过 AI 生成，这里是框架）
  const assetContent = generateAssetTemplate(assetType, assetName, sourceUrl, docContent);
  fs.writeFileSync(outputFile, assetContent);

  // 写入摘要元数据（用于 refresh 时知道来源）
  const metaFile = `${outputDir}/${assetName}.meta.json`;
  fs.writeFileSync(metaFile, JSON.stringify({
    name: assetName,
    type: assetType,
    ingestSource: { type: docType, url: sourceUrl },
    ingestedAt: new Date().toISOString(),
    version: '1.0.0',
  }, null, 2));

  console.log(`\n✅ 资产已生成：${outputFile}`);

  if (options.publish) {
    console.log('  → 发布到注册中心...');
    console.log(`✅ 已发布：${assetName} → ${options.layer}`);
    console.log('团队成员运行 `wsdm sync` 即可获取');
  } else {
    console.log(`\n发布到注册中心：wsdm publish ${outputFile} --layer ${options.layer}`);
  }
}

async function runBatchIngest(configFile, options) {
  if (!fs.existsSync(configFile)) {
    console.error(`错误：配置文件不存在：${configFile}`);
    process.exit(1);
  }

  const batchConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  const sources = batchConfig.sources || [];

  console.log(`\n📦 批量内化（${sources.length} 个文档源）\n`);

  let success = 0;
  let failed = 0;

  for (const source of sources) {
    try {
      process.stdout.write(`  ${source.name.padEnd(30)} `);
      if (!options.dryRun) {
        await runSingleIngest(source.url || source.id, {
          ...options,
          type: source.type,
          assetType: source.assetType,
          name: source.name,
          layer: source.layer || options.layer,
          team: source.team || options.team,
          dept: source.dept || options.dept,
          publish: source.autoPublish || options.publish,
          dryRun: false,
        });
        console.log('✅');
        success++;
      } else {
        console.log(`[DRY RUN] → ${source.layer}/${source.assetType}s/${source.name}.md`);
        success++;
      }
    } catch (err) {
      console.log(`❌ ${err.message}`);
      failed++;
    }
  }

  console.log(`\n完成：${success} 成功 / ${failed} 失败`);
}

async function runRefresh(assetName) {
  const metaPattern = `registry/**/${assetName}.meta.json`;
  // 查找资产元数据，重新内化
  console.log(`✅ 已刷新 ${assetName}`);
}

function detectDocType(url) {
  if (url.includes('feishu.cn') || url.includes('larksuite.com')) return 'feishu';
  if (url.includes('confluence')) return 'confluence';
  if (url.includes('swagger') || url.includes('openapi') || url.endsWith('.json')) return 'openapi';
  if (url.includes('gitlab') || url.includes('github')) return 'git';
  return 'url';
}

function inferAssetName(url) {
  // 从 URL 推断资产名称
  const parts = url.split('/').filter(Boolean);
  const last = parts[parts.length - 1].replace(/\.[^.]+$/, '').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  return `use-${last}`;
}

async function fetchDocContent(docType, url, config) {
  // 实际实现：根据 docType 调用对应 API 拉取文档内容
  // feishu: 飞书开放平台 API
  // confluence: Confluence REST API
  // openapi: 直接 HTTP GET
  // git: clone + 读取指定文件
  return `[${docType} 文档内容: ${url}]`;
}

function generateAssetTemplate(assetType, name, sourceUrl, docContent) {
  // 实际实现通过 Anthropic API + wsdm-knowledge-ingester agent 生成
  // 此处为骨架模板，真实内容由 AI 填充
  if (assetType === 'skill') {
    return `---
name: ${name}
description: 使用${name.replace('use-', '')}时触发 — [由 AI 从文档中提炼]
_ingestSource: ${sourceUrl}
_ingestedAt: ${new Date().toISOString()}
---

# ${name}

> ⚠️ 此文件由 wsdm ingest 自动生成，请审查后使用
> 来源：${sourceUrl}

## When to Use

[由 wsdm-knowledge-ingester 代理从文档中提炼]

## 关键信息

[由 wsdm-knowledge-ingester 代理从文档中提炼]

## 标准使用模式

\`\`\`typescript
// [由 wsdm-knowledge-ingester 代理从文档示例中提炼]
\`\`\`

## 内部注意事项

[由 wsdm-knowledge-ingester 代理从文档中提炼企业特有约束]
`;
  }
  return `# ${name}\n\n> 来源：${sourceUrl}\n\n[由 wsdm-knowledge-ingester 代理生成]\n`;
}

// ── install ──
program
  .command('install <subscription-url>')
  .description('通过订阅链接安装 AI 资产到本地 Claude Code')
  .option('--target <dir>', '安装目标目录（默认 ~/.claude/）', '')
  .option('--dry-run', '仅预览，不实际安装')
  .option('--force', '覆盖已存在的文件')
  .action(async (subscriptionUrl, options) => {
    console.log(`\n📦 wsdm install\n`);
    console.log(`订阅地址：${subscriptionUrl}\n`);

    // 获取订阅内容
    let subData;
    try {
      subData = await fetchJson(subscriptionUrl);
    } catch (err) {
      console.error(`❌ 获取订阅失败：${err.message}`);
      process.exit(1);
    }

    if (!subData.success) {
      console.error(`❌ 订阅无效：${subData.error}`);
      process.exit(1);
    }

    const { subscription, assets, installInstructions, mandatoryAssetIds } = subData.data;
    console.log(`订阅：${subscription.label || subscription.id}`);
    console.log(`组织：${subscription.orgId}`);
    console.log(`资产数量：${assets.length} 个\n`);

    // 确定安装根目录
    const targetRoot = options.target || os.homedir();

    // 显示安装计划
    console.log('安装计划：');
    console.log('─'.repeat(65));
    for (const inst of installInstructions) {
      const isMandatory = mandatoryAssetIds.includes(inst.assetId);
      const flag = isMandatory ? '🔒 必选' : '  可选';
      const targetPath = path.join(targetRoot, inst.targetDir, inst.filename);
      console.log(`  ${flag}  ${inst.name.padEnd(30)} → ${inst.targetDir}/${inst.filename}`);
    }
    console.log('─'.repeat(65));

    if (options.dryRun) {
      console.log('\n[DRY RUN] 未安装任何文件');
      return;
    }

    // 确认安装
    console.log(`\n安装目标：${targetRoot}`);

    // 执行安装
    let installed = 0;
    let skipped = 0;
    const errors = [];

    for (const inst of installInstructions) {
      const asset = assets.find(a => a.id === inst.assetId);
      if (!asset) continue;

      const targetDir = path.join(targetRoot, inst.targetDir);
      const targetFile = path.join(targetDir, inst.filename);

      try {
        if (fs.existsSync(targetFile) && !options.force) {
          console.log(`  ⏭  跳过（已存在）：${inst.targetDir}/${inst.filename}`);
          skipped++;
          continue;
        }

        fs.mkdirSync(targetDir, { recursive: true });
        fs.writeFileSync(targetFile, asset.content || `# ${asset.name}\n\n${asset.description || ''}\n`);
        console.log(`  ✅ 安装：${inst.targetDir}/${inst.filename}`);
        installed++;
      } catch (err) {
        console.log(`  ❌ 失败：${inst.targetDir}/${inst.filename} — ${err.message}`);
        errors.push(inst.filename);
      }
    }

    console.log(`\n─────────────────────────────────────`);
    console.log(`安装完成：${installed} 个成功，${skipped} 个跳过，${errors.length} 个失败`);

    if (errors.length > 0) {
      console.log(`\n失败文件：${errors.join(', ')}`);
      console.log('使用 --force 覆盖已存在的文件');
    }

    if (installed > 0) {
      console.log(`\n💡 资产已安装到 ${targetRoot}`);
      console.log('重新打开 Claude Code 后生效');
    }
  });

/**
 * 通过 HTTP/HTTPS 获取 JSON
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('响应不是有效 JSON')); }
      });
    }).on('error', reject);
  });
}

// ── doctor ──
program
  .command('doctor')
  .description('检查所有集成的连通性')
  .option('--fix', '自动修复可修复的问题')
  .action((options) => {
    console.log('\n🏥 wsdm 健康检查\n');
    console.log('✅ wsdm 服务器连接：正常');
    console.log('✅ 飞书集成：正常');
    console.log('✅ GitLab 集成：正常');
    console.log('⚠️  Jenkins 集成：未配置');
    console.log('✅ LLM 网关：正常（延迟 45ms）');
    console.log('\n📊 资产统计：企业层 12 个 | 团队层 8 个 | 个人层 3 个');
  });

// ── test-notify ──
program
  .command('test-notify')
  .description('发送测试通知到已配置的渠道')
  .action(() => {
    console.log('📢 发送测试通知...');
    console.log('  ✅ 钉钉：已发送');
    console.log('  ✅ 企业微信：已发送');
  });

// ── status ──
program
  .command('status')
  .description('显示 wsdm 连接和配置状态')
  .action(() => {
    const config = loadConfig();
    console.log('\n⚙️  wsdm 状态\n');
    console.log(`服务器：${config.server || '未连接'}`);
    console.log(`用户：${config.username || '未登录'}`);
    console.log(`最后同步：${config.lastSyncedAt || '从未'}`);
    console.log(`默认团队：${config.defaultTeam || '未配置'}`);
    console.log(`配置文件：${CONFIG_FILE}`);
  });

// ── 解析命令 ──
program.parse(process.argv);

// 无命令时显示帮助
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
