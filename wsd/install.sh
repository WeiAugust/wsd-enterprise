#!/bin/bash
# WSD 插件安装脚本
#
# 用法：
#   ./install.sh                    # 安装到当前项目（.claude/）
#   ./install.sh --global           # 安装到全局（~/.claude/）
#   ./install.sh --init-project     # 同时初始化 .wsd/ 目录
#
# 示例：
#   cd /path/to/your/project
#   /path/to/wsd/install.sh --init-project

set -e

WSD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GLOBAL=false
INIT_PROJECT=false

# ── 函数：安装 git hook（追加模式，不覆盖已有 hook）────────────────────────
install_git_hook() {
  local hook_path="$1"
  local wsd_hook_src="$2"
  local marker="# wsd-ai-stats"

  if [ -f "$hook_path" ]; then
    # 已存在：检查是否已追加过
    if grep -q "$marker" "$hook_path" 2>/dev/null; then
      echo "    (git $( basename "$hook_path") hook 已包含 wsd，跳过)"
      return
    fi
    # 追加到现有 hook 末尾
    echo "" >> "$hook_path"
    echo "$marker" >> "$hook_path"
    cat "$wsd_hook_src" | tail -n +4 >> "$hook_path"  # 跳过 shebang 和注释头
    echo "    (已追加到现有 $( basename "$hook_path") hook)"
  else
    # 不存在：直接复制
    cp "$wsd_hook_src" "$hook_path"
    chmod +x "$hook_path"
    echo "    (已创建 $( basename "$hook_path") hook)"
  fi
}

# 解析参数
for arg in "$@"; do
  case $arg in
    --global) GLOBAL=true ;;
    --init-project) INIT_PROJECT=true ;;
  esac
done

# 确定安装目标
if [ "$GLOBAL" = true ]; then
  TARGET="$HOME/.claude"
  echo "📦 安装 WSD 到全局 (~/.claude/)"
else
  TARGET="$(pwd)/.claude"
  echo "📦 安装 WSD 到当前项目 (.claude/)"
fi

# 创建目录
mkdir -p "$TARGET/commands"
mkdir -p "$TARGET/agents"
mkdir -p "$TARGET/skills"
mkdir -p "$TARGET/hooks"
mkdir -p "$TARGET/schemas"

# 复制资产文件
echo "  → 复制命令..."
cp "$WSD_DIR/commands/"*.md "$TARGET/commands/"

echo "  → 复制代理..."
cp "$WSD_DIR/agents/"*.md "$TARGET/agents/"

echo "  → 复制技能..."
cp "$WSD_DIR/skills/"*.md "$TARGET/skills/"

echo "  → 复制钩子..."
cp "$WSD_DIR/hooks/"*.js "$TARGET/hooks/"
cp "$WSD_DIR/hooks/"*.py "$TARGET/hooks/"

# 安装 git hooks（仅在项目模式下，且存在 .git 目录时）
GIT_HOOKS_DIR="$(pwd)/.git/hooks"
if [ "$GLOBAL" = false ] && [ -d "$GIT_HOOKS_DIR" ]; then
  echo "  → 安装 git post-commit hook..."
  install_git_hook "$GIT_HOOKS_DIR/post-commit" "$WSD_DIR/hooks/git/post-commit"
fi

echo "  → 复制 Schema..."
cp "$WSD_DIR/schemas/"*.json "$TARGET/schemas/"

# 处理 CLAUDE.md
if [ -f "$TARGET/CLAUDE.md" ]; then
  echo "  → CLAUDE.md 已存在，追加 WSD 内容..."
  echo "" >> "$TARGET/CLAUDE.md"
  echo "---" >> "$TARGET/CLAUDE.md"
  cat "$WSD_DIR/CLAUDE.md" >> "$TARGET/CLAUDE.md"
else
  echo "  → 复制 CLAUDE.md..."
  cp "$WSD_DIR/CLAUDE.md" "$TARGET/CLAUDE.md"
fi

# 处理 settings.json（合并 hooks）
if [ -f "$TARGET/settings.json" ]; then
  echo "  → settings.json 已存在，请手动将以下 hooks 配置合并进去："
  echo "    参考：$WSD_DIR/settings.json"
else
  echo "  → 复制 settings.json..."
  cp "$WSD_DIR/settings.json" "$TARGET/settings.json"
fi

# 初始化项目 .wsd 目录
if [ "$INIT_PROJECT" = true ] && [ "$GLOBAL" = false ]; then
  PROJECT_DIR="$(pwd)"
  WSD_PROJECT="$PROJECT_DIR/.wsd"

  if [ -d "$WSD_PROJECT" ]; then
    echo ""
    echo "  ℹ️  .wsd/ 目录已存在，跳过初始化"
  else
    echo ""
    echo "  → 初始化 .wsd/ 目录..."
    mkdir -p "$WSD_PROJECT/requirements"
    mkdir -p "$WSD_PROJECT/specs"
    mkdir -p "$WSD_PROJECT/workspace"
    mkdir -p "$WSD_PROJECT/audit"

    # 复制配置模板
    cp "$WSD_DIR/templates/wsd-config.json" "$WSD_PROJECT/config.json"

    # 创建初始 STATE.md
    PROJECT_NAME="$(basename "$(pwd)")"
    cat > "$WSD_PROJECT/STATE.md" << EOF
# WSD 项目状态 — $PROJECT_NAME

> 初始化时间：$(date -u +"%Y-%m-%dT%H:%M:%SZ")

## 活跃需求

（暂无活跃需求）

## 最近归档

（暂无归档记录）

---
*此文件由 WSD 自动维护，请勿手动编辑*
EOF

    echo "  ✅ .wsd/ 已初始化"
    echo "     配置文件：.wsd/config.json（请根据项目情况修改）"

    # 添加 .gitignore 规则
    GITIGNORE="$PROJECT_DIR/.gitignore"
    if [ -f "$GITIGNORE" ]; then
      if ! grep -q ".wsd/audit/" "$GITIGNORE" 2>/dev/null; then
        echo "" >> "$GITIGNORE"
        echo "# WSD 审计日志（本地存储，不提交）" >> "$GITIGNORE"
        echo ".wsd/audit/" >> "$GITIGNORE"
        echo ".wsd/workspace/" >> "$GITIGNORE"
        echo ".claude/ai-pending/" >> "$GITIGNORE"
        echo "  → 已更新 .gitignore"
      fi
    fi
  fi
fi

echo ""
echo "✅ WSD 安装完成！"
echo ""
echo "快速开始："
echo "  /wsd:propose <需求描述>   — 创建第一个需求"
echo "  /wsd:status               — 查看需求看板"
echo ""
echo "文档：$WSD_DIR/README.md"
