"""攻略采集流水线入口（docs/tech/攻略流水线.md）。

用法：
  python pipeline.py --source weibo --keyword "白河湾" [--max 2]
  python pipeline.py --source ctrip  --keyword "北京"
  python pipeline.py --source xhs   --login        # 首次扫码登录（需用户在场）
  python pipeline.py --source weibo [--group 白河湾] [--refresh]

按 config.json 的 destination_groups 遍历关键词：
  - 组已采篇数（index.jsonl 中 destinations 计数）达到 cap 后跳过该组关键词
  - 一条语料命中多个组时各组分别计数
  - index.jsonl 按 source + id 去重；已存在默认跳过；--refresh 只更新 stats 与 fetched_at
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

# Windows 控制台默认 GBK，统一改 UTF-8 输出避免日志乱码
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")

BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parent.parent
CORPUS_ROOT = REPO_ROOT / "corpus"
CONFIG_PATH = BASE_DIR / "config.json"
CONFIG_EXAMPLE = BASE_DIR / "config.example.json"

sys.path.insert(0, str(BASE_DIR))

from sources.base import DEFAULT_DAILY_CAP, DEFAULT_GROUP_CAP, DEFAULT_MEDIA_CONCURRENCY, DEFAULT_MEDIA_RETRIES, DEFAULT_VIDEO_MAX_BYTES, SourceBlocked  # noqa: E402
from sources.ctrip import CtripAdapter  # noqa: E402
from sources.weibo import WeiboAdapter  # noqa: E402
from sources.xhs import XhsAdapter, login as xhs_login  # noqa: E402
from media import MediaDownloader  # noqa: E402
from store import ComplianceError, Store  # noqa: E402

ADAPTERS = {"weibo": WeiboAdapter, "ctrip": CtripAdapter, "xhs": XhsAdapter}


def load_config() -> dict:
    # config.json 为本地配置（gitignore）；缺省时回退到 example（参数均为用户确认默认值）
    path = CONFIG_PATH if CONFIG_PATH.exists() else CONFIG_EXAMPLE
    if path == CONFIG_EXAMPLE:
        print(f"[config] 未找到 config.json，使用默认值 {CONFIG_EXAMPLE.name}")
    return json.loads(path.read_text(encoding="utf-8"))


def build_plan(args, config: dict) -> list[tuple[str, list[str]]]:
    """返回 [(keyword, [命中的目的地组名])]。"""
    groups = config.get("destination_groups") or []

    def groups_of(kw: str) -> list[str]:
        return [g["name"] for g in groups if kw in (g.get("keywords") or [])]

    if args.keyword:
        return [(kw, groups_of(kw)) for kw in args.keyword]
    selected = groups
    if args.group:
        selected = [g for g in groups if g["name"] == args.group]
        if not selected:
            raise SystemExit(f"config 中不存在目的地组: {args.group}（可选: {[g['name'] for g in groups]}）")
    return [(kw, [g["name"]]) for g in selected for kw in (g.get("keywords") or [])]


def main() -> int:
    parser = argparse.ArgumentParser(description="户外攻略采集流水线（corpus 落盘 + 索引去重）")
    parser.add_argument("--source", required=True, choices=sorted(ADAPTERS))
    parser.add_argument("--keyword", action="append", help="检索关键词（可重复）；缺省时遍历 config 的目的地组")
    parser.add_argument("--group", help="只跑某个目的地组（组名见 config.json）")
    parser.add_argument("--login", action="store_true", help="小红书扫码登录（保存 cookie 后退出）")
    parser.add_argument("--refresh", action="store_true", help="已存在条目只更新 stats 与 fetched_at")
    parser.add_argument("--max", type=int, default=None, help="每个关键词最多采集条数（默认不限，受组限额/每日上限约束）")
    args = parser.parse_args()

    config = load_config()

    if args.source == "xhs" and args.login:
        xhs_login()
        return 0

    store = Store(CORPUS_ROOT)
    media_cfg = config.get("media") or {}
    downloader = MediaDownloader(
        referer=ADAPTERS[args.source].referer,
        concurrency=media_cfg.get("concurrency", DEFAULT_MEDIA_CONCURRENCY),
        max_retries=media_cfg.get("max_retries", DEFAULT_MEDIA_RETRIES),
        video_max_bytes=config.get("video_max_bytes", DEFAULT_VIDEO_MAX_BYTES),
    )
    adapter = ADAPTERS[args.source](config)

    limits = (config.get("rate_limits") or {}).get(
        "xhs" if args.source == "xhs" else "default", {}
    )
    daily_cap = int(limits.get("daily_cap", DEFAULT_DAILY_CAP))
    today = datetime.now().date().isoformat()

    plan = build_plan(args, config)
    if not plan:
        print("没有可执行的关键词（检查 config.json 的 destination_groups）")
        return 0

    group_caps = {g["name"]: int(g.get("cap", DEFAULT_GROUP_CAP))
                  for g in (config.get("destination_groups") or [])}

    fetched_new = 0
    try:
        for keyword, matched_groups in plan:
            full_groups = [g for g in matched_groups if store.count_group(g, args.source) >= group_caps.get(g, DEFAULT_GROUP_CAP)]
            if matched_groups and len(full_groups) == len(matched_groups):
                print(f"[skip] 关键词「{keyword}」的目的地组已满额: {matched_groups}")
                continue
            print(f"[search] source={args.source} keyword={keyword}")
            try:
                refs = adapter.search(keyword)
            except SourceBlocked as exc:
                print(f"[blocked] {exc}\n已停止该源。请人工处理后重试（微博风控建议退避 30 分钟）。", file=sys.stderr)
                return 2
            print(f"[search] 命中 {len(refs)} 条")

            fetched_this_kw = 0
            for ref in refs:
                if args.max is not None and fetched_this_kw >= args.max:
                    break
                if store.count_fetched_today(args.source, today) >= daily_cap:
                    print(f"[stop] 已达单源每日上限 {daily_cap} 条")
                    return 0
                if matched_groups and all(store.count_group(g, args.source) >= group_caps.get(g, DEFAULT_GROUP_CAP) for g in matched_groups):
                    break  # 该关键词命中的组全部满额

                if store.has(ref.source, ref.id):
                    if args.refresh:
                        try:
                            item = adapter.fetch(ref)
                            store.refresh_stats(ref.source, ref.id, item.stats)
                            print(f"[refresh] {ref.source}/{ref.id}")
                        except SourceBlocked as exc:
                            print(f"[blocked] {exc}", file=sys.stderr)
                            return 2
                        except Exception as exc:
                            print(f"[warn] refresh 失败 {ref.source}/{ref.id}: {exc}")
                    else:
                        print(f"[dup] 跳过已存在 {ref.source}/{ref.id}")
                    continue

                try:
                    item = adapter.fetch(ref)
                except SourceBlocked as exc:
                    print(f"[blocked] {exc}\n已停止该源。请人工处理后重试（微博风控建议退避 30 分钟）。", file=sys.stderr)
                    return 2
                except Exception as exc:
                    print(f"[warn] 详情抓取失败 {ref.source}/{ref.id}: {exc}")
                    continue

                try:
                    image_results, video_results = downloader.download_all(
                        item.images, item.videos, store.item_dir(item)
                    )
                    item_dir = store.save(item, keyword, matched_groups, image_results, video_results)
                except ComplianceError as exc:
                    print(f"[reject] 合规拒绝: {exc}")
                    continue
                fetched_new += 1
                fetched_this_kw += 1
                n_img = sum(1 for r in image_results if r.get("file"))
                n_vid = sum(1 for r in video_results if r.get("file"))
                print(f"[save] {item.source}/{item.id} -> {item_dir.relative_to(REPO_ROOT)} "
                      f"(images={n_img}, videos={n_vid})")
    finally:
        downloader.close()
        adapter.close()
    print(f"完成：新采 {fetched_new} 条，语料库根目录 {CORPUS_ROOT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
