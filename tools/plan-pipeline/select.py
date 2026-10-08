#!/usr/bin/env python3
"""PoC：按目的地别名从语料库选料，产出证据包 JSON。

用法：
  python select.py --dest 喇叭沟门 --aliases 喇叭沟门,喇叭沟,喇叭沟原始森林 \
      --corpus-root C:/Repos/outdoor/corpus --out C:/Repos/outdoor/corpus/derived/labagoumen.bundle.json

排序：源优先级（xhs>weibo>ctrip>visitbeijing）→ 互动数据（赞+藏）→ 命中权重。
"""
import argparse
import json
import sys
from pathlib import Path

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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dest', required=True)
    ap.add_argument('--aliases', required=True, help='逗号分隔的别名集')
    ap.add_argument('--corpus-root', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--top', type=int, default=8, help='证据包收录的最大条数')
    ap.add_argument('--text-chars', type=int, default=6000, help='每条收录的正文字符数上限')
    args = ap.parse_args()

    corpus = Path(args.corpus_root)
    aliases = [a.strip() for a in args.aliases.split(',') if a.strip()]
    hits = []
    for line in (corpus / 'index.jsonl').read_text(encoding='utf-8').splitlines():
        if not line.strip():
            continue
        rec = json.loads(line)
        text_path = corpus / 'raw' / rec['source'] / str(rec['id']) / 'text.md'
        text = ''
        if text_path.exists():
            text = text_path.read_text(encoding='utf-8', errors='replace')
        w = hit_weight(rec, text, aliases)
        if not w:
            continue
        meta_path = text_path.parent / 'meta.json'
        meta = json.loads(meta_path.read_text(encoding='utf-8')) if meta_path.exists() else {}
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
