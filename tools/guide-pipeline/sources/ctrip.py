"""携程游记 you.ctrip.com 采集（P1，存量采集，免登录）。

策略（docs/tech/攻略流水线.md 第四节）：
  - 列表页 you.ctrip.com/travels/<目的地>/t3-p<n>.html 提取游记（标题/链接/作者/天数）
    （t3 = 按最新排序；whaleguard 拦裸 HTTP，一律走 Playwright 真实浏览器）
  - 详情页 DOM 提取正文段落、图片、结构化信息栏
    （出发时间/天数/人均/和谁出行 → raw_extra，原样塞入不做标准化）
  - 注意：游记业务 2025-11-30 停运公告，一次性采完存量即可，不做周期任务
限速：搜索（列表页）间隔 >= 5s、详情间隔 >= 3s（通用默认值）
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

from .base import BROWSER_UA, MediaItem, RateLimiter, RawItem, Ref, SourceAdapter, SourceBlocked

# 目的地中文名 → ctrip 目的地代码（游记 URL 段）。仅北京周边需求，先内置最小映射；
# 未命中时代码回退：直接拿关键词当 URL 段（适合 "beijing1" 这种已带编码的写法）。
_DEST_CODE = {"北京": "beijing1"}

_LIST_JS = r"""
() => {
  // 2026-10 实测卡片结构：<a href=".../NNNN.html"><h2>标题</h2>…<span>作者发表于 日期</span>
  const items = [];
  const seen = new Set();
  for (const a of document.querySelectorAll('a[href*="/travels/"]')) {
    const m = a.href.match(/\/travels\/[^/]+\/(\d+)\.html/);
    if (!m) continue;
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    const h2 = a.querySelector('h2');
    const title = h2 ? h2.textContent.trim() : '';
    if (title.length < 4) continue;  // 过滤导航/广告短链
    let author = '';
    const span = [...a.querySelectorAll('span')].find(s => s.textContent.includes('发表于'));
    if (span) author = span.textContent.split('发表于')[0].trim();
    items.push({id, title, url: a.href.split('?')[0], author});
    if (items.length >= 30) break;   // 一页足够（MVP 每关键词采量 <= 组限额）
  }
  return items;
}
"""

_DETAIL_JS = r"""
() => {
  // 2026-10 实测（游记业务 Next.js 重构后 DOM，2025-11-30 停运前版本）：
  //   标题 h1；信息栏 .arrangement .box（p.top 标签 / p.bottom 值）；
  //   正文按序 h5.menu（小节标题）+ div.content（段落 p）；图片在 div.content img。
  const title = (document.querySelector('h1') || {}).textContent || '';

  // 信息栏：标签→值 原样返回（字段映射在 Python 侧做）
  const boxes = {};
  document.querySelectorAll('.arrangement .box').forEach(box => {
    const label = ((box.querySelector('.top') || {}).textContent || '').trim();
    const value = ((box.querySelector('.bottom') || {}).textContent || '').trim();
    if (label && value) boxes[label] = value;
  });

  // 正文块按文档顺序（小节标题与段落）
  const blocks = [];
  document.querySelectorAll('h5.menu, div.content').forEach(el => {
    if (el.tagName === 'H5') {
      const t = (el.textContent || '').trim();
      if (t) blocks.push({type: 'h', text: t});
    } else {
      el.querySelectorAll('p').forEach(p => {
        const t = (p.textContent || '').replace(/\s+/g, ' ').trim();
        if (t) blocks.push({type: 'p', text: t});
      });
    }
  });

  // 图片：CDN 缩放 URL 升级回原图（去 _W_x_y_Qz 尺寸后缀与 proc 参数），失败保留原样
  const images = [];
  const seen = new Set();
  document.querySelectorAll('div.content img').forEach(img => {
    let src = img.getAttribute('data-src') || img.getAttribute('src') || '';
    if (!src || src.startsWith('data:')) return;
    const m = src.match(/^(https?:\/\/[^/]+\/images\/[^_]+)_W_\d+_\d+_Q\d+(\.\w+)(?:\?.*)?$/);
    if (m) src = m[1] + m[2];
    if (seen.has(src)) return;
    seen.add(src);
    images.push(src);
  });
  return {title, boxes, blocks, images};
}
"""

# 详情页正文之外的结构化数据（作者/发布时间/互动数）只存在于 Next.js flight JSON 字符串里，
# DOM 不渲染作者 → 从原始 HTML 正则提取（JSON 转义形态，2026-10 实测）
_RE_FLIGHT = {
    "nickname": re.compile(r'\\"Nickname\\":\\"(.*?)\\"'),
    "member": re.compile(r'\\"UserUrl\\":\\"http://you\.ctrip\.com/members/([^"\\]+)\\"'),
    "publish": re.compile(r'\\"PublishTime\\":\\"/Date\((\d+)([+-]\d{4})\)/\\"'),
    "counts": re.compile(
        r'\\"VisitCount\\":(\d+),\\"ReplyCount\\":(\d+),\\"LikeCount\\":(\d+),\\"CollectionCount\\":(\d+)'
    ),
}

_INFO_LABELS = {
    "出发时间": "depart_time",
    "出行天数": "days",
    "行程天数": "days",
    "人均费用": "cost",
    "人均花费": "cost",
    "人均": "cost",
    "和谁出行": "companion",
    "玩法": "play_styles",
}


def _flight(html: str) -> dict:
    out = {}
    m = _RE_FLIGHT["nickname"].search(html)
    out["nickname"] = m.group(1) if m else ""
    m = _RE_FLIGHT["member"].search(html)
    out["member_id"] = m.group(1) if m else ""
    m = _RE_FLIGHT["publish"].search(html)
    if m:
        ms, off = int(m.group(1)), m.group(2)
        sign, hh, mm_ = off[0], int(off[1:3]), int(off[3:])
        delta = (1 if sign == "+" else -1) * (hh * 60 + mm_)
        out["published_at"] = (
            datetime.fromtimestamp(ms / 1000, tz=timezone(timedelta(minutes=delta)))
            .isoformat(timespec="seconds")
        )
    else:
        out["published_at"] = None
    m = _RE_FLIGHT["counts"].search(html)
    if m:
        visit, reply, like, collect = (int(x) for x in m.groups())
        out["stats"] = {"likes": like, "collects": collect, "comments": reply, "plays": visit}
    else:
        out["stats"] = {"likes": None, "collects": None, "comments": None, "plays": None}
    return out


class CtripAdapter(SourceAdapter):
    source = "ctrip"
    referer = "https://you.ctrip.com/"

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
            viewport={"width": 1280, "height": 900},
            locale="zh-CN",
        )
        self.page: Page = self.context.new_page()
        # 2026-10 实测：冷启动直接访问 you.ctrip.com 必中鲸鱼验证；先访问 www.ctrip.com
        # 首页拿基础 cookie 即可放行（真实页面浏览行为，非验证码对抗）
        self.page.goto("https://www.ctrip.com", wait_until="domcontentloaded", timeout=30_000)
        self.page.wait_for_timeout(2_000)

    def close(self):
        try:
            self.context.close()
            self.browser.close()
        finally:
            self._pw.stop()

    @staticmethod
    def _dest_url(keyword: str) -> str:
        code = _DEST_CODE.get(keyword, keyword)
        return f"https://you.ctrip.com/travels/{code}/t3-p1.html"

    def search(self, keyword: str) -> list[Ref]:
        self.limiter.wait("search")
        url = self._dest_url(keyword)
        self.page.goto(url, wait_until="domcontentloaded", timeout=30_000)
        self.page.wait_for_timeout(3_000)
        self._raise_if_verifying()
        # whaleguard 拦截页特征：无游记锚点
        items = self.page.evaluate(_LIST_JS)
        refs: list[Ref] = []
        for it in items:
            author = it.get("author") or ""
            refs.append(
                Ref(
                    source=self.source,
                    id=str(it["id"]),
                    url=it["url"],
                    title=it.get("title") or "",
                    author_name=author,
                    author_id="",  # 携程作者无公开数字 ID，详情页也补不到 → 用昵称兜底
                )
            )
        return refs

    def _raise_if_verifying(self) -> None:
        """鲸鱼验证（人工点选/滑块）检测：不自动对抗（合规红线），直接停采提示人工处理。"""
        if "verify.ctrip.com" in self.page.url or "验证" in (self.page.title() or ""):
            raise SourceBlocked(
                "携程触发鲸鱼验证（点选/滑块）。请在日常浏览器中手动通过一次验证后再试；"
                "自动对抗验证码违反合规红线，已停止该源。"
            )

    def fetch(self, ref: Ref) -> RawItem:
        self.limiter.wait("detail")
        self.page.goto(ref.url, wait_until="domcontentloaded", timeout=30_000)
        self.page.wait_for_timeout(2_500)
        self._raise_if_verifying()
        data = self.page.evaluate(_DETAIL_JS)
        html = self.page.content()
        flight = _flight(html)  # 作者/发布时间/互动数只在 flight JSON 里，DOM 不渲染

        title = (data.get("title") or ref.title or "").strip()
        author_name = flight.get("nickname") or ref.author_name
        author_id = flight.get("member_id") or author_name
        # raw_extra：信息栏原样映射 + 行标签保留（不做标准化，docs/tech/攻略流水线.md 第三节）
        boxes = data.get("boxes") or {}
        extra = {_INFO_LABELS.get(k, k): v for k, v in boxes.items()}
        # 正文按原文顺序：小节标题与段落各占一行（text.md 保留换行）
        text = "\n\n".join(b["text"] for b in (data.get("blocks") or []))

        images = [MediaItem(origin_url=u) for u in (data.get("images") or [])]

        return RawItem(
            source=self.source,
            id=ref.id,
            url=ref.url,
            title=title,
            author_name=author_name,
            author_id=author_id,
            text=text,
            published_at=flight.get("published_at"),
            stats=flight["stats"],
            images=images,
            videos=[],
            raw_extra=extra,
        )
