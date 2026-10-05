"""小红书 www.xiaohongshu.com 采集（P0 源，需扫码登录，限速最保守）。

策略（docs/tech/攻略流水线.md 第四节）：
  - 首次运行 `python pipeline.py --source xhs --login`：有头浏览器打开小红书，
    等待用户扫码后保存 storage_state 到 .cookies/xhs.json（gitignore）
  - 之后复用 storage_state；驱动真实浏览器，页面自身 JS 处理搜索接口签名（不逆向）
  - 触发登录墙/滑块验证 → 抛 XhsBlocked 停采该源并提示人工处理，不自动对抗
限速（小红书专用覆盖值，通用值的更保守侧）：搜索间隔 >= 8s、详情间隔 >= 5s
注意：不要在未登录/无人值守时运行采集（账号风控风险）。
"""

from __future__ import annotations

import json
import re
import time
from pathlib import Path
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
)

COOKIE_DIR = Path(__file__).resolve().parent.parent / ".cookies"
COOKIE_PATH = COOKIE_DIR / "xhs.json"
LOGIN_URL = "https://www.xiaohongshu.com"
SEARCH_URL = "https://www.xiaohongshu.com/search_result?keyword={keyword}&source=web_explore_feed"
NOTE_URL = "https://www.xiaohongshu.com/explore/{note_id}"
LOGIN_WAIT_S = 180  # 扫码等待上限


class XhsBlocked(SourceBlocked):
    """小红书登录墙/滑块/验证触发：停采该源，提示人工处理。"""


def _looks_blocked(page: Page) -> bool:
    """登录墙（重定向到 /login 或出现登录弹窗）与滑块验证的特征检测。"""
    if "/login" in page.url:
        return True
    selectors = [
        ".login-container",          # 登录弹窗
        ".geetest_panel",            # 滑块验证
        ".captcha-container",
        "#verify-bar-close",
    ]
    for sel in selectors:
        try:
            if page.locator(sel).first.is_visible(timeout=500):
                return True
        except Exception:
            continue
    return False


def login(cookie_path: Path = COOKIE_PATH) -> None:
    """--login：有头浏览器扫码登录并保存 storage_state。"""
    cookie_path.parent.mkdir(parents=True, exist_ok=True)
    pw = sync_playwright().start()
    browser = pw.chromium.launch(headless=False)  # 扫码必须有头
    context = browser.new_context(user_agent=BROWSER_UA, viewport={"width": 1280, "height": 900},
                                  locale="zh-CN")
    page = context.new_page()
    page.goto(LOGIN_URL, wait_until="domcontentloaded", timeout=30_000)
    print("请在打开的浏览器窗口中扫码登录小红书（180 秒内完成）…")
    deadline = time.monotonic() + LOGIN_WAIT_S
    logged_in = False
    while time.monotonic() < deadline:
        page.wait_for_timeout(5_000)
        try:
            # 登录成功标志：首页出现用户头像入口
            if page.locator(".user .avatar, .avatar-container, [class*='avatar']").first.is_visible(timeout=1_000):
                logged_in = True
                break
        except Exception:
            continue
    context.storage_state(path=str(cookie_path))
    browser.close()
    pw.stop()
    if logged_in:
        print(f"登录成功，cookie 已保存: {cookie_path}")
    else:
        print(f"等待超时，已尽力保存当前会话状态: {cookie_path}（若未登录请重试 --login）")


_LIST_JS = r"""
() => {
  const items = [];
  const seen = new Set();
  for (const a of document.querySelectorAll('a[href*="/search_result/"], a[href*="/explore/"]')) {
    // 卡片里有两种锚点：裸 /explore/<id>（display:none，无 token，打开必 404）
    // 和 /search_result/<id>?xsec_token=...（真实可用）；只收带 token 的
    if (!a.href.includes('xsec_token=')) continue;
    const m = a.href.match(/\/(?:search_result|explore)\/([0-9a-f]{24})/);
    if (!m) continue;
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    const card = a.closest('section, div');
    const title = card ? (card.querySelector('.title, [class*="title"]') || {}).textContent || '' : '';
    const author = card ? (card.querySelector('.author .name, [class*="name"]') || {}).textContent || '' : '';
    const likes = card ? (card.querySelector('.count, [class*="like"] .count') || {}).textContent || '' : '';
    // 保留完整 href：详情页必须带 xsec_token，否则 404（error_code=300031）
    items.push({id, url: a.href, title: title.trim(), author: author.trim(), likes: likes.trim()});
    if (items.length >= 30) break;
  }
  return items;
}
"""

