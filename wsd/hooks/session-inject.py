#!/usr/bin/env python3
"""
WSD 会话注入器 (UserPromptSubmit Hook)

在每次用户提交消息时，自动注入当前 WSD 项目状态
让 Claude 始终了解当前需求上下文，无需用户重复说明

配置方式（settings.json）：
{
  "hooks": {
    "UserPromptSubmit": [{
      "command": "python3 .claude/hooks/session-inject.py"
    }]
  }
}

注意：UserPromptSubmit hook 需要在 settings.json 中额外激活
"""

import json
import sys
import os
import glob
from pathlib import Path
from datetime import datetime


def find_wsd_dir():
    """从当前目录向上查找 .wsd 目录"""
    current = Path.cwd()
    for _ in range(5):
        candidate = current / '.wsd'
        if candidate.exists():
            return candidate
        parent = current.parent
        if parent == current:
            break
        current = parent
    return None


def read_json(path):
    """安全读取JSON文件"""
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return None


def get_active_requirements(wsd_dir):
    """获取所有活跃需求的状态摘要"""
    reqs = []
    req_dir = wsd_dir / 'requirements'

    if not req_dir.exists():
        return reqs

    for meta_file in glob.glob(str(req_dir / '*/meta.json')):
        meta = read_json(meta_file)
        if not meta:
            continue

        status = meta.get('status', 'UNKNOWN')
        # 只包含活跃需求（排除 ARCHIVED）
        if status != 'ARCHIVED':
            reqs.append({
                'id': meta.get('reqId', 'UNKNOWN'),
                'title': meta.get('title', 'Untitled'),
                'status': status,
                'owner': meta.get('owner', 'unknown'),
                'updatedAt': meta.get('updatedAt', ''),
                'blockers': len(meta.get('blockers', [])),
            })

    # 按更新时间排序，最近的在前
    reqs.sort(key=lambda x: x['updatedAt'], reverse=True)
    return reqs[:5]  # 最多注入5条，避免上下文过长


def get_executing_detail(wsd_dir, req_id):
    """获取正在执行的需求的任务详情"""
    tasks_file = wsd_dir / 'requirements' / req_id / 'tasks.md'
    if not tasks_file.exists():
        return None

    # 简单解析 tasks.md 中的进度统计
    try:
        content = tasks_file.read_text()
        done = content.count('| DONE |')
        total = content.count('| TODO |') + content.count('| DONE |') + content.count('| BLOCKED |') + content.count('| IN_PROGRESS |')
        return f"{done}/{total} 任务完成" if total > 0 else None
    except Exception:
        return None


def build_injection(wsd_dir):
    """构建要注入的上下文内容"""
    reqs = get_active_requirements(wsd_dir)

    if not reqs:
        return None

    lines = ['<wsd_context>']
    lines.append(f'# WSD 项目状态（{datetime.now().strftime("%Y-%m-%d %H:%M")}）')
    lines.append('')

    executing = [r for r in reqs if r['status'] == 'EXECUTING']
    if executing:
        lines.append('## 当前执行中')
        for req in executing:
            progress = get_executing_detail(wsd_dir, req['id'])
            progress_str = f' [{progress}]' if progress else ''
            lines.append(f'- {req["id"]}：{req["title"]}{progress_str}')
        lines.append('')

    blocked = [r for r in reqs if r['blockers'] > 0]
    if blocked:
        lines.append('## ⚠️ 阻塞需求')
        for req in blocked:
            lines.append(f'- {req["id"]}：{req["title"]}（{req["blockers"]}个阻塞）')
        lines.append('')

    other_active = [r for r in reqs if r['status'] not in ('EXECUTING', 'ARCHIVED') and r['blockers'] == 0]
    if other_active:
        lines.append('## 其他活跃需求')
        for req in other_active:
            lines.append(f'- [{req["status"]}] {req["id"]}：{req["title"]}')
        lines.append('')

    lines.append('使用 /wsd:status 查看完整看板')
    lines.append('</wsd_context>')

    return '\n'.join(lines)


def main():
    """UserPromptSubmit hook 入口"""
    try:
        raw_input = sys.stdin.read()
        data = json.loads(raw_input)
    except Exception:
        sys.stdout.write(raw_input if 'raw_input' in dir() else '')
        return

    wsd_dir = find_wsd_dir()

    if not wsd_dir:
        # 没有 .wsd 目录，不注入
        sys.stdout.write(raw_input)
        return

    injection = build_injection(wsd_dir)

    if injection:
        # 将 WSD 状态注入到 prompt 前面
        original_prompt = data.get('prompt', '')
        data['prompt'] = f'{injection}\n\n{original_prompt}'

    sys.stdout.write(json.dumps(data))


if __name__ == '__main__':
    main()
