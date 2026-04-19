#!/bin/bash
# WSD 状态栏脚本
#
# 在 Claude Code 底部状态栏显示：
#   WSD | 需求ID:阶段(进度) | ctx:XX% | model
#
# 配置方式（settings.json）：
# {
#   "statusLine": {
#     "command": "bash .claude/hooks/statusline.sh"
#   }
# }
#
# 或使用全局配置：
# {
#   "statusLine": {
#     "command": "bash ~/.claude/hooks/statusline.sh"
#   }
# }

set -euo pipefail

# ─── 颜色/图标常量 ────────────────────────────────────────────────────
# 状态图标
ICON_OK="✅"
ICON_WARN="⚠️"
ICON_BLOCK="🔴"
ICON_RUN="⚡"
ICON_DONE="✓"

# ─── 读取 WSD 项目状态 ─────────────────────────────────────────────────

find_wsd_dir() {
  local dir
  dir="$(pwd)"
  for _ in 1 2 3 4 5; do
    if [ -d "$dir/.wsd" ]; then
      echo "$dir/.wsd"
      return 0
    fi
    dir="$(dirname "$dir")"
    [ "$dir" = "/" ] && break
  done
  return 1
}

get_model() {
  # 从环境变量或 settings.json 读取当前模型
  local model="${CLAUDE_MODEL:-}"
  if [ -z "$model" ]; then
    # 尝试从 settings.json 读取
    local settings
    for f in ".claude/settings.json" "$HOME/.claude/settings.json"; do
      if [ -f "$f" ]; then
        model=$(node -e "
          try {
            const s = JSON.parse(require('fs').readFileSync('$f'));
            process.stdout.write(s.model || s.defaultModel || '');
          } catch(e) { process.stdout.write(''); }
        " 2>/dev/null || true)
        [ -n "$model" ] && break
      fi
    done
  fi
  # 缩短模型名
  case "$model" in
    *opus*4-6*)   echo "opus-4.6" ;;
    *sonnet*4-6*) echo "sonnet-4.6" ;;
    *haiku*4-5*)  echo "haiku-4.5" ;;
    *opus*)       echo "opus" ;;
    *sonnet*)     echo "sonnet" ;;
    *haiku*)      echo "haiku" ;;
    "")           echo "claude" ;;
    *)            echo "${model: -10}" ;;  # 取最后10个字符
  esac
}

get_context_percent() {
  # 尝试从环境变量获取（Claude Code 未来可能提供）
  local used="${CLAUDE_CONTEXT_TOKENS_USED:-0}"
  local max="${CLAUDE_CONTEXT_TOKENS_MAX:-200000}"

  if [ "$used" -gt 0 ] 2>/dev/null; then
    echo "$((used * 100 / max))%"
  else
    # 回退：读取会话统计
    local stats_file="$HOME/.wsd/session-stats.json"
    if [ -f "$stats_file" ]; then
      local calls
      calls=$(node -e "
        try {
          const s = JSON.parse(require('fs').readFileSync('$stats_file'));
          process.stdout.write(String(s.toolCalls || 0));
        } catch(e) { process.stdout.write('0'); }
      " 2>/dev/null || echo "0")
      # 粗略估算：200次调用 ≈ 100% (每次平均1k tokens，上下文200K)
      if [ "$calls" -gt 0 ]; then
        local pct=$(( calls * 50 / 100 ))
        [ "$pct" -gt 99 ] && pct=99
        echo "${pct}%"
        return
      fi
    fi
    echo "?"
  fi
}

get_primary_req() {
  local wsd_dir="$1"
  local req_dir="$wsd_dir/requirements"
  [ -d "$req_dir" ] || return

  # 找最近更新的活跃需求
  local primary_meta
  primary_meta=$(find "$req_dir" -name "meta.json" -exec \
    node -e "
      const fs = require('fs');
      const files = process.argv.slice(1);
      const metas = files.map(f => { try { return JSON.parse(fs.readFileSync(f)); } catch(e) { return null; } }).filter(Boolean);
      const active = metas.filter(m => !['ARCHIVED','CANCELLED','DONE'].includes(m.status));
      active.sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      if (active[0]) process.stdout.write(JSON.stringify(active[0]));
    " {} + 2>/dev/null || true)

  echo "$primary_meta"
}

get_req_progress() {
  local wsd_dir="$1"
  local req_id="$2"
  local tasks_file="$wsd_dir/requirements/$req_id/tasks.md"

  if [ -f "$tasks_file" ]; then
    local done total
    done=$(grep -c "| DONE |" "$tasks_file" 2>/dev/null || echo 0)
    total=$(grep -cE "\| (DONE|TODO|BLOCKED|IN_PROGRESS) \|" "$tasks_file" 2>/dev/null || echo 0)
    [ "$total" -gt 0 ] && echo "${done}/${total}" || echo ""
  fi
}

get_blocked_count() {
  local wsd_dir="$1"
  local blocked=0
  while IFS= read -r meta_file; do
    local status
    status=$(node -e "
      try {
        const m = JSON.parse(require('fs').readFileSync('$meta_file'));
        process.stdout.write(m.status || '');
      } catch(e) { process.stdout.write(''); }
    " 2>/dev/null || true)
    [ "$status" = "BLOCKED" ] && blocked=$((blocked + 1))
  done < <(find "$wsd_dir/requirements" -name "meta.json" 2>/dev/null)
  echo "$blocked"
}

# ─── 状态图标映射 ──────────────────────────────────────────────────────

status_icon() {
  case "$1" in
    PROPOSED)      echo "📝" ;;
    SPECCING)      echo "🔍" ;;
    SPEC_APPROVED) echo "📋" ;;
    PLANNING)      echo "🗂️" ;;
    PLAN_APPROVED) echo "✅" ;;
    EXECUTING)     echo "⚡" ;;
    BLOCKED)       echo "🔴" ;;
    VERIFYING)     echo "🔬" ;;
    BUGFIX)        echo "🐛" ;;
    IMPLEMENTED)   echo "🏁" ;;
    DONE)          echo "✅" ;;
    AMENDING)      echo "✏️" ;;
    QUICKFIX)      echo "⚡" ;;
    HOTFIX)        echo "🚨" ;;
    *)             echo "❓" ;;
  esac
}

