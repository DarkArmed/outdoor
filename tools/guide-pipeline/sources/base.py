"""公共抽象与工具：数据结构、限速器、HTML 正文清洗。

限速参数默认值来源：docs/tech/攻略流水线.md 第四节（2026-10-05 用户确认）：
  - 通用：搜索请求间隔 >= 5s、详情页间隔 >= 3s、单源每日上限 200 条
  - 小红书（P0 源）覆盖为更保守值：搜索 >= 8s、详情 >= 5s
  - 媒体下载并发 <= 2、失败重试 3 次
以上均可在 config.json 调整；实现中一律取下限更保守（更慢）的值。
"""

from __future__ import annotations

import abc
import random
import re
import time
from dataclasses import dataclass, field
from datetime import datetime
from html.parser import HTMLParser
from typing import Optional

# 合规红线：使用真实桌面浏览器 UA，不伪造移动端 API 客户端。
# 与 Playwright Chromium 版本无关的固定桌面 UA（Windows Chrome）。
BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
)

DEFAULT_SEARCH_INTERVAL_S = 5.0
DEFAULT_DETAIL_INTERVAL_S = 3.0
DEFAULT_DAILY_CAP = 200
DEFAULT_MEDIA_CONCURRENCY = 2
DEFAULT_MEDIA_RETRIES = 3
# 视频阈值 20MB（20_971_520 字节，2026-10-05 用户确认，config.json 可调）
DEFAULT_VIDEO_MAX_BYTES = 20_971_520
# 目的地组默认每篇上限（2026-10-05 用户确认）
DEFAULT_GROUP_CAP = 5


def now_iso() -> str:
    """采集时间 ISO（本地时区带偏移）。"""
    return datetime.now().astimezone().isoformat(timespec="seconds")


@dataclass
class Ref:
    """搜索结果引用：最小元数据，正文/媒体靠 fetch() 补全。"""

    source: str
    id: str
    url: str
    title: str = ""
    author_name: str = ""
    author_id: str = ""
    published_at: Optional[str] = None


@dataclass
class MediaItem:
    """待下载的媒体引用（fetch 阶段产出，未落盘）。"""

    origin_url: str
    cover: Optional[str] = None  # 视频封面图
    duration_s: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None


@dataclass
class RawItem:
    """fetch() 产出的原始条目，交给 store 落盘。"""

    source: str
    id: str
    url: str
    title: str
    author_name: str
    author_id: str
    text: str = ""
    published_at: Optional[str] = None
    stats: dict = field(default_factory=dict)  # {likes, collects, comments, plays}，缺项 null
    images: list[MediaItem] = field(default_factory=list)
    videos: list[MediaItem] = field(default_factory=list)
    raw_extra: dict = field(default_factory=dict)


class RateLimiter:
    """每源独立限速：保证两次同类请求实际间隔 >= 设定值。

    附加 <=10% 随机抖动，避免请求节奏呈现机械固定间隔。
    """

    def __init__(
        self,
        search_interval_s: float = DEFAULT_SEARCH_INTERVAL_S,
        detail_interval_s: float = DEFAULT_DETAIL_INTERVAL_S,
    ):
        self.search_interval_s = float(search_interval_s)
        self.detail_interval_s = float(detail_interval_s)
        self._last: dict[str, float] = {}

    def wait(self, kind: str) -> None:
        interval = self.search_interval_s if kind == "search" else self.detail_interval_s
        last = self._last.get(kind, 0.0)
        need = interval + interval * random.uniform(0.0, 0.1) - (time.monotonic() - last)
        if need > 0:
            time.sleep(need)
        self._last[kind] = time.monotonic()


class SourceAdapter(abc.ABC):
    """采集源抽象：search(keyword) -> [Ref]；fetch(ref) -> RawItem。"""

    source: str = ""
    referer: str = ""

    def __init__(self, config: dict):
        self.config = config

    @abc.abstractmethod
    def search(self, keyword: str) -> list[Ref]: ...

    @abc.abstractmethod
    def fetch(self, ref: Ref) -> RawItem: ...

    def close(self) -> None:
        pass


class SourceBlocked(Exception):
    """源触发风控/验证码/登录强制：停采该源并提示人工处理，不自动对抗（合规红线）。"""


class _TextExtractor(HTMLParser):
    """微博/携程正文 HTML → 纯文本：保留换行，表情取 <img alt>，话题/链接保留内文。"""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag == "br":
            self.parts.append("\n")
        elif tag == "img":
            alt = dict(attrs).get("alt")
            if alt:
                self.parts.append(alt)

    def handle_endtag(self, tag):
        if tag in ("p", "div", "li", "h1", "h2", "h3", "section"):
            self.parts.append("\n")

    def handle_data(self, data):
        self.parts.append(data)


def html_to_text(html: str) -> str:
    """正文 HTML 清洗为纯文本（保留换行；表情/话题标记原样保留）。"""
    parser = _TextExtractor()
    parser.feed(html or "")
    lines = [re.sub(r"[ \t　]+", " ", ln).strip() for ln in "".join(parser.parts).splitlines()]
    return "\n".join(ln for ln in lines if ln)


def parse_weibo_created_at(created_at: Optional[str]) -> Optional[str]:
    """微博 created_at（如 'Mon Oct 05 12:34:56 +0800 2026'）→ ISO，失败返回 None。"""
    if not created_at:
        return None
    for fmt in ("%a %b %d %H:%M:%S %z %Y", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(created_at, fmt).isoformat(timespec="seconds")
        except ValueError:
            continue
    return None
