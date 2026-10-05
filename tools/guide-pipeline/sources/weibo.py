"""微博移动版 m.weibo.cn 采集（P1，免登录）。

策略（docs/tech/攻略流水线.md 第四节）：
  - Playwright 打开 m.weibo.cn/search?containerid=100103type=1&q=<关键词>
  - 滚动加载，从页面内 $render_data / XHR 响应提取 mblog 卡片列表
    （mblogid、正文、作者、时间、图、视频时长/播放量、赞/评/转发）
  - 进详情取全文（statuses/show 接口，长文自动展开）与原图（large 尺寸）
  - 免登录；出现风控页（验证码/登录强制）抛 SourceBlocked，由 pipeline 退避处理
限速：搜索间隔 >= 5s、详情间隔 >= 3s（通用默认值，config.json 可调）
"""

from __future__ import annotations

import json
import re
import time
from urllib.parse import quote

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

from .base import (
    BROWSER_UA,
    MediaItem,
    RateLimiter,
    RawItem,
    Ref,
    SourceAdapter,
    SourceBlocked,
    html_to_text,
    parse_weibo_created_at,
)

SEARCH_CONTAINER = "100103type=1&q={keyword}"
# 详情全文接口：m.weibo.cn 页面内自带使用，浏览器上下文（含 visitor cookie）直接可调
SHOW_API = "https://m.weibo.cn/statuses/show?id={mblogid}"
# 出现风控/登录强制时建议的退避时长（秒），见 pipeline.py 的处理
BLOCK_BACKOFF_S = 1800


def _plain_title(text: str) -> str:
    flat = re.sub(r"\s+", " ", text or "").strip()
    return flat[:30]


def _mblog_from_card(card: dict) -> dict | None:
    if card.get("card_type") == 9 and card.get("mblog"):
        return card["mblog"]
    # card_type 11 是分组卡（如「热门」组），内嵌 card_group
    if card.get("card_type") == 11:
        for sub in card.get("card_group") or []:
            mblog = _mblog_from_card(sub)
            if mblog:
                return mblog
    return None


def _parse_duration(value) -> float | None:
    """media_info.duration 可能是秒数或 'MM:SS'。"""
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        pass
    m = re.match(r"^(\d+):(\d{1,2})$", str(value).strip())
    if m:
        return int(m.group(1)) * 60 + int(m.group(2))
    return None


