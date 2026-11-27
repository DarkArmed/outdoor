#!/usr/bin/env python3
"""选料：按目的地别名从语料库检索，产出证据包 JSON（语料转方案.md §五步骤1）。

用法：
  python select.py --dest 喇叭沟门 --aliases 喇叭沟门,喇叭沟,喇叭沟原始森林 \
      --out C:/Repos/outdoor/corpus/derived/labagoumen.bundle.json \
      [--corpus-root C:/Repos/outdoor/corpus] [--top 8] [--text-chars 6000]

corpus-root 缺省解析：--corpus-root 参数 > 环境变量 CORPUS_ROOT > 仓库根 corpus/；
找不到时给出指定方式说明（worktree 中需显式指向主检出）。
排序：源优先级（xhs>weibo>ctrip>visitbeijing）→ 互动数据（赞+藏）→ 命中权重。
"""
import argparse
import json
import sys
from pathlib import Path

import corpus_root

sys.stdout.reconfigure(encoding='utf-8')

SOURCE_RANK = {'xhs': 0, 'weibo': 1, 'ctrip': 2, 'visitbeijing': 3}
# 命中权重：destinations/keyword 字段 > 标题 > 全文
FIELD_WEIGHT = {'destinations': 4, 'keyword': 3, 'title': 2, 'text': 1}


def hit_weight(rec, text, aliases):
    w = 0
    dests = ' '.join(rec.get('destinations') or [])
    kw = rec.get('keyword') or ''
    kw = ' '.join(kw) if isinstance(kw, list) else kw
    for a in aliases:
        if a in dests:
            w += FIELD_WEIGHT['destinations']
        if a in kw:
            w += FIELD_WEIGHT['keyword']
        if a in (rec.get('title') or ''):
            w += FIELD_WEIGHT['title']
        if a in text:
            w += FIELD_WEIGHT['text']
    return w


def read_text(text_path):
    try:
        return text_path.read_text(encoding='utf-8', errors='replace')
    except OSError as e:
        print(f'警告：text.md 读取失败，按无全文处理: {text_path} ({e})', file=sys.stderr)
        return ''


def main():
    ap = argparse.ArgumentParser(
        description='按目的地别名在语料索引 + 全文中检索，产出证据包 JSON。',
        epilog='示例：python select.py --dest 喇叭沟门 --aliases 喇叭沟门,喇叭沟,喇叭沟原始森林 '
               '--corpus-root C:/Repos/outdoor/corpus --out C:/Repos/outdoor/corpus/derived/labagoumen.bundle.json',
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--dest', required=True, help='目的地名（写入证据包，供提取环节使用）')
    ap.add_argument('--aliases', required=True, help='逗号分隔的别名集（正式名+别名，避免漏料）')
    ap.add_argument('--corpus-root', help='语料库根目录；缺省解析见模块 docstring')
    ap.add_argument('--out', required=True, help='证据包输出路径（建议 corpus/derived/<slug>.bundle.json）')
    ap.add_argument('--top', type=int, default=8, help='证据包收录的最大条数')
    ap.add_argument('--text-chars', type=int, default=6000, help='每条收录的正文字符数上限')
    args = ap.parse_args()

    corpus = corpus_root.resolve(args.corpus_root)
    if not (corpus / 'raw').is_dir():
        print(f'警告：{corpus / "raw"} 不存在，全文检索降级为仅索引字段匹配', file=sys.stderr)
    aliases = [a.strip() for a in args.aliases.split(',') if a.strip()]
    if not aliases:
        sys.exit('错误：--aliases 解析后为空')

    hits = []
    for line in (corpus / 'index.jsonl').read_text(encoding='utf-8').splitlines():
        if not line.strip():
            continue
        rec = json.loads(line)
        text_path = corpus / 'raw' / rec['source'] / str(rec['id']) / 'text.md'
        text = read_text(text_path) if text_path.exists() else ''
        w = hit_weight(rec, text, aliases)
        if not w:
            continue
        meta_path = text_path.parent / 'meta.json'
        meta = {}
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text(encoding='utf-8'))
            except (OSError, json.JSONDecodeError) as e:
                print(f'警告：meta.json 读取失败，互动数据按 0 处理: {meta_path} ({e})', file=sys.stderr)
        stats = meta.get('stats') or {}
        hits.append({
            'source': rec['source'], 'id': rec['id'], 'url': rec['url'],
            'title': rec.get('title') or '', 'weight': w,
            'likes': stats.get('likes') or 0, 'collects': stats.get('collects') or 0,
            'n_images': rec.get('n_images', 0), 'n_videos': rec.get('n_videos', 0),
            'destinations': rec.get('destinations') or [],
            'text': text[:args.text_chars],
        })

    hits.sort(key=lambda h: (SOURCE_RANK.get(h['source'], 9), -(h['likes'] + h['collects']), -h['weight']))
    selected = hits[:args.top]
    bundle = {
        'destination': args.dest, 'aliases': aliases,
        'total_hits': len(hits), 'selected': len(selected),
        'items': selected,
        'rest': [{'source': h['source'], 'id': h['id'], 'title': h['title'], 'weight': h['weight']} for h in hits[args.top:]],
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'dest': args.dest, 'total_hits': len(hits), 'selected': len(selected),
                      'by_source': {s: sum(1 for h in selected if h['source'] == s) for s in {h['source'] for h in selected}}},
                     ensure_ascii=False))


if __name__ == '__main__':
    main()
