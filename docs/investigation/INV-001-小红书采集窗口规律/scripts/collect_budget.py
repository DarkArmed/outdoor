"""Local, resumable raw-only collection job. Does not edit application data/code."""
import argparse
import concurrent.futures
import hashlib
import json
import os
import re
import shutil
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

import httpx
from bs4 import BeautifulSoup

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'tools/guide-pipeline'))
sys.stdout.reconfigure(encoding='utf-8')
from sources.base import BROWSER_UA, MediaItem, RawItem, SourceBlocked, now_iso
from sources.xhs import XhsAdapter
from sources.weibo import WeiboAdapter
from store import Store
from media import MediaDownloader

LOCK = threading.RLock()
LOG = HERE / 'events.jsonl'
TODAY = datetime.now().date().isoformat()
CONFIG = json.loads((ROOT / 'tools/guide-pipeline/config.json').read_text(encoding='utf-8'))
STOP = HERE / 'STOP'

SESSION_BUDGET = 25  # 会话预算：搜索+详情尝试合计，达到即主动收工（fresh 窗口耐受约 82 请求，留安全余量）

def session_used(source):
    history = [json.loads(s) for s in LOG.read_text(encoding='utf-8').splitlines()] if LOG.exists() else []
    return sum(e['source'] == source and e['event'] in ('search', 'detail_attempt') and e['time'].startswith(TODAY) for e in history)

def event(kind, source, **data):
    row = {'time': now_iso(), 'event': kind, 'source': source, **data}
    with LOCK:
        with LOG.open('a', encoding='utf-8') as fh:
            fh.write(json.dumps(row, ensure_ascii=False) + '\n')
        print(json.dumps(row, ensure_ascii=False), flush=True)

def atomic_json(path, data):
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    os.replace(tmp, path)

class AtomicStore(Store):
    def _write_index(self):
        self.root.mkdir(parents=True, exist_ok=True)
        tmp = self.index_path.with_suffix('.jsonl.tmp')
        tmp.write_text(''.join(json.dumps(x, ensure_ascii=False) + '\n' for x in self._index.values()), encoding='utf-8')
        os.replace(tmp, self.index_path)

def relevant(text, dest):
    # Selection only; raw source content is never rewritten.
    return any(alias in text for alias in dest['search_aliases'])

def attach_existing(source, ident, dest, keyword):
    with LOCK:
        store = AtomicStore(ROOT / 'corpus')
        rec = store.get(source, ident)
        if not rec: return False
        path = store.raw_root / source / str(ident) / 'meta.json'
        meta = json.loads(path.read_text(encoding='utf-8'))
        if not relevant(meta.get('title', '') + (path.parent / 'text.md').read_text(encoding='utf-8'), dest):
            return False
        group = dest['name']
        if group not in meta.get('destinations', []):
            if store.count_group(group, source) >= 5: return False
            meta['destinations'] = list(dict.fromkeys(meta.get('destinations', []) + [group]))
            old = meta.get('keyword', [])
            old = old if isinstance(old, list) else [old]
            meta['keyword'] = list(dict.fromkeys(old + [keyword]))
            atomic_json(path, meta)
            rec['destinations'] = meta['destinations']
            rec['keyword'] = meta['keyword']
            store._write_index()
        return True

def source_has(source, group):
    with LOCK:
        return AtomicStore(ROOT / 'corpus').count_group(group, source) >= 1

def any_has(group):
    with LOCK:
        return AtomicStore(ROOT / 'corpus').count_group(group) >= 1

def reserve(source, ident):
    # Count all detail attempts, including failures; reserve one for earlier smoke tests.
    with LOCK:
        history = [json.loads(s) for s in LOG.read_text(encoding='utf-8').splitlines()] if LOG.exists() else []
        if any(e['source'] == source and e['event'] == 'blocked' and e['time'].startswith(TODAY) for e in history):
            raise SourceBlocked('Source already stopped for this job today')
        attempts = sum(e['source'] == source and e['event'] == 'detail_attempt' and e['time'].startswith(TODAY) for e in history)
        stored = AtomicStore(ROOT / 'corpus').count_fetched_today(source, TODAY)
        limit = (CONFIG.get('rate_limits', {}).get('xhs' if source == 'xhs' else 'default') or {}).get('daily_cap', 100 if source == 'xhs' else 200)
        if max(attempts, stored) >= limit - 1:
            raise StopIteration('daily_cap')
        if session_used(source) >= SESSION_BUDGET: raise StopIteration('session_budget')
        if STOP.exists(): raise StopIteration('manual_stop')
        if shutil.disk_usage(ROOT).free < 10 * 1024**3: raise StopIteration('disk_reserve_10GB')
        event('detail_attempt', source, id=str(ident))