class WeiboAdapter(SourceAdapter):
    source = "weibo"
    referer = "https://m.weibo.cn/"

    def __init__(self, config: dict, headless: bool = True):
        super().__init__(config)
        limits = config.get("rate_limits", {}).get("default", {})
        self.limiter = RateLimiter(
            limits.get("search_interval_s", 5), limits.get("detail_interval_s", 3)
        )
        self._pw = sync_playwright().start()
        self.browser: Browser = self._pw.chromium.launch(headless=headless)
        self.context: BrowserContext = self.browser.new_context(
            user_agent=BROWSER_UA,
            viewport={"width": 414, "height": 896},  # 移动版页面按手机视口渲染
            locale="zh-CN",
        )
        self.page: Page = self.context.new_page()

    def close(self):
        try:
            self.context.close()
            self.browser.close()
        finally:
            self._pw.stop()

    # ---------- 搜索 ----------

    def _collect_cards(self, keyword: str) -> list[dict]:
        """打开搜索页并滚动，收集 XHR / $render_data 中的 mblog 列表。

        首访可能被 Sina Visitor System 接管（页面里 $render_data = [null][0]），
        真实卡片走 api/container/getIndex 的 XHR；最多重试 3 次直到抓到 XHR。
        """
        container = quote(SEARCH_CONTAINER.format(keyword=keyword), safe="")
        url = f"https://m.weibo.cn/search?containerid={container}"
        xhr_payloads: list[dict] = []

        def on_response(response):
            try:
                if "api/container/getIndex" in response.url and "100103" in response.url:
                    xhr_payloads.append(response.json())
            except Exception:
                pass

        self.page.on("response", on_response)
        html = ""
        try:
            for _attempt in range(3):
                xhr_payloads.clear()
                self.page.goto(url, wait_until="domcontentloaded", timeout=30_000)
                try:
                    self.page.wait_for_selector(".card, .card-wrap", timeout=10_000)
                except Exception:
                    pass
                self.page.wait_for_timeout(2_000)
                # 滚动 2 轮加载更多（每轮等待 XHR 返回）
                for _ in range(2):
                    self.page.mouse.wheel(0, 2_000)
                    self.page.wait_for_timeout(2_500)
                html = self.page.content()
                if xhr_payloads:
                    break
        finally:
            self.page.remove_listener("response", on_response)

        mblogs: dict[str, dict] = {}
        # 优先 XHR 响应（结构化 JSON 最全）；$render_data 作兜底（可能为 [null]，逐段容错解析）
        for payload in xhr_payloads:
            for card in (payload.get("data") or {}).get("cards") or []:
                mblog = _mblog_from_card(card)
                key = str((mblog or {}).get("mblogid") or (mblog or {}).get("bid") or (mblog or {}).get("id") or "")
                if mblog and key:
                    mblogs.setdefault(key, mblog)
        if not mblogs and html:
            for match in re.finditer(r"var \$render_data = (\[.*?\])\[0\]", html, re.DOTALL):
                try:
                    entries = json.loads(match.group(1))
                except json.JSONDecodeError:
                    continue
                for entry in entries if isinstance(entries, list) else [entries]:
                    if not isinstance(entry, dict):
                        continue
                    for card in (entry.get("data") or {}).get("cards") or []:
                        mblog = _mblog_from_card(card)
                        key = str((mblog or {}).get("mblogid") or (mblog or {}).get("bid") or (mblog or {}).get("id") or "")
                        if mblog and key:
                            mblogs.setdefault(key, mblog)
                if mblogs:
                    break
        # 3 次尝试仍无任何卡片 XHR 且页面疑似风控/登录强制 → 按风控处理（保守侧）
        if not mblogs and self._looks_blocked(html):
            raise SourceBlocked(f"微博搜索页触发风控/登录强制: {keyword}")
        return list(mblogs.values())

    @staticmethod
    def _looks_blocked(html: str) -> bool:
        if not html:
            return True
        return ("登录" in html[:2000] and "$render_data" not in html) or "验证" in html[:2000]

    def search(self, keyword: str) -> list[Ref]:
        self.limiter.wait("search")
        refs: list[Ref] = []
        for mblog in self._collect_cards(keyword):
            # 2026-10 实测：搜索 XHR 的 mblog 不含 mblogid 字段，原生 ID 取 bid（base62，
            # 详情页与 weibo.com 永久链接同款），兜底数字 id
            mblogid = str(mblog.get("mblogid") or mblog.get("bid") or mblog.get("id") or "")
            if not mblogid:
                continue
            user = mblog.get("user") or {}
            text = html_to_text(mblog.get("text") or "")
            refs.append(
                Ref(
                    source=self.source,
                    id=mblogid,
                    url=f"https://weibo.com/{user.get('id', '')}/{mblogid}",
                    title=_plain_title(text),
                    author_name=user.get("screen_name") or "",
                    author_id=str(user.get("id") or ""),
                    published_at=parse_weibo_created_at(mblog.get("created_at")),
                )
            )
        return refs

    # ---------- 详情 ----------

    def _show(self, mblogid: str) -> dict:
        """statuses/show 接口取全文（长文已展开）与原图列表，共享浏览器 cookie。"""
        resp = self.context.request.get(
            SHOW_API.format(mblogid=mblogid),
            headers={"Referer": f"https://m.weibo.cn/detail/{mblogid}"},
        )
        if resp.status != 200:
            raise RuntimeError(f"statuses/show 返回 {resp.status}: {mblogid}")
        payload = resp.json()
        if not payload.get("ok"):
            raise SourceBlocked(f"微博详情接口拒绝（可能触发风控）: {mblogid}")
        return payload.get("data") or {}

    def fetch(self, ref: Ref) -> RawItem:
        self.limiter.wait("detail")
        data = self._show(ref.id)
        user = data.get("user") or {}
        # 长文：优先 longText，其次 text
        long_text = (data.get("longText") or {}).get("longTextContent")
        html = long_text or data.get("text") or ""
        text = html_to_text(html)

        images: list[MediaItem] = []
        for pic in data.get("pics") or []:
            origin = (pic.get("large") or {}).get("url") or pic.get("url")
            if origin:
                images.append(MediaItem(origin_url=origin))

        videos: list[MediaItem] = []
        page_info = data.get("page_info") or {}
        if page_info.get("type") == "video":
            media_info = page_info.get("media_info") or {}
            stream = media_info.get("stream_url_hd") or media_info.get("stream_url")
            cover = media_info.get("cover_img") or page_info.get("page_pic")
            if isinstance(cover, dict):  # 2026-10 实测 cover_img 是 {url, width, ...} 对象
                cover = cover.get("url")
            if stream:
                videos.append(
                    MediaItem(
                        origin_url=stream,
                        cover=cover,
                        duration_s=_parse_duration(media_info.get("duration")),
                    )
                )

        return RawItem(
            source=self.source,
            id=ref.id,
            url=ref.url,
            title=_plain_title(text) or ref.title,
            author_name=user.get("screen_name") or ref.author_name,
            author_id=str(user.get("id") or ref.author_id),
            text=text,
            published_at=parse_weibo_created_at(data.get("created_at")) or ref.published_at,
            stats={
                "likes": data.get("attitudes_count"),
                "collects": data.get("favorites_count"),  # 实测字段存在（2026-10）
                "comments": data.get("comments_count"),
                "plays": (page_info.get("media_info") or {}).get("online_users_number"),
            },
            images=images,
            videos=videos,
            raw_extra={
                "reposts": data.get("reposts_count"),
                "region_name": data.get("region_name"),
                "source_label": html_to_text(data.get("source") or ""),
            },
        )