# 详情：优先页面内 __INITIAL_STATE__（标题/正文/作者/互动数/图集齐全），DOM 作兜底
_DETAIL_STATE_JS = r"""
(noteId) => {
  const state = window.__INITIAL_STATE__;
  const map = state && state.note && state.note.noteDetailMap;
  const detail = map && (map[noteId] || map[Object.keys(map)[0]]);
  if (!detail || !detail.note) return null;
  const n = detail.note;
  return {
    title: n.title || '',
    desc: n.desc || '',
    author: n.user ? n.user.nickname : '',
    author_id: n.user ? n.user.userId : '',
    time: n.time || n.lastUpdateTime || '',
    likes: n.interactInfo ? n.interactInfo.likedCount : null,
    collects: n.interactInfo ? n.interactInfo.collectedCount : null,
    comments: n.interactInfo ? n.interactInfo.commentCount : null,
    plays: n.interactInfo ? n.interactInfo.shareCount : null,
    images: (n.imageList || []).map(i => i.urlDefault || i.url || ''),
    video: n.video ? (n.video.url || (n.video.stream || {}).h264 || '') : '',
    cover: n.video ? n.video.cover : '',
    duration: n.video ? n.video.duration : null,
  };
}
"""


class XhsAdapter(SourceAdapter):
    source = "xhs"
    referer = "https://www.xiaohongshu.com/"

    def __init__(self, config: dict, headless: bool = True):
        super().__init__(config)
        if not COOKIE_PATH.exists():
            raise XhsBlocked(f"未找到登录凭据 {COOKIE_PATH}，请先运行: python pipeline.py --source xhs --login")
        limits = config.get("rate_limits", {}).get("xhs", {})
        self.limiter = RateLimiter(
            limits.get("search_interval_s", 8), limits.get("detail_interval_s", 5)
        )
        self._pw = sync_playwright().start()
        self.browser: Browser = self._pw.chromium.launch(headless=headless)
        self.context: BrowserContext = self.browser.new_context(
            user_agent=BROWSER_UA,
            viewport={"width": 1280, "height": 900},
            locale="zh-CN",
            storage_state=str(COOKIE_PATH),
        )
        self.page: Page = self.context.new_page()

    def close(self):
        try:
            self.context.close()
            self.browser.close()
        finally:
            self._pw.stop()

    def search(self, keyword: str) -> list[Ref]:
        self.limiter.wait("search")
        self.page.goto(SEARCH_URL.format(keyword=quote(keyword)), wait_until="domcontentloaded",
                       timeout=30_000)
        self.page.wait_for_timeout(3_000)
        if _looks_blocked(self.page):
            raise XhsBlocked("小红书搜索触发登录墙/验证，请人工处理后重试")
        for _ in range(2):  # 滚动加载更多卡片
            self.page.mouse.wheel(0, 2_000)
            self.page.wait_for_timeout(2_500)
        refs: list[Ref] = []
        for it in self.page.evaluate(_LIST_JS):
            refs.append(
                Ref(
                    source=self.source,
                    id=it["id"],
                    url=it.get("url") or NOTE_URL.format(note_id=it["id"]),
                    title=it.get("title") or "",
                    author_name=it.get("author") or "",
                    author_id="",
                )
            )
        return refs

    def fetch(self, ref: Ref) -> RawItem:
        self.limiter.wait("detail")
        self.page.goto(ref.url, wait_until="domcontentloaded", timeout=30_000)
        self.page.wait_for_timeout(2_500)
        if _looks_blocked(self.page):
            raise XhsBlocked(f"小红书详情触发登录墙/验证: {ref.url}")
        if "/404" in self.page.url:
            # 笔记被删/不可见（缺 xsec_token 或已下架）：跳过本条，不算风控
            raise ValueError(f"笔记不可浏览(404): {ref.url}")

        data = self.page.evaluate(_DETAIL_STATE_JS, ref.id)
        if not data:  # DOM 兜底（页面结构漂移时尽量保住正文）
            data = {
                "title": self.page.locator(".title").first.text_content() or "",
                "desc": self.page.locator(".desc .note-text").first.text_content() or "",
                "author": (self.page.locator(".author-container .username").first.text_content() or "").strip(),
                "author_id": "",
                "time": "",
                "likes": None, "collects": None, "comments": None, "plays": None,
                "images": [img.get_attribute("src") for img in self.page.locator(".swiper-slide img").all()],
                "video": "", "cover": "", "duration": None,
            }
        images = [MediaItem(origin_url=u) for u in (data.get("images") or []) if u]
        videos = []
        if data.get("video"):
            videos.append(MediaItem(
                origin_url=data["video"],
                cover=data.get("cover") or None,
                duration_s=data.get("duration"),
            ))
        return RawItem(
            source=self.source,
            id=ref.id,
            url=ref.url,
            title=data.get("title") or "",
            author_name=data.get("author") or ref.author_name,
            author_id=str(data.get("author_id") or ref.author_name or ""),
            text=data.get("desc") or "",
            published_at=None,
            stats={
                "likes": _to_int(data.get("likes")),
                "collects": _to_int(data.get("collects")),
                "comments": _to_int(data.get("comments")),
                "plays": None,
            },
            images=images,
            videos=videos,
            raw_extra={"xhs_time": data.get("time") or ""},
        )


def _to_int(value):
    """'1.2万' / '1234' → int，失败 None。"""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return int(value)
    m = re.match(r"^([\d.]+)万?$", str(value).strip())
    if not m:
        return None
    num = float(m.group(1))
    return int(num * 10_000) if "万" in str(value) else int(num)
