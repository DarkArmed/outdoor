"""collect 阶段：调 guide-pipeline 引擎采集语料，事件双写（events.jsonl + DB）。

INV-001 操作规则在本阶段的落点：
  - 会话预算：DB 账本（PipelineEvent 24h 滑动窗口求和，ADR-008 决策 5）为准计量，
    只把剩余额度（session_budget − 窗口内已用）交给引擎；引擎按自然日计量作兜底
  - 当日 blocked 拒跑：DB 台账 24h 内该源已有 blocked 记录 → 不启动引擎，结局 frozen
  - 队列排序：关键词按历史尝试次数（PipelineEvent event='search' 计数）升序，尝试少的优先
  - 详情失败率上升提前收工：同一源连续 3 次详情 failed → 主动中断本轮。
    结局归类为 budget_stop 而非 streak：INV-001 把详情超时/失败视为预算见底前兆，
    主动收工是健康行为，不应触发冷却递增

引擎调用路径：sys.path 之外用 importlib 按文件加载 tools/guide-pipeline/pipeline.py
（引擎非 pip 包；其模块级会自行把 BASE_DIR 插进 sys.path）。测试一律 monkeypatch
_run_engine，不触网不起浏览器。
"""

from __future__ import annotations

import importlib.util
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

from app.config import get_settings
from app.models import PipelineEvent
from app.pipeline.stages.base import Stage, StageContext, StageOutcome, register_stage

logger = logging.getLogger(__name__)

# 同一源连续详情失败达到阈值即提前收工（INV-001「详情页 failed 率上升即提前收工」）
EARLY_STOP_DETAIL_FAILURES = 3

BUDGET_EVENTS = ("search", "detail_attempt")


class _EarlyStop(Exception):
    """详情连续失败提前收工信号：由事件 sink 抛出、中断引擎主循环。

    引擎没有提供中途停止钩子， sink 抛异常是当前不改引擎代码前提下唯一的中断通道；
    引擎主循环的 try/finally 会正常关闭浏览器/下载器，事件已落盘的部分不丢。
    """


def budget_used_24h(db, source: str, now: datetime) -> int:
    """24h 滑动窗口内该源的 search + detail_attempt 请求数（DB 台账口径）。"""
    since = now - timedelta(hours=24)
    return (
        db.query(PipelineEvent)
        .filter(
            PipelineEvent.source == source,
            PipelineEvent.event.in_(BUDGET_EVENTS),
            PipelineEvent.ts >= since,
        )
        .count()
    )


def blocked_within_24h(db, source: str, now: datetime) -> bool:
    """24h 内该源已有 blocked 记录（当日拒跑的 DB 台账口径）。"""
    since = now - timedelta(hours=24)
    return (
        db.query(PipelineEvent)
        .filter(
            PipelineEvent.source == source,
            PipelineEvent.event == "blocked",
            PipelineEvent.ts >= since,
        )
        .count()
        > 0
    )


def keyword_attempts(db) -> dict[str, int]:
    """关键词历史尝试次数：PipelineEvent event='search' 按 payload.keyword 计数。"""
    counts: dict[str, int] = {}
    rows = db.query(PipelineEvent.payload).filter(PipelineEvent.event == "search").all()
    for (payload,) in rows:
        kw = (payload or {}).get("keyword")
        if kw:
            counts[kw] = counts.get(kw, 0) + 1
    return counts


def guide_pipeline_dir() -> Path:
    """guide-pipeline 引擎目录：PIPELINE_TOOLS_DIR 覆盖 > 仓库根 tools/guide-pipeline。"""
    settings = get_settings()
    if settings.pipeline_tools_dir:
        return Path(settings.pipeline_tools_dir)
    # backend/app/pipeline/stages/collect.py → 仓库根
    return Path(__file__).resolve().parents[4] / "tools" / "guide-pipeline"


def _classify(events: list[dict]) -> str:
    """本轮事件 → 结局。跨源取最严重：streak > frozen > budget_stop > clean。

    streak 优先于 frozen：新的 blocked 是新风控证据，应触发冷却递增。
    """
    names = {e.get("event") for e in events}
    reasons = {e.get("reason") for e in events if e.get("event") == "stopped"}
    if "blocked" in names:
        return "streak"
    if "source_paused_for_today" in reasons:
        return "frozen"
    if reasons & {"budget_stop", "detail_failure_stop"}:
        return "budget_stop"
    return "clean"


