# WSD — 需求生命周期管理插件

> 企业级 Claude Code 插件，打通从"一句需求"到"可验证交付"的完整链路

## 快速安装

```bash
# 安装到当前项目 + 初始化 .wsd 目录
./install.sh --init-project

# 仅安装到当前项目
./install.sh

# 安装到全局
./install.sh --global
```

## 快速开始

```bash
# 1. 创建需求提案（启动深度访谈）
/wsd:propose 实现用户认证功能，支持邮箱注册和JWT登录

# 2. 生成行为规格（AI自动，需人工确认）
/wsd:spec REQ-20260414-001

# 3. 拆解实现任务（AI自动，需人工确认）
/wsd:plan REQ-20260414-001

# 4. 驱动分阶段实现（子代理隔离执行）
/wsd:execute REQ-20260414-001

# 5. 执行验收检查
/wsd:verify REQ-20260414-001

# 6. 查看项目状态看板
/wsd:status
```

## 插件结构

```
wsd/
├── CLAUDE.md              # 插件行为基线（注入每次会话）
├── commands/              # 14个斜杠命令
├── agents/                # 6个专用子代理
├── skills/                # 4个自动触发技能
├── hooks/                 # 4个自动化钩子
├── schemas/               # JSON Schema 定义
├── templates/             # 配置模板
├── settings.json          # Hook 配置模板
└── install.sh             # 安装脚本
```

## 生命周期

```
PROPOSED → SPEC_APPROVED → PLAN_APPROVED → EXECUTING → DONE → ARCHIVED
   ↑           ↑                ↑               ↑          ↑
 提案创建    规格确认          计划确认         验收通过   归档
[人工触发]  [AI生成+人工确认] [AI生成+人工确认] [AI实现]  [AI验收+人工确认]
```

## 参考设计

- `docs/wsd-design.md` — 完整设计文档
- `docs/enterprise-integration-design.md` — 企业集成设计

## 与 wsd_manager 集成

在 `.wsd/config.json` 中启用：

```json
{
  "integrations": {
    "wsdManager": {
      "enabled": true,
      "endpoint": "https://wsd-manager.company.com",
      "apiKeyEnv": "WSDM_API_KEY"
    }
  }
}
```

启用后，wsd 会：
- 自动从 wsd_manager 拉取团队共享的 agents/skills/rules
- 将需求状态同步到 wsd_manager 看板
- 使用企业统一的 LLM 端点（modelOverrides）
