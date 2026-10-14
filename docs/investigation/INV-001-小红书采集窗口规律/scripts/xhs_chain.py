# xhs 每日节奏链：每轮 25 请求，clean→24h 后再跑，streak→冷却翻倍(封顶48h)
# 修复：每轮独立时间戳目录；只统计本轮 launch 之后的事件；冻结(streak/instant-pause)与干净收工分别记账
# 归档快照：路径绑定原始运行位置（corpus/collection/ + tools/guide-pipeline/.venv），搬离后不可直接运行
import json
import re
import shutil
import subprocess
import time
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path

BASE = Path(__file__).resolve().parent
VENV = BASE.parents[1] / 'tools/guide-pipeline/.venv/Scripts/python.exe'
BUDGET = 25
MAX_ROUNDS = 10
RESULTS = BASE / 'xhs_chain_results.tsv'
TZ_NOW = lambda: datetime.now().astimezone()
NEXT_MORNING = None  # 首轮固定 10-13 08:30（满休息验证 24h 回补）
streak_run = 0

def log(msg):
    print(f'[{TZ_NOW():%m-%d %H:%M:%S}] {msg}', flush=True)
    if not RESULTS.exists():
        RESULTS.write_text('round\tlaunch\tcooldown_h\trequests\tsaved\toutcome\n', encoding='utf-8')

def record(name, launch_at, cd_h, text, outcome):
    nreq = text.count('"event": "search"') + text.count('"event": "detail_attempt"')
    nsaved = text.count('"event": "saved"')
    with RESULTS.open('a', encoding='utf-8') as fh:
        fh.write(f'{name}\t{launch_at:%m-%d %H:%M}\t{cd_h}\t{nreq}\t{nsaved}\t{outcome}\n')

def xhs_groups():
    s = set()
    for line in (BASE.parent / 'index.jsonl').read_text(encoding='utf-8').splitlines():
        r = json.loads(line)
        if r['source'] == 'xhs':
            s.update(r.get('destinations', []))
    return s

def next_morning():
    now = TZ_NOW()
    t = now.replace(hour=8, minute=30, second=0, microsecond=0)
    return t if t > now else t + timedelta(days=1)

rounds = 0
prev = BASE / '20261012-xhs-b4'
cooldown = timedelta(hours=24)
first = True
while rounds < MAX_ROUNDS:
    groups = xhs_groups()
    prev_plan = json.loads((prev / 'plan.json').read_text(encoding='utf-8'))
    remaining = [d for d in prev_plan['selected'] if d['name'] not in groups]
    if not remaining:
        log('队列已空，收工')
        break
    # 按历史尝试次数升序排队：从没试过的先采，反复落空的沉底，避免每轮在队列头重复烧钱
    tries = Counter()
    for ef in BASE.glob('*/events.jsonl'):
        for l in ef.read_text(encoding='utf-8').splitlines():
            try:
                e = json.loads(l)
            except Exception:
                continue
            if e.get('source') == 'xhs' and e.get('event') == 'search':
                tries[e.get('destination')] += 1
    remaining.sort(key=lambda d: (tries.get(d['name'], 0), d['name']))
    log('尝试次数分布: ' + str(dict(Counter(tries.get(d['name'], 0) for d in remaining))))
    stamp = f'{TZ_NOW():%m%d-%H%M}'
    bdir = BASE / f'xhs-chain-{stamp}'
    bdir.mkdir(exist_ok=True)
    for f in ('collect.py', 'status.py', 'counting.py'):
        shutil.copy2(prev / f, bdir / f)
    cp = bdir / 'collect.py'
    cp.write_text(re.sub(r'SESSION_BUDGET = \d+', f'SESSION_BUDGET = {BUDGET}',
                         cp.read_text(encoding='utf-8')), encoding='utf-8')
    plan = dict(prev_plan)
    plan['scope'] = f'小红书每日节奏：预算{BUDGET}；第{rounds + 1}轮；按历史尝试次数升序'
    plan['selected'] = remaining
    order = {d['name']: i for i, d in enumerate(remaining)}
    plan['xhs_queue'] = sorted((d for d in prev_plan['xhs_queue'] if d['name'] in order),
                               key=lambda d: order[d['name']])
    (bdir / 'plan.json').write_text(json.dumps(plan, ensure_ascii=False, indent=1), encoding='utf-8')

    wake = next_morning() if first else TZ_NOW() + cooldown
    first = False
    while TZ_NOW() < wake:
        time.sleep(120)
    launch_at = TZ_NOW()
    log(f'启动 {bdir.name} 队列={len(remaining)}')
    with open(bdir / 'run.out', 'w', encoding='utf-8') as out:
        proc = subprocess.Popen([str(VENV), 'collect.py', '--sources', 'xhs'],
                                cwd=bdir, stdout=out, stderr=subprocess.STDOUT)
    ev = bdir / 'events.jsonl'
    while proc.poll() is None:
        time.sleep(20)
    time.sleep(3)
    all_lines = ev.read_text(encoding='utf-8').splitlines() if ev.exists() else []
    mine = []
    for l in all_lines:
        try:
            if datetime.fromisoformat(json.loads(l)['time']) >= launch_at:
                mine.append(l)
        except Exception:
            pass
    text = '\n'.join(mine)
    paused = 'source_paused_for_today' in text
    blocked = '"event": "blocked"' in text
    clean = not blocked and not paused
    if paused:
        outcome = 'frozen'
    elif blocked:
        outcome = 'streak'
    elif text.count('"event": "search"') + text.count('"event": "detail_attempt"') >= BUDGET:
        outcome = 'budget_stop'
    else:
        outcome = 'clean_other'
    record(bdir.name, launch_at, round(cooldown.total_seconds() / 3600, 1), text, outcome)
    log(f'{bdir.name}: outcome={outcome}')
    if clean:
        streak_run = 0
        cooldown = timedelta(hours=24)
    else:
        streak_run += 1
        if streak_run >= 4:
            log('连续 4 轮未 clean，账号信用疑似严重受损，停止链等待人工判断')
            break
        cooldown = timedelta(hours=min(24 * (2 ** streak_run), 48))
    prev = bdir
    rounds += 1
log('链结束')
