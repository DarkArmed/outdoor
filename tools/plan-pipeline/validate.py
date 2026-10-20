#!/usr/bin/env python3
"""校验 data/data-e.js 派生方案：数据契约 + 合规（语料转方案.md §五步骤5、§4.4 禁止项）。

用法：
  python validate.py [--corpus-root C:/Repos/outdoor/corpus] [--repo-root ..] [--strict]

corpus-root 缺省解析：--corpus-root 参数 > 环境变量 CORPUS_ROOT > 仓库根 corpus/；
找不到时给出指定方式说明（worktree 中需显式指向主检出）。

校验内容：
  - dump-data.js 可解析，且存在 derived-* 方案；
  - 契约字段：必填/枚举（type、theme）/类型/tasks 3 条/review 4 问/itinerary、gear、hike 结构；
  - 合规：无平台名/URL/作者名；与所引语料无 ≥8 字连续重合（目的地专名豁免）；
    draft.sources ≥1 条且引用的语料存在。
退出码：0 全过；1 有失败项（--strict 时警告也算失败）。
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

import corpus_root

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
    """方案中全部面向用户展示的字符串；walk 只收集字符串，数字 km 不会混入。"""
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

    for k in ('title', 'date', 'type', 'location', 'drive', 'goal', 'tips', 'itinerary', 'dayNames', 'gear', 'safety', 'hike', 'review', 'badge', 'tasks'):
        walk(plan.get(k))
    return [s for s in out if s]


def norm(s):
    return re.sub(r'\s+', '', s)


def nonempty_string(value):
    return isinstance(value, str) and bool(value.strip())


def check_string_list(pid, field, value, *, count=None, allow_empty=True):
    if not isinstance(value, list):
        err(pid, f'{field} 须为字符串数组')
        return
    if not allow_empty and not value:
        err(pid, f'{field} 不能为空')
    if count is not None and len(value) != count:
        err(pid, f'{field} 须为 {count} 条')
    for i, item in enumerate(value):
        if not nonempty_string(item):
            err(pid, f'{field}[{i}] 须为非空字符串')


def check_contract(plan):
    pid = plan.get('id', '?')
    for f in REQUIRED:
        if f not in plan or plan[f] in (None, '', []):
            err(pid, f'缺必填字段或为空: {f}')
    for f in ('id', 'title', 'date', 'type', 'theme', 'emoji', 'location', 'goal'):
        if not nonempty_string(plan.get(f)):
            err(pid, f'{f} 须为非空字符串')
    if not re.fullmatch(r'derived-[a-z0-9-]+', str(plan.get('id', ''))):
        err(pid, 'id 不符合 derived-<slug> 格式')
    if plan.get('archived') is not True:
        err(pid, 'archived 必须为 true（备用计划）')
    if 'mom' in plan and not isinstance(plan['mom'], bool):
        err(pid, 'mom 须为布尔值')
    plan_type = plan.get('type')
    if isinstance(plan_type, str) and not re.match(r'^[ABCD]\s', plan_type):
        err(pid, f'type 须以 A/B/C/D 开头: {plan_type}')
    theme = plan.get('theme')
    if isinstance(theme, str) and theme not in SCENES:
        err(pid, f'theme 不在 SCENES 枚举: {theme}')

    drive = plan.get('drive')
    if not isinstance(drive, dict):
        err(pid, 'drive 须为对象')
    else:
        for f in ('from', 'to', 'time'):
            if not nonempty_string(drive.get(f)):
                err(pid, f'drive.{f} 须为非空字符串')
        if drive.get('from') != '家':
            err(pid, 'drive.from 必须为「家」')
        km = drive.get('km')
        if isinstance(km, bool) or not isinstance(km, (int, float)):
            err(pid, 'drive.km 须为数字')
        if 'landmarks' in drive:
            check_string_list(pid, 'drive.landmarks', drive['landmarks'])
        if 'geoCity' in drive and not nonempty_string(drive['geoCity']):
            err(pid, 'drive.geoCity 须为非空字符串')

    check_string_list(pid, 'tasks', plan.get('tasks'), count=3, allow_empty=False)
    check_string_list(pid, 'review', plan.get('review'), count=4, allow_empty=False)
    check_string_list(pid, 'safety', plan.get('safety'), allow_empty=False)
    if 'tips' in plan:
        check_string_list(pid, 'tips', plan['tips'])

    badge = plan.get('badge')
    if not isinstance(badge, dict):
        err(pid, 'badge 须为对象')
    else:
        for f in ('icon', 'name'):
            if not nonempty_string(badge.get(f)):
                err(pid, f'badge.{f} 须为非空字符串')

    it = plan.get('itinerary')
    if not isinstance(it, list):
        err(pid, 'itinerary 须为数组')
        it = []
    multi = any(isinstance(day, list) for day in it)
    if multi:
        if not all(isinstance(day, list) for day in it):
            err(pid, 'itinerary 单日须为步骤数组，多日须为每天的数组，不能混用')
        check_string_list(pid, 'dayNames', plan.get('dayNames'), allow_empty=False)
        day_names = plan.get('dayNames')
        if isinstance(day_names, list) and len(day_names) != len(it):
            err(pid, f'多日行程 dayNames({len(day_names)}) 与 itinerary({len(it)}) 天数不一致')
        flat = [step for day in it if isinstance(day, list) for step in day]
    else:
        if 'dayNames' in plan:
            check_string_list(pid, 'dayNames', plan['dayNames'])
        flat = it
    for i, step in enumerate(flat):
        if not isinstance(step, dict):
            err(pid, f'itinerary[{i}] 须为对象')
            continue
        for f in ('time', 'text'):
            if not nonempty_string(step.get(f)):
                err(pid, f'itinerary[{i}].{f} 须为非空字符串')

    gear = plan.get('gear')
    if not isinstance(gear, dict):
        err(pid, 'gear 须为对象')
    else:
        for f in ('base', 'special'):
            check_string_list(pid, f'gear.{f}', gear.get(f), allow_empty=False)
        for f, value in gear.items():
            if f not in ('base', 'special'):
                check_string_list(pid, f'gear.{f}', value)

    hike = plan.get('hike')
    if hike is not None:
        if not isinstance(hike, dict):
            err(pid, 'hike 须为对象或 null')
        else:
            for f in ('title', 'length'):
                if not nonempty_string(hike.get(f)):
                    err(pid, f'hike.{f} 须为非空字符串')
            waypoints = hike.get('waypoints')
            if not isinstance(waypoints, list) or not waypoints:
                err(pid, 'hike.waypoints 须为非空数组')
            else:
                for j, wp in enumerate(waypoints):
                    if not isinstance(wp, dict):
                        err(pid, f'hike.waypoints[{j}] 须为对象')
                        continue
                    if not nonempty_string(wp.get('name')):
                        err(pid, f'hike.waypoints[{j}].name 须为非空字符串')
                    if 'query' in wp and not nonempty_string(wp['query']):
                        err(pid, f'hike.waypoints[{j}].query 须为非空字符串')
                    if 'query' not in wp and 'at' not in wp:
                        err(pid, f'hike.waypoints[{j}] 缺定位（query 或 at）')
                    if 'at' in wp:
                        at = wp['at']
                        if isinstance(at, bool) or not isinstance(at, (int, float)):
                            err(pid, f'hike.waypoints[{j}].at 须为数字')
                        elif not 0 <= at <= 1:
                            err(pid, f'hike.waypoints[{j}].at 超出 0–1')
                    for f in ('icon', 'act'):
                        if f in wp and not nonempty_string(wp[f]):
                            err(pid, f'hike.waypoints[{j}].{f} 须为非空字符串')


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
    ap = argparse.ArgumentParser(
        description='校验 data/data-e.js 派生方案：数据契约 + 原创性/合规（n-gram 重合、平台名/URL/作者名）。',
        epilog='示例：\n'
               '  python validate.py --corpus-root C:/Repos/outdoor/corpus\n'
               '  python validate.py --strict   # 警告也算失败\n'
               'corpus-root 缺省解析：参数 > 环境变量 CORPUS_ROOT > 仓库根 corpus/。',
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--corpus-root', help='语料库根目录；缺省解析见上')
    ap.add_argument('--repo-root', default=str(Path(__file__).resolve().parents[2]),
                    help='仓库根（定位 tools/dump-data.js 与 data/），缺省为脚本所在仓库')
    ap.add_argument('--strict', action='store_true', help='警告也导致退出码 1')
    args = ap.parse_args()
    repo = Path(args.repo_root)
    corpus = corpus_root.resolve(args.corpus_root)

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
    sys.exit(1 if errors or (args.strict and warnings) else 0)


if __name__ == '__main__':
    main()