class CollectStage(Stage):
    def run(self, ctx: StageContext) -> StageOutcome:
        policy = ctx.job.policy or {}
        sources = list(policy.get("sources") or [])
        session_budget = int(policy.get("session_budget", 25))
        keywords = self._ordered_keywords(ctx, policy)
        now = datetime.now(timezone.utc)

        events: list[dict] = []
        detail_streak: dict[str, int] = {}

        def emit(event: str, source: str, ts: datetime | None = None, **data) -> None:
            """引擎事件 → 内存列表 + DB PipelineEvent（events.jsonl 由引擎默认 sink 写）。"""
            events.append({"event": event, "source": source, **data})
            ctx.emit(event, source=source, ts=ts, **data)
            if event == "failed":
                streak = detail_streak.get(source, 0) + 1
                detail_streak[source] = streak
                if streak >= EARLY_STOP_DETAIL_FAILURES:
                    raise _EarlyStop(f"{source} 连续 {streak} 次详情失败，提前收工")
            elif event == "saved":
                detail_streak[source] = 0

        engine_error: str | None = None
        for source in sources:
            if blocked_within_24h(ctx.db, source, now):
                # DB 台账拒跑（与引擎 source_paused_for_today 同语义，事件名保持一致便于归类）
                emit("stopped", source, reason="source_paused_for_today")
                continue
            # 交给引擎的是剩余额度而非完整预算：窗口内已用 20 / 预算 25 时本轮只再放行 5。
            # 口径差异说明：DB 账本按 24h 滑动窗口计量，引擎按自然日计量当日 prior 事件；
            # 以 DB 账本为准（ADR-008 决策 5），引擎的自然日计量只会更早停（更保守），不会突破
            remaining = session_budget - budget_used_24h(ctx.db, source, now)
            if remaining <= 0:
                emit("stopped", source, reason="budget_stop")
                continue
            try:
                self._run_engine(ctx, source, keywords, remaining, emit)
            except _EarlyStop:
                emit("stopped", source, reason="detail_failure_stop")
            except Exception as exc:  # 引擎异常：记 error，继续其余源
                logger.exception("采集引擎异常: %s", source)
                emit("failed_engine", source, error=f"{type(exc).__name__}: {exc}")
                engine_error = engine_error or f"{source}: {type(exc).__name__}: {exc}"

        # 引擎异常但其余源无更差信号时记 error；已有 streak/frozen/budget_stop 信号则保留
        outcome = _classify(events)
        if engine_error and outcome == "clean":
            outcome = "error"
        return StageOutcome(
            outcome=outcome,
            requests=sum(1 for e in events if e.get("event") in BUDGET_EVENTS),
            saved=sum(1 for e in events if e.get("event") == "saved"),
            detail_failures=sum(1 for e in events if e.get("event") == "failed"),
            error=engine_error,
        )

    def _ordered_keywords(self, ctx: StageContext, policy: dict) -> list[str]:
        """采集队列：policy.keywords 或引擎 config 目的地组关键词，按历史尝试次数升序。"""
        keywords = list(policy.get("keywords") or []) or self._config_keywords()
        attempts = keyword_attempts(ctx.db)
        # 稳定排序：次数相同保持原顺序
        return sorted(keywords, key=lambda kw: attempts.get(kw, 0))

    def _config_keywords(self) -> list[str]:
        """引擎 config.json 的目的地组关键词（原始顺序）。引擎不可用时返回空。"""
        try:
            import json

            tools_dir = guide_pipeline_dir()
            path = tools_dir / "config.json"
            if not path.exists():
                path = tools_dir / "config.example.json"
            config = json.loads(path.read_text(encoding="utf-8"))
            return [kw for g in (config.get("destination_groups") or []) for kw in (g.get("keywords") or [])]
        except Exception:
            logger.exception("读取 guide-pipeline config 失败")
            return []

    def _run_engine(
        self,
        ctx: StageContext,
        source: str,
        keywords: list[str],
        session_budget: int,
        emit: Callable[..., None],
    ) -> None:
        """真实引擎调用（测试 monkeypatch 此方法）。进程内加载 pipeline.py 并跑一个源。

        通过包装引擎 EventBus 挂 DB sink（保留默认 JsonlSink），用 job.policy 的
        session_budget 覆盖引擎 config 值；关键词经 --keyword 透传（引擎保持 CLI 顺序，
        即本阶段已排好的尝试次数升序）。
        """
        tools_dir = guide_pipeline_dir()
        spec = importlib.util.spec_from_file_location("guide_pipeline_main", tools_dir / "pipeline.py")
        if spec is None or spec.loader is None:
            raise RuntimeError(f"无法加载采集引擎: {tools_dir / 'pipeline.py'}")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)

        settings = get_settings()
        if settings.pipeline_corpus_root:
            # 引擎自身读 GUIDE_PIPELINE_CORPUS_ROOT（优先级最高），直接借道
            os.environ["GUIDE_PIPELINE_CORPUS_ROOT"] = settings.pipeline_corpus_root

        config = mod.load_config()
        config["session_budget"] = session_budget

        orig_bus, orig_load_config = mod.EventBus, mod.load_config

        class DbBus(orig_bus):  # type: ignore[misc, valid-type]
            def __init__(self, sinks):
                super().__init__(sinks)
                self.add_sink(lambda row: emit(
                    row["event"], row.get("source", source),
                    ts=_parse_ts(row.get("time")),
                    **{k: v for k, v in row.items() if k not in ("time", "event", "source")},
                ))

        argv = ["pipeline.py", "--source", source]
        for kw in keywords:
            argv += ["--keyword", kw]

        old_argv = sys.argv
        mod.EventBus, mod.load_config = DbBus, lambda: config
        sys.argv = argv
        try:
            mod.main()
        finally:
            sys.argv = old_argv
            mod.EventBus, mod.load_config = orig_bus, orig_load_config


def _parse_ts(value) -> datetime | None:
    if not value:
        return None
    try:
        ts = datetime.fromisoformat(str(value))
    except ValueError:
        return None
    # 引擎时间戳是本地时区 ISO；统一转 UTC，避免 SQLite 存墙钟时间后口径混乱
    return ts.astimezone(timezone.utc) if ts.tzinfo is not None else ts.replace(tzinfo=timezone.utc)


register_stage("collect", CollectStage)