class CheckedMedia(MediaDownloader):
    def __init__(self, referer):
        super().__init__(referer=referer, concurrency=2, max_retries=1,
                         video_max_bytes=CONFIG['video_max_bytes'])
        self._client.event_hooks['response'].append(lambda r: r.raise_for_status())

    def download_image(self, url, dest_dir, idx):
        r = super().download_image(url, dest_dir, idx)
        if r.get('file'):
            path = dest_dir / r['file']
            with path.open('rb') as fh: head = fh.read(16)
            valid = head.startswith((b'\xff\xd8\xff', b'\x89PNG', b'GIF8')) or (head[:4] == b'RIFF' and head[8:12] == b'WEBP')
            if not valid:
                path.unlink()
                r.update(file=None, skipped_reason='invalid_image_payload')
        if r.get('skipped_reason'):
            r['skipped_reason'] = re.sub(r'https?://[^\s]+', '[url]', r['skipped_reason'])[:240]
        return r

    def download_video(self, item, dest_dir, idx):
        r = super().download_video(item, dest_dir, idx)
        if not r.get('file'):
            (dest_dir / f'{idx:03d}.mp4').unlink(missing_ok=True)
        return r

def save_item(item, dest, keyword, downloader, original=None, original_name=None):
    AtomicStore._validate(item)  # Validate attribution before downloading anything.
    if not item.text.strip(): raise ValueError('empty_body')
    with LOCK:
        store = AtomicStore(ROOT / 'corpus')
        if store.has(item.source, item.id):
            return attach_existing(item.source, item.id, dest, keyword)
        if store.count_group(dest['name'], item.source) >= 5: return False
        folder = store.item_dir(item)
    # Preserve covers for video-only notes and videos over the configured size limit.
    origins = {m.origin_url for m in item.images}
    for video in item.videos:
        if video.cover and video.cover not in origins:
            item.images.append(MediaItem(video.cover))
            origins.add(video.cover)
    images, videos = downloader.download_all(item.images, item.videos, folder)
    with LOCK:
        store = AtomicStore(ROOT / 'corpus')
        if store.has(item.source, item.id): return True
        saved = store.save(item, keyword, [dest['name']], images, videos)
        if original is not None:
            if isinstance(original, bytes): (saved / original_name).write_bytes(original)
            else: atomic_json(saved / original_name, original)
    event('saved', item.source, destination=dest['name'], id=item.id,
          text_characters=len(item.text), images=sum(bool(x.get('file')) for x in images),
          videos=sum(bool(x.get('file')) for x in videos),
          media_skipped=sum(not x.get('file') for x in images + videos))
    return True

def public_worker(plan):
    source = 'visitbeijing'
    downloader = CheckedMedia('https://s.visitbeijing.com.cn/')
    last = 0.0
    try:
        with httpx.Client(timeout=35, follow_redirects=True, headers={'User-Agent':BROWSER_UA}) as client:
            for dest in plan['official_queue']:
                if source_has(source, dest['name']): continue
                reserve(source, dest['id'])
                time.sleep(max(0, 5.1 - (time.monotonic() - last)))
                last = time.monotonic()
                r = client.get(dest['url'])
                if r.status_code in (403, 429): raise SourceBlocked(f'HTTP {r.status_code}')
                try:
                    r.raise_for_status()
                    soup = BeautifulSoup(r.text, 'html.parser')
                    nodes = soup.select('.infos, .scene_recommends, .scenic-pictures .adress, .map .adress')
                    title = soup.select_one('.infos h3.title')
                    if not title or not nodes: raise ValueError('missing_detail_body')
                    # Raw HTML is the authoritative archive; text is verbatim DOM text.
                    text = '\n\n'.join(n.get_text('\n', strip=True) for n in nodes)
                    urls = []
                    for n in soup.select('.infos, .scene_recommends, .scenic-pictures'):
                        for img in n.select('img[src]'):
                            u = img['src']
                            if u.startswith('//'): u = 'https:' + u
                            if u.startswith('http') and u not in urls: urls.append(u)
                    item = RawItem(source, dest['id'], dest['url'], title.get_text(strip=True),
                                   '北京旅游网', 's.visitbeijing.com.cn', text=text,
                                   images=[MediaItem(u) for u in urls],
                                   raw_extra={'listing':dest, 'collection_job':HERE.name, 'source_html':'source.html'})
                    save_item(item, dest, dest['name'], downloader, r.content, 'source.html')
                except SourceBlocked: raise
                except Exception as exc: event('failed', source, destination=dest['name'], error=type(exc).__name__)
    except StopIteration as exc: event('stopped', source, reason=str(exc))
    except SourceBlocked as exc: event('blocked', source, reason=str(exc))
    except Exception as exc: event('worker_failed', source, error=type(exc).__name__)
    finally:
        downloader.close()
        event('worker_done', source)

