"""媒体下载：图片原图、视频 20MB 阈值判断（Content-Length 预判 + 流式截断双保险）。

合规红线（docs/tech/攻略流水线.md 第六节）：
  - User-Agent 用真实浏览器 UA
  - 媒体下载并发 <= 2（config.json 的 media.concurrency）
  - 失败重试 3 次（config.json 的 media.max_retries）后记录 skipped_reason
视频阈值（默认 20_971_520 字节 = 20MB，2026-10-05 用户确认）：
  - 先读响应头 Content-Length，已知超限直接标记 too_large（不下载，仅留封面与直链）
  - 头缺失则流式下载到阈值即中断，标记 size_unknown_aborted
  - 即使头显示未超限，流式下载仍以阈值为硬上限（双保险）
"""

from __future__ import annotations

import struct
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional

import httpx

from sources.base import BROWSER_UA, DEFAULT_MEDIA_CONCURRENCY, DEFAULT_MEDIA_RETRIES, MediaItem

# 单块读 256KB：阈值截断时损失小、下载速度够用
_CHUNK = 256 * 1024
_TIMEOUT = httpx.Timeout(30.0, connect=15.0)
# 单个视频下载总时长上限（秒）：到点即中断并标记 download_timeout，只留封面与直链。
# 来源：实测微博视频 CDN 可能极慢（~30KB/s），无上限会卡死流水线。
DEFAULT_VIDEO_TIMEOUT_S = 180


def sniff_image_size(path: Path) -> tuple[Optional[int], Optional[int]]:
    """纯 Python 读取 JPEG/PNG/GIF/WebP 宽高（不引 Pillow 依赖），失败返回 (None, None)。"""
    try:
        head = path.open("rb").read(64 * 1024)
    except OSError:
        return None, None
    try:
        if head[:8] == b"\x89PNG\r\n\x1a\n" and len(head) >= 24:
            w, h = struct.unpack(">II", head[16:24])
            return int(w), int(h)
        if head[:6] in (b"GIF87a", b"GIF89a") and len(head) >= 10:
            w, h = struct.unpack("<HH", head[6:10])
            return int(w), int(h)
        if head[:2] == b"\xff\xd8":
            # JPEG：遍历 SOF 段
            i = 2
            while i + 9 < len(head):
                if head[i] != 0xFF:
                    i += 1
                    continue
                marker = head[i + 1]
                if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                    h, w = struct.unpack(">HH", head[i + 5 : i + 9])
                    return int(w), int(h)
                seg_len = struct.unpack(">H", head[i + 2 : i + 4])[0]
                i += 2 + seg_len
        if head[:4] == b"RIFF" and head[8:12] == b"WEBP" and head[12:16] == b"VP8 ":
            w, h = struct.unpack("<HH", head[26:30])
            return int(w) & 0x3FFF, int(h) & 0x3FFF
    except Exception:
        return None, None
    return None, None


