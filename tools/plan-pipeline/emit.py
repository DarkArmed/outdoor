#!/usr/bin/env python3
"""落盘：reviewed draft → data/data-e.js 追加 PLANS 条目（语料转方案.md §五步骤4）。

用法：
  落盘：  python emit.py --draft C:/Repos/outdoor/corpus/derived/<slug>.draft.json [--draft ...]
  校验：  python emit.py --check --draft <file> [--draft ...]

行为：
  - 落盘模式：draft.status 须为 reviewed/emitted；plan.id 已存在于 data-e.js 时幂等跳过；
    追加成功后把 draft.status 置为 emitted。
  - --check：不写文件，校验 draft.plan 与 data-e.js 中同 id 条目经同一序列化器输出等价，
    不等价或缺失时退出码 1。
退出码：0 全部成功；1 有失败项。
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

REPO = Path(__file__).resolve().parents[2]
DATA_E = REPO / 'data' / 'data-e.js'
JSFMT = Path(__file__).resolve().parent / 'jsfmt.js'


def run_node(args, stdin=None):
    r = subprocess.run(['node', str(JSFMT), *args], input=stdin,
                       capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0:
        sys.stderr.write('node jsfmt.js 执行失败:\n' + r.stderr[:2000])
        raise SystemExit(1)
    return r.stdout


def load_existing():
    """data-e.js 中现有条目，[{plan}, ...]；文件不存在视为空。"""
    if not DATA_E.exists():
        return []
    return json.loads(run_node(['parse', str(DATA_E)]))


def to_js(plan):
    return run_node(['fmt'], stdin=json.dumps(plan, ensure_ascii=False))


def append_plan(js):
    content = DATA_E.read_text(encoding='utf-8') if DATA_E.exists() else ''
    with DATA_E.open('a', encoding='utf-8', newline='\n') as f:
        if content:
            if not content.endswith('\n'):
                f.write('\n')
            f.write('\n')
        f.write('PLANS.push(' + js + ');\n')


def set_draft_status(path, draft, status):
    draft['status'] = status
    path.write_text(json.dumps(draft, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main():
    ap = argparse.ArgumentParser(
        description='把 reviewed draft 落盘为 data/data-e.js 条目（幂等），或 --check 校验等价性。',
        epilog='示例：\n'
               '  python emit.py --draft C:/Repos/outdoor/corpus/derived/labagoumen.draft.json\n'
               '  python emit.py --check --draft a.draft.json --draft b.draft.json',
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--draft', action='append', required=True,
                    help='draft JSON 路径，可多次指定')
    ap.add_argument('--check', action='store_true',
                    help='只校验 draft.plan 与 data-e.js 同 id 条目序列化等价，不写文件')
    args = ap.parse_args()

    existing = {p.get('id'): p for p in load_existing()}
    failed = False

    for draft_path in args.draft:
        path = Path(draft_path)
        try:
            draft = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError) as e:
            print(f'FAIL {path}: draft 读取失败: {e}')
            failed = True
            continue
        plan = draft.get('plan')
        if not isinstance(plan, dict) or not plan.get('id'):
            print(f'FAIL {path.name}: 缺 plan 对象或 plan.id（draft 须含完整 PLANS 条目，见语料转方案.md §4.2）')
            failed = True
            continue
        pid = plan['id']

        if args.check:
            cur = existing.get(pid)
            if cur is None:
                print(f'FAIL {path.name}: data-e.js 中无 id={pid}')
                failed = True
            elif to_js(cur) == to_js(plan):
                print(f'OK   {path.name}: {pid} 与 data-e.js 条目等价')
            else:
                print(f'FAIL {path.name}: {pid} 与 data-e.js 条目序列化后不等价')
                failed = True
            continue

        status = draft.get('status')
        if status not in ('reviewed', 'emitted'):
            print(f'FAIL {path.name}: status={status!r}，须先审校置为 reviewed 再落盘')
            failed = True
            continue
        if pid in existing:
            print(f'SKIP {path.name}: {pid} 已存在于 data-e.js，幂等跳过')
            continue
        append_plan(to_js(plan))
        existing[pid] = plan
        set_draft_status(path, draft, 'emitted')
        print(f'DONE {path.name}: {pid} 已追加到 {DATA_E.relative_to(REPO)}，draft 置为 emitted')

    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