def ugc_worker(source, plan):
    adapter = None
    downloader = None
    try:
        prior = [json.loads(s) for s in LOG.read_text(encoding='utf-8').splitlines()] if LOG.exists() else []
        if any(e['source'] == source and e['event'] == 'blocked' and e['time'].startswith(TODAY) for e in prior):
            raise StopIteration('source_paused_for_today')
        cls = XhsAdapter if source == 'xhs' else WeiboAdapter
        adapter = cls(CONFIG)
        downloader = CheckedMedia(cls.referer)
        if source == 'weibo':
            original_show = adapter._show
            def capture(ident):
                try: adapter._last_payload = original_show(ident)
                except RuntimeError as exc:
                    if re.search(r'\b(403|429)\b', str(exc)): raise SourceBlocked('detail HTTP access restriction') from exc
                    raise
                return adapter._last_payload
            adapter._show = capture
        queue = plan[source + '_queue']
        history = [json.loads(s) for s in LOG.read_text(encoding='utf-8').splitlines()] if LOG.exists() else []
        already_unfilled = {e.get('destination') for e in history if e['source'] == source and e['event'] == 'destination_unfilled'}
        already_attempted = {str(e.get('id')) for e in history if e['source'] == source and e['event'] == 'detail_attempt'}
        consecutive_empty = 0
        for dest in queue:
            if STOP.exists(): raise StopIteration('manual_stop')
            if source_has(source, dest['name']): continue
            if dest['name'] in already_unfilled: continue
            successes = False
            for keyword in dest['queries'][:1]:
                if session_used(source) >= SESSION_BUDGET: raise StopIteration('session_budget')
                event('search', source, destination=dest['name'], keyword=keyword)
                try:
                    refs = adapter.search(keyword)
                    event('search_results', source, destination=dest['name'], count=len(refs))
                    consecutive_empty = consecutive_empty + 1 if not refs else 0
                    if consecutive_empty >= 3:
                        raise SourceBlocked('Three consecutive empty searches; conservatively paused, cause unconfirmed')
                except SourceBlocked: raise
                except Exception as exc:
                    event('search_failed', source, destination=dest['name'], error=type(exc).__name__)
                    break
                # Stronger relevance titles first; at most two detail attempts per search.
                refs.sort(key=lambda r:not relevant(r.title, dest))
                tried = 0
                for ref in refs:
                    with LOCK: exists = AtomicStore(ROOT / 'corpus').has(source, ref.id)
                    if exists:
                        if attach_existing(source, ref.id, dest, keyword):
                            event('existing_match', source, destination=dest['name'], id=ref.id)
                            successes = True
                            break
                        continue
                    if str(ref.id) in already_attempted: continue
                    if tried >= 2: break
                    reserve(source, ref.id)
                    already_attempted.add(str(ref.id))
                    tried += 1
                    try:
                        item = adapter.fetch(ref)
                        if not relevant(item.title + '\n' + item.text, dest):
                            event('unmatched', source, destination=dest['name'], id=ref.id)
                            continue
                        if len(item.text.strip()) < 30:
                            event('short_body', source, destination=dest['name'], id=ref.id)
                            continue
                        item.raw_extra['collection_job'] = HERE.name
                        item.raw_extra['query_original'] = keyword
                        if source == 'xhs':
                            original = adapter.page.evaluate('(id) => { const m=window.__INITIAL_STATE__?.note?.noteDetailMap; return m?.[id]?.note || null; }', ref.id)
                        else: original = adapter._last_payload
                        successes = save_item(item, dest, keyword, downloader, original, 'source.json')
                        if successes: break
                    except SourceBlocked: raise
                    except Exception as exc: event('failed', source, destination=dest['name'], error=type(exc).__name__)
                if successes: break
            if not successes: event('destination_unfilled', source, destination=dest['name'])
    except StopIteration as exc: event('stopped', source, reason=str(exc))
    except SourceBlocked as exc: event('blocked', source, reason=re.sub(r'https?://[^\s]+','[url]',str(exc))[:180])
    except Exception as exc: event('worker_failed', source, error=type(exc).__name__)
    finally:
        if downloader: downloader.close()
        if adapter: adapter.close()
        event('worker_done', source)

if __name__ == '__main__':
    import msvcrt
    parser = argparse.ArgumentParser()
    parser.add_argument('--sources', nargs='+', default=['visitbeijing','xhs','weibo'])
    args = parser.parse_args()
    lease = (HERE / 'running.lock').open('a+b')
    lease.seek(0)
    if lease.read(1) == b'': lease.write(b'0'); lease.flush()
    lease.seek(0)
    msvcrt.locking(lease.fileno(), msvcrt.LK_NBLCK, 1)
    plan = json.loads((HERE / 'plan.json').read_text(encoding='utf-8'))
    backup = HERE / 'index-before.jsonl'
    if not backup.exists(): shutil.copy2(ROOT / 'corpus/index.jsonl', backup)
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(args.sources)) as pool:
        futures = [pool.submit(public_worker, plan) if s == 'visitbeijing' else pool.submit(ugc_worker, s, plan) for s in args.sources]
        for future in futures: future.result()
    event('job_done', 'all')
