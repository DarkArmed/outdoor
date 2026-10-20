"""北京旅游网 s.visitbeijing.com.cn 采集（官方源，免登录，httpx + BeautifulSoup）。

自批次脚本 collect.py 的 public_worker 转正为正式 SourceAdapter：
  - 该站无可用的关键词搜索入口：search() 不触网，从 config.json 的
    visitbeijing.queue（{id, url, name, keywords?}）中按关键词匹配待采页面
  - fetch() 拉详情页，抽取正文块与图片；原始 HTML 是权威存档，随条目存 source.html
    （经 raw_extra["source_html_bytes"] 传给 pipeline 落盘，不进 meta.json）
  - HTTP 403/429 → SourceBlocked 停采该源，不自动对抗（合规红线）
限速：详情间隔 >= 5s（批次脚本实测值，rate_limits.default 更保守时取更保守）
"""

from __future__ import annotations

import httpx
from bs4 import BeautifulSoup

from .base import (
    BROWSER_UA,
    MediaItem,
    RateLimiter,
    RawItem,
    Ref,
    SourceAdapter,
    SourceBlocked,
)

DETAIL_INTERVAL_S = 5.0


class VisitbeijingAdapter(SourceAdapter):
    source = "visitbeijing"
    referer = "https://s.visitbeijing.com.cn/"

    def __init__(self, config: dict):
        super().__init__(config)
        limits = (config.get("rate_limits") or {}).get("default", {})
        self.limiter = RateLimiter(
            detail_interval_s=max(DETAIL_INTERVAL_S, float(limits.get("detail_interval_s", 0)))
        )
        self._queue = list((config.get("visitbeijing") or {}).get("queue") or [])
        self._client = httpx.Client(
            timeout=35, follow_redirects=True, headers={"User-Agent": BROWSER_UA}
        )

    def close(self) -> None:
        self._client.close()

    # ---------- 搜索（队列匹配，不触网） ----------

    def search(self, keyword: str) -> list[Ref]:
        refs: list[Ref] = []
        for entry in self._queue:
            names = [entry.get("name") or "", *(entry.get("keywords") or [])]
            if keyword and not any(keyword in n or n in keyword for n in names if n):
                continue
            refs.append(
                Ref(
                    source=self.source,
                    id=str(entry["id"]),
                    url=entry["url"],
                    title=entry.get("name") or "",
                )
            )
        return refs

    # ---------- 详情 ----------

    def fetch(self, ref: Ref) -> RawItem:
        self.limiter.wait("detail")
        r = self._client.get(ref.url)
        if r.status_code in (403, 429):
            raise SourceBlocked(f"HTTP {r.status_code}")
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        nodes = soup.select(".infos, .scene_recommends, .scenic-pictures .adress, .map .adress")
        title = soup.select_one(".infos h3.title")
        if not title or not nodes:
            raise ValueError("missing_detail_body")
        # 原始 HTML 是权威存档；正文为逐字 DOM 文本
        text = "\n\n".join(n.get_text("\n", strip=True) for n in nodes)
        urls: list[str] = []
        for n in soup.select(".infos, .scene_recommends, .scenic-pictures"):
            for img in n.select("img[src]"):
                u = img["src"]
                if u.startswith("//"):
                    u = "https:" + u
                if u.startswith("http") and u not in urls:
                    urls.append(u)
        return RawItem(
            source=self.source,
            id=ref.id,
            url=ref.url,
            title=title.get_text(strip=True),
            author_name="北京旅游网",
            author_id="s.visitbeijing.com.cn",
            text=text,
            images=[MediaItem(u) for u in urls],
            raw_extra={"source_html": "source.html", "source_html_bytes": r.content},
        )