class MediaDownloader:
    def __init__(self, referer: str = "", concurrency: int = DEFAULT_MEDIA_CONCURRENCY,
                 max_retries: int = DEFAULT_MEDIA_RETRIES, video_max_bytes: int = 0):
        self.referer = referer
        self.concurrency = max(1, int(concurrency))
        self.max_retries = max(1, int(max_retries))
        self.video_max_bytes = int(video_max_bytes)
        self._client = httpx.Client(headers=self._headers(), timeout=_TIMEOUT, follow_redirects=True)

    def _headers(self) -> dict:
        # 真实浏览器 UA（合规）；Referer 用来源页，降低 CDN 防盗链拒绝率
        h = {"User-Agent": BROWSER_UA, "Accept": "*/*"}
        if self.referer:
            h["Referer"] = self.referer
        return h

    def close(self):
        self._client.close()

    def _get(self, url: str):
        """普通 GET，失败重试 max_retries 次（指数退避）。"""
        last_exc: Optional[Exception] = None
        for attempt in range(1, self.max_retries + 1):
            try:
                return self._client.get(url)
            except httpx.HTTPError as exc:
                last_exc = exc
        raise RuntimeError(f"下载失败（重试 {self.max_retries} 次）: {url}: {last_exc}")

    def download_image(self, url: str, dest_dir: Path, idx: int) -> dict:
        """下载单张图片到 dest_dir/{idx:03d}.<ext>，返回 meta.media.images 条目。"""
        ext = Path(httpx.URL(url).path or "").suffix.lower()
        if ext not in (".jpg", ".jpeg", ".png", ".gif", ".webp"):
            ext = ".jpg"
        dest = dest_dir / f"{idx:03d}{ext}"
        result = {"file": None, "origin_url": url, "width": None, "height": None}
        try:
            resp = self._get(url)
            dest.write_bytes(resp.content)
            w, h = sniff_image_size(dest)
            result.update(file=dest.name, width=w, height=h)
        except Exception as exc:
            result["skipped_reason"] = f"download_failed: {exc}"
            if dest.exists():
                dest.unlink()
        return result

    def download_video(self, item: MediaItem, dest_dir: Path, idx: int) -> dict:
        """下载单个视频（含重试），含 20MB 双保险阈值 + 总时长上限。返回 meta.media.videos 条目。"""
        result = {
            "file": None,
            "origin_url": item.origin_url,
            "cover": item.cover,
            "duration_s": item.duration_s,
            "size_bytes": None,
            "skipped_reason": None,
        }
        dest = dest_dir / f"{idx:03d}.mp4"
        for attempt in range(1, self.max_retries + 1):
            if dest.exists():
                dest.unlink()
            try:
                with self._client.stream("GET", item.origin_url) as resp:
                    declared = resp.headers.get("Content-Length")
                    declared_len = int(declared) if declared and declared.isdigit() else None
                    # 第一重保险：响应头已知超限 → 直接跳过（终态，不重试）
                    if declared_len is not None and declared_len > self.video_max_bytes:
                        result["size_bytes"] = declared_len
                        result["skipped_reason"] = "too_large"
                        return result
                    # 第二重保险：流式下载，累计超限立即中断（覆盖头缺失/不可信的情况）
                    written = 0
                    aborted = False
                    deadline = time.monotonic() + DEFAULT_VIDEO_TIMEOUT_S
                    with dest.open("wb") as fh:
                        for chunk in resp.iter_bytes(_CHUNK):
                            if time.monotonic() > deadline:
                                result["size_bytes"] = written
                                result["skipped_reason"] = "download_timeout"
                                aborted = True
                                break
                            written += len(chunk)
                            if written > self.video_max_bytes:
                                fh.write(chunk[: self.video_max_bytes - (written - len(chunk))])
                                result["size_bytes"] = written
                                result["skipped_reason"] = "size_unknown_aborted"
                                aborted = True
                                break
                            fh.write(chunk)
                    if not aborted:
                        result["file"] = dest.name
                        result["size_bytes"] = written
                        return result
                    return result  # 阈值截断/超时是终态，不重试
            except httpx.HTTPError:
                if attempt >= self.max_retries:
                    result["skipped_reason"] = "download_failed"
        if dest.exists():
            dest.unlink()
        return result

    def download_all(self, images: list[MediaItem], videos: list[MediaItem], item_dir: Path) -> tuple[list, list]:
        """并发下载（<= concurrency）一个条目的全部媒体；目录仅在确实有文件时创建。"""
        image_results: list[dict] = []
        video_results: list[dict] = []
        if images:
            images_dir = item_dir / "images"
            images_dir.mkdir(parents=True, exist_ok=True)
            with ThreadPoolExecutor(max_workers=self.concurrency) as pool:
                image_results = list(pool.map(
                    lambda t: self.download_image(t[1].origin_url, images_dir, t[0]),
                    enumerate(images, start=1),
                ))
        if videos:
            videos_dir = item_dir / "videos"
            videos_dir.mkdir(parents=True, exist_ok=True)
            for i, item in enumerate(videos, start=1):
                video_results.append(self.download_video(item, videos_dir, i))
        return image_results, video_results
