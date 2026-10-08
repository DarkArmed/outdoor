#!/usr/bin/env python3
"""校验 data/data-e.js 派生方案：数据契约 + 合规（PoC 版，对应语料转方案.md §五步骤5）。

用法：
  python validate.py --corpus-root C:/Repos/outdoor/corpus [--repo-root ..]
退出码：0 全过；1 有失败项。
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

SCENES = {'water', 'hike', 'camp', 'campnight', 'cycle', 'grassland', 'lake', 'redleaf', 'climb', 'museum', 'snow', 'hero'}
PLATFORMS = ['小红书', '微博', '携程', '马蜂窝', '北京旅游网', 'visitbeijing', 'xiaohongshu', 'weibo', 'ctrip']
REQUIRED = ['id', 'title', 'date', 'type', 'theme', 'emoji', 'location', 'drive', 'goal', 'itinerary', 'gear', 'safety', 'review']
NGRAM = 8

errors = []
warnings = []


def err(plan_id, msg):
    errors.append(f'[{plan_id}] {msg}')


def warn(plan_id, msg):
    warnings.append(f'[{plan_id}] {msg}')


def plan_strings(plan):
    """方案中全部面向用户展示的字符串。"""
    out = []

    def walk(v):
        if isinstance(v, str):
            out.append(v)
        elif isinstance(v, dict):
            for x in v.values():
                walk(x)
        elif isinstance(v, list):
            for x in v:
                walk(x)

    for k in ('title', 'date', 'type', 'location', 'goal', 'tips', 'itinerary', 'dayNames', 'gear', 'safety', 'hike', 'review', 'badge', 'tasks'):
        walk(plan.get(k))
    return [s for s in out if s]


def norm(s):
    return re.sub(r'\s+', '', s)


def check_contract(plan):
    pid = plan.get('id', '?')
    for f in REQUIRED:
        if f not in plan or plan[f] in (None, '', []):
            err(pid, f'缺必填字段或为空: {f}')
    if not re.fullmatch(r'derived-[a-z0-9-]+', str(plan.get('id', ''))):
        err(pid, 'id 不符合 derived-<slug> 格式')
    if plan.get('archived') is not True:
        err(pid, 'archived 必须为 true（备用计划）')
    if not re.match(r'^[ABCD]\s', str(plan.get('type', ''))):
        err(pid, f'type 须以 A/B/C/D 开头: {plan.get("type")}')
    if plan.get('theme') not in SCENES:
        err(pid, f'theme 不在 SCENES 枚举: {plan.get("theme")}')
    drive = plan.get('drive') or {}
    if drive.get('from') != '家':
        err(pid, 'drive.from 必须为「家」')
    for f in ('to', 'time'):
        if not drive.get(f):
            err(pid, f'drive.{f} 为空')
    if not isinstance(drive.get('km'), (int, float)):
        err(pid, 'drive.km 须为数字')
    tasks = plan.get('tasks') or []
    if len(tasks) != 3:
        err(pid, f'tasks 须为 3 条: {len(tasks)}')
    review = plan.get('review') or []
    if len(review) != 4:
        err(pid, f'review 须为 4 条: {len(review)}')
    badge = plan.get('badge') or {}
    if not badge.get('icon') or not badge.get('name'):
        err(pid, 'badge 缺 icon/name')
    it = plan.get('itinerary') or []
    multi = it and isinstance(it[0], list)
    if multi:
        day_names = plan.get('dayNames') or []
        if len(day_names) != len(it):
            err(pid, f'多日行程 dayNames({len(day_names)}) 与 itinerary({len(it)}) 天数不一致')
        flat = [x for day in it for x in day]
    else:
        flat = it
    for i, step in enumerate(flat):
        if not isinstance(step, dict) or not step.get('time') or not step.get('text'):
            err(pid, f'itinerary[{i}] 缺 time/text')
    gear = plan.get('gear') or {}
    if not gear.get('base') or not gear.get('special'):
        err(pid, 'gear.base/special 不能为空')
    hike = plan.get('hike')
    if hike is not None:
        if not hike.get('title') or not hike.get('length'):
            err(pid, 'hike 缺 title/length')
        for j, wp in enumerate(hike.get('waypoints') or []):
            if not wp.get('name'):
                err(pid, f'hike.waypoints[{j}] 缺 name')
            if 'query' not in wp and 'at' not in wp:
                err(pid, f'hike.waypoints[{j}] 缺定位（query 或 at）')
            if 'at' in wp and not (0 <= wp['at'] <= 1):
                err(pid, f'hike.waypoints[{j}].at 超出 0–1')


def check_compliance(plan, corpus_root, drafts):
    pid = plan['id']
    slug = pid.replace('derived-', '')
    draft = drafts.get(slug)
    strings = [norm(s) for s in plan_strings(plan)]
    joined = '\n'.join(plan_strings(plan))

    for name in PLATFORMS:
        if name.lower() in joined.lower():
            err(pid, f'出现平台名: {name}')
    if re.search(r'https?://|www\.', joined):
        err(pid, '出现 URL')
    if not draft:
        warn(pid, '无对应 draft JSON，跳过溯源/原创性检查')
        return
    if not draft.get('sources'):
        err(pid, 'draft.sources 为空（须 ≥1 条语料溯源）')

    for src in draft.get('sources') or []:
        folder = corpus_root / 'raw' / src['source'] / str(src['id'])
        text_path = folder / 'text.md'
        meta_path = folder / 'meta.json'
        if not text_path.exists():
            warn(pid, f'引用语料不存在: {src["source"]}:{src["id"]}')
            continue
        corpus_text = norm(text_path.read_text(encoding='utf-8', errors='replace'))
        grams = {corpus_text[i:i + NGRAM] for i in range(0, max(0, len(corpus_text) - NGRAM + 1))}
        # 专名白名单：目的地正式名与别名的重合不算抄袭
        proper = {norm(x) for x in [draft.get('destination', ''), *(draft.get('aliases') or [])] if x}
        for s in strings:
            for i in range(0, max(0, len(s) - NGRAM + 1)):
                g = s[i:i + NGRAM]
                if g in grams and not any(p and p in g for p in proper):
                    err(pid, f'与语料 {src["source"]}:{src["id"]} 有 {NGRAM} 字重合: 「{g}」')
                    break
        if meta_path.exists():
            author = (json.loads(meta_path.read_text(encoding='utf-8')).get('author') or {}).get('name')
            if author and author in joined:
                err(pid, f'出现作者名: {author}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--corpus-root', required=True)
    ap.add_argument('--repo-root', default=str(Path(__file__).resolve().parents[2]))
    args = ap.parse_args()
    repo = Path(args.repo_root)
    corpus = Path(args.corpus_root)

    result = subprocess.run(['node', str(repo / 'tools' / 'dump-data.js')], cwd=repo,
                            capture_output=True, text=True, encoding='utf-8', errors='replace')
    if result.returncode != 0:
        print('dump-data.js 执行失败:\n' + result.stderr[:2000])
        sys.exit(1)
    data = json.loads(result.stdout)
    derived = [p for p in data['plans'] if str(p.get('id', '')).startswith('derived-')]
    if not derived:
        print('未发现 derived-* 方案')
        sys.exit(1)

    drafts = {}
    derived_dir = corpus / 'derived'
    if derived_dir.exists():
        for f in derived_dir.glob('*.draft.json'):
            drafts[f.stem.replace('.draft', '')] = json.loads(f.read_text(encoding='utf-8'))

    for plan in derived:
        check_contract(plan)
        check_compliance(plan, corpus, drafts)

    for w in warnings:
        print('WARN ' + w)
    for e in errors:
        print('FAIL ' + e)
    print(f'\n校验 {len(derived)} 条派生方案: {len(errors)} 个失败, {len(warnings)} 个警告')
    sys.exit(1 if errors else 0)


if __name__ == '__main__':
    main()