# ─── 主逻辑 ───────────────────────────────────────────────────────────

wsd_dir=$(find_wsd_dir 2>/dev/null || true)
model=$(get_model)
ctx=$(get_context_percent)

if [ -z "$wsd_dir" ]; then
  # 无 .wsd 目录，简洁输出
  printf "WSD | %s | ctx:%s" "$model" "$ctx"
  exit 0
fi

# 读取主需求
primary_json=$(get_primary_req "$wsd_dir")
project_name=$(node -e "
  try {
    const c = JSON.parse(require('fs').readFileSync('$wsd_dir/config.json'));
    process.stdout.write(c.project?.name || require('path').basename('$(pwd)'));
  } catch(e) { process.stdout.write(require('path').basename('$(pwd)')); }
" 2>/dev/null || basename "$(pwd)")

# 统计活跃需求
active_count=$(find "$wsd_dir/requirements" -name "meta.json" 2>/dev/null | \
  xargs -I{} node -e "
    try {
      const m = JSON.parse(require('fs').readFileSync('{}'));
      if (!['ARCHIVED','CANCELLED'].includes(m.status)) process.stdout.write('1\n');
    } catch(e) {}
  " 2>/dev/null | wc -l | tr -d ' ' || echo 0)

blocked_count=$(get_blocked_count "$wsd_dir")

if [ -n "$primary_json" ] && [ "$primary_json" != "null" ]; then
  req_id=$(echo "$primary_json" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try { process.stdout.write(JSON.parse(d).reqId || ''); } catch(e){}
    });
  " 2>/dev/null <<< "$primary_json" || true)

  req_status=$(echo "$primary_json" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try { process.stdout.write(JSON.parse(d).status || ''); } catch(e){}
    });
  " 2>/dev/null <<< "$primary_json" || true)

  req_title=$(echo "$primary_json" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try {
        const t = JSON.parse(d).title || '';
        process.stdout.write(t.length > 12 ? t.slice(0,12)+'…' : t);
      } catch(e){}
    });
  " 2>/dev/null <<< "$primary_json" || true)

  icon=$(status_icon "$req_status")
  progress=$(get_req_progress "$wsd_dir" "$req_id" || true)

  # 构建状态栏
  # 格式: WSD:项目名 | 图标 REQ-XXX:标题 [进度] | ctx:XX% | model
  req_part="${icon} ${req_id##REQ-}:${req_title}"
  [ -n "$progress" ] && req_part="${req_part} (${progress})"

  blocked_part=""
  [ "$blocked_count" -gt 0 ] && blocked_part=" 🔴${blocked_count}"

  ctx_color=""
  ctx_num="${ctx//%/}"
  if [ "$ctx_num" != "?" ]; then
    [ "$ctx_num" -ge 80 ] && ctx_color="🛑"
    [ "$ctx_num" -ge 60 ] && [ "$ctx_num" -lt 80 ] && ctx_color="⚠️"
  fi

  printf "WSD:%s | %s%s | %s%s | %s" \
    "$project_name" \
    "$req_part" \
    "$blocked_part" \
    "$ctx_color" "ctx:${ctx}" \
    "$model"
else
  # 有 .wsd 但无活跃需求
  printf "WSD:%s | %s需求 | ctx:%s | %s" \
    "$project_name" \
    "$active_count" \
    "$ctx" \
    "$model"
fi
