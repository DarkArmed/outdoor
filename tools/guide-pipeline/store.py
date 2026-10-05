"""落盘：目录组织（corpus/raw/<source>/<id>/）、meta.json/text.md 写入、index.jsonl 索引维护。

合规红线（docs/tech/攻略流水线.md 第六节）：meta.json 缺 url 或 author 的条目拒绝落盘。
去重：index.jsonl 按 source + id 查重（docs/tech/攻略流水线.md 第三节）。
目的地限额：某「目的地/主题组」已采篇数按索引中 destinations 计数（一条语料命中多组分别计数）。
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from sources.base import RawItem, now_iso

INDEX_FILENAME = "index.jsonl"


class ComplianceError(Exception):
    """缺必填出处字段（url/author）等合规问题，拒绝落盘。"""


class Store:
    def __init__(self, corpus_root: Path):
        self.root = Path(corpus_root)
        self.raw_root = self.root / "raw"
        self.index_path = self.root / INDEX_FILENAME
        # (source, id) -> 索引记录
        self._index: dict[tuple[str, str], dict] = {}
        self._load_index()

    # ---------- 索引 ----------

    def _load_index(self) -> None:
        if not self.index_path.exists():
            return
        for line in self.index_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
                self._index[(rec["source"], str(rec["id"]))] = rec
            except (json.JSONDecodeError, KeyError):
                continue  # 损坏行跳过，不中断采集

    def _write_index(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        lines = [json.dumps(rec, ensure_ascii=False) for rec in self._index.values()]
        self.index_path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")

    def has(self, source: str, id: str) -> bool:
        return (source, str(id)) in self._index

    def get(self, source: str, id: str) -> Optional[dict]:
        return self._index.get((source, str(id)))

    def count_group(self, group_name: str) -> int:
        """该目的地/主题组已采篇数（索引中 destinations 含组名）。"""
        return sum(1 for rec in self._index.values() if group_name in (rec.get("destinations") or []))

    def count_fetched_today(self, source: str, date_prefix: str) -> int:
        """单源今日已采条数（fetched_at 的日期前缀匹配），用于每日上限。"""
        return sum(
            1 for rec in self._index.values()
            if rec.get("source") == source and str(rec.get("fetched_at", "")).startswith(date_prefix)
        )

    # ---------- 落盘 ----------

    def item_dir(self, item: RawItem) -> Path:
        return self.raw_root / item.source / str(item.id)

    @staticmethod
    def _validate(item: RawItem) -> None:
        # 合规红线：出处必填（docs/tech/攻略流水线.md 第六节）
        if not item.url:
            raise ComplianceError(f"{item.source}/{item.id} 缺 url，拒绝落盘")
        if not item.author_name or not item.author_id:
            raise ComplianceError(f"{item.source}/{item.id} 缺 author.name/author.id，拒绝落盘")

    def save(
        self,
        item: RawItem,
        keyword: str,
        destinations: list[str],
        image_results: list[dict],
        video_results: list[dict],
    ) -> Path:
        """保存新条目（去重由 pipeline 先行判断，这里直接覆盖写同名条目目录）。"""
        self._validate(item)
        item_dir = self.item_dir(item)
        item_dir.mkdir(parents=True, exist_ok=True)

        # keyword/destinations 契约：多关键词、多组命中时追加（并集），组计数按各组累计
        existing = self.get(item.source, item.id)
        keywords: list[str] = []
        prev_destinations: list[str] = []
        if existing:
            prev = existing.get("keyword")
            keywords = list(prev) if isinstance(prev, list) else ([prev] if prev else [])
            prev_destinations = list(existing.get("destinations") or [])
        if keyword and keyword not in keywords:
            keywords.append(keyword)
        destinations = list(dict.fromkeys(prev_destinations + list(destinations)))

        n_images = sum(1 for r in image_results if r.get("file"))
        n_videos = sum(1 for r in video_results if r.get("file"))
        meta = {
            "source": item.source,
            "id": str(item.id),
            "url": item.url,
            "title": item.title,
            "author": {"name": item.author_name, "id": str(item.author_id)},
            "published_at": item.published_at,
            "fetched_at": now_iso(),
            "keyword": keywords[0] if len(keywords) == 1 else keywords,
            "destinations": destinations,
            "stats": {
                "likes": item.stats.get("likes"),
                "collects": item.stats.get("collects"),
                "comments": item.stats.get("comments"),
                "plays": item.stats.get("plays"),
            },
            "media": {"images": image_results, "videos": video_results},
            "raw_extra": item.raw_extra,
        }
        (item_dir / "meta.json").write_text(
            json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        (item_dir / "text.md").write_text(item.text or "", encoding="utf-8")

        self._index[(item.source, str(item.id))] = {
            "source": item.source,
            "id": str(item.id),
            "title": item.title,
            "keyword": meta["keyword"],
            "destinations": destinations,
            "url": item.url,
            "fetched_at": meta["fetched_at"],
            "n_images": n_images,
            "n_videos": n_videos,
            "has_fulltext": bool(item.text and item.text.strip()),
        }
        self._write_index()
        return item_dir

    def refresh_stats(self, source: str, id: str, stats: dict) -> bool:
        """--refresh：已存在条目只更新 meta.json 的 stats 与 fetched_at，不重下媒体。"""
        rec = self.get(source, id)
        if not rec:
            return False
        meta_path = self.raw_root / source / str(id) / "meta.json"
        if meta_path.exists():
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            meta["stats"] = {
                "likes": stats.get("likes"),
                "collects": stats.get("collects"),
                "comments": stats.get("comments"),
                "plays": stats.get("plays"),
            }
            meta["fetched_at"] = now_iso()
            meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
            rec["fetched_at"] = meta["fetched_at"]
            self._write_index()
        return True
