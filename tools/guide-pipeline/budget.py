"""采集预算与保守暂停（INV-001 第五节操作规则收编进核心，原批次脚本私有实现）。

三条机制（语义与 corpus/collection/xhs-chain-1014-2359/collect.py 一致）：
  - 会话预算：当日 search + detail_attempt 请求数达到预算即主动收工（结局 budget_stop），
    预算值 config.json 的 session_budget 可调（默认 25）
  - 3 连空搜索：同一源连续 3 次空搜索结果 → 抛 SourceBlocked 保守暂停（原因未确认，不对抗）
  - 当日 blocked 拒跑：当日事件流中该源已有 blocked 记录 → 拒绝启动（source_paused_for_today）
计量基于事件流（corpus/collection/*/events.jsonl 的当日事件 + 本轮 EventBus 内存历史）。
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Iterable

from sources.base import SourceBlocked

DEFAULT_SESSION_BUDGET = 25  # fresh 窗口耐受约 82 请求，25 留安全余量（INV-001）
EMPTY_SEARCH_PAUSE_THRESHOLD = 3
BUDGET_EVENTS = ("search", "detail_attempt")


class BudgetExceeded(Exception):
    """会话预算到额：主动收工（非风控，次日窗口再跑）。"""


def today() -> str:
    return datetime.now().date().isoformat()


def load_today_events(collection_root: Path) -> list[dict]:
    """扫描 corpus/collection/*/events.jsonl 中的当日事件（跨批次判定 blocked/预算）。"""
    root = Path(collection_root)
    events: list[dict] = []
    if not root.exists():
        return events
    prefix = today()
    for path in sorted(root.glob("*/events.jsonl")):
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue  # 损坏行跳过，不中断判定
            if str(row.get("time", "")).startswith(prefix):
                events.append(row)
    return events


def session_used(events: Iterable[dict], source: str) -> int:
    """预算计量：当日事件中该源 search + detail_attempt 之和。"""
    prefix = today()
    return sum(
        1
        for e in events
        if e.get("source") == source
        and e.get("event") in BUDGET_EVENTS
        and str(e.get("time", "")).startswith(prefix)
    )


def blocked_today(events: Iterable[dict], source: str) -> bool:
    """当日事件流中该源已有 blocked 记录。"""
    prefix = today()
    return any(
        e.get("source") == source
        and e.get("event") == "blocked"
        and str(e.get("time", "")).startswith(prefix)
        for e in events
    )


class SessionBudget:
    """单源会话预算：prior（当日历史批次事件）+ live（本轮 EventBus.history）合并计量。"""

    def __init__(self, limit: int = DEFAULT_SESSION_BUDGET, prior_events=(), live_events=None):
        self.limit = int(limit)
        self._prior = list(prior_events)
        self._live = live_events if live_events is not None else []

    def used(self, source: str) -> int:
        return session_used([*self._prior, *self._live], source)

    def check(self, source: str) -> None:
        if self.used(source) >= self.limit:
            raise BudgetExceeded(f"会话预算到额（{self.limit}），主动收工: {source}")


class EmptySearchStreak:
    """同一源连续空搜索计数：达到阈值抛 SourceBlocked 保守暂停（与批次脚本语义一致）。"""

    def __init__(self, threshold: int = EMPTY_SEARCH_PAUSE_THRESHOLD):
        self.threshold = int(threshold)
        self.count = 0

    def record(self, n_results: int) -> None:
        self.count = self.count + 1 if n_results == 0 else 0
        if self.count >= self.threshold:
            raise SourceBlocked(f"连续 {self.count} 次空搜索，保守暂停（原因未确认）")
