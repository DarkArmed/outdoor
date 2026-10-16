"""collect 阶段测试：结局映射 / DB 预算窗口 / 拒跑 / 详情失败提前收工 / 队列排序。

引擎调用一律 monkeypatch CollectStage._run_engine，不触网不起浏览器。
"""

import itertools
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import PipelineEvent, PipelineJob, PipelineRun
from app.pipeline.scheduler import InlineExecutor, Scheduler
from app.pipeline.stages.collect import CollectStage, budget_used_24h, blocked_within_24h, keyword_attempts

# 与 conftest 同一个 sqlite 文件（autouse fixture 负责建/删表）
engine = create_engine("sqlite:///./test.db", connect_args={"check_same_thread": False})
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

NOW = datetime(2026, 10, 17, 1, 0, tzinfo=timezone.utc)
_names = itertools.count(1)

POLICY = {"sources": ["xhs"], "session_budget": 25, "run_at": "08:30", "keywords": ["白河湾"]}


def aware(dt):
    return dt if dt is None or dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def make_job(db, policy=None, **kw):
    job = PipelineJob(
        type="collect",
        name=f"collect.test_{next(_names)}",
        policy=dict(policy or POLICY),
        state=kw.get("state", "active"),
        next_run_at=kw.get("next_run_at", NOW - timedelta(minutes=1)),
        consecutive_streaks=kw.get("streaks", 0),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    db.expunge(job)  # 带出已加载属性，供 session 关闭后断言
    return job


def add_event(db, source, event, ts, **payload):
    db.add(PipelineEvent(ts=ts, source=source, event=event, payload=payload or None))
    db.commit()


def fake_engine(monkeypatch, script, calls):
    """script: [(event, data)] 依次经 emit 回放；emit 抛 _EarlyStop 时中断（与真实引擎一致）。"""

    def _run(self, ctx, source, keywords, session_budget, emit):
        calls.append({"source": source, "keywords": list(keywords), "session_budget": session_budget})
        for event, data in script:
            emit(event, source, **data)

    monkeypatch.setattr(CollectStage, "_run_engine", _run)


def run_job(monkeypatch, script, policy=None, **job_kw):
    """经调度器完整跑一个 collect 作业，返回 (job, run, engine_calls)。"""
    calls = []
    fake_engine(monkeypatch, script, calls)
    with TestSession() as db:
        job = make_job(db, policy=policy, **job_kw)
    Scheduler(session_factory=TestSession, tick_seconds=1, executor=InlineExecutor()).tick(now=NOW)
    with TestSession() as db:
        fresh_job = db.query(PipelineJob).filter(PipelineJob.id == job.id).first()
        run = db.query(PipelineRun).filter(PipelineRun.job_id == job.id).one()
        # 取出字段避免 session 关闭后懒加载
        result = (
            {
                "state": fresh_job.state,
                "streaks": fresh_job.consecutive_streaks,
                "cooldown_until": aware(fresh_job.cooldown_until),
                "next_run_at": aware(fresh_job.next_run_at),
            },
            {
                "outcome": run.outcome,
                "requests": run.requests,
                "saved": run.saved,
                "detail_failures": run.detail_failures,
                "error": run.error,
                "finished_at": aware(run.finished_at),
            },
            calls,
        )
    return result


# ---------- 结局映射 ----------


def test_outcome_clean(monkeypatch):
    job, run, calls = run_job(monkeypatch, [
        ("search", {"keyword": "白河湾"}),
        ("search_results", {"keyword": "白河湾", "count": 2}),
        ("detail_attempt", {"id": "a1"}),
        ("saved", {"id": "a1", "keyword": "白河湾"}),
        ("job_done", {"fetched_new": 1}),
    ])
    assert run["outcome"] == "clean"
    assert (run["requests"], run["saved"], run["detail_failures"]) == (2, 1, 0)
    assert job["state"] == "active"
    assert job["streaks"] == 0
    assert job["next_run_at"] > run["finished_at"]  # 下一个 08:30 窗口
    local = job["next_run_at"].astimezone()
    assert (local.hour, local.minute) == (8, 30)
    assert calls[0]["session_budget"] == 25


def test_outcome_budget_stop(monkeypatch):
    job, run, _ = run_job(monkeypatch, [
        ("search", {"keyword": "白河湾"}),
        ("stopped", {"reason": "budget_stop"}),
    ])
    assert run["outcome"] == "budget_stop"
    assert job["state"] == "active"  # 主动收工不冷却
    assert job["streaks"] == 0


def test_outcome_streak_cools_down(monkeypatch):
    job, run, _ = run_job(monkeypatch, [
        ("search", {"keyword": "白河湾"}),
        ("blocked", {"reason": "连续 3 次空搜索，保守暂停（原因未确认）"}),
    ])
    assert run["outcome"] == "streak"
    assert job["state"] == "cooldown"
    assert job["streaks"] == 1
    assert abs((job["cooldown_until"] - (run["finished_at"] + timedelta(hours=24))).total_seconds()) < 2
    assert job["next_run_at"] >= job["cooldown_until"]


def test_outcome_frozen_from_engine(monkeypatch):
    job, run, _ = run_job(monkeypatch, [
        ("stopped", {"reason": "source_paused_for_today"}),
    ])
    assert run["outcome"] == "frozen"
    assert job["streaks"] == 0  # frozen 不加 streak
    assert job["state"] == "active"  # 无既有冷却 → 排到下一个常规窗口
    assert job["next_run_at"] > run["finished_at"]


def test_outcome_frozen_from_db_ledger(monkeypatch):
    """DB 台账 24h 内已有 blocked → 不启动引擎，直接 frozen。"""
    with TestSession() as db:
        add_event(db, "xhs", "blocked", NOW - timedelta(hours=2), reason="历史风控")
    job, run, calls = run_job(monkeypatch, [("job_done", {"fetched_new": 0})])
    assert calls == []  # 引擎未被调用
    assert run["outcome"] == "frozen"


def test_outcome_error_on_engine_exception(monkeypatch):
    def _boom(self, ctx, source, keywords, session_budget, emit):
        raise RuntimeError("playwright crashed")

    monkeypatch.setattr(CollectStage, "_run_engine", _boom)
    with TestSession() as db:
        job = make_job(db)
    Scheduler(session_factory=TestSession, tick_seconds=1, executor=InlineExecutor()).tick(now=NOW)
    with TestSession() as db:
        run = db.query(PipelineRun).filter(PipelineRun.job_id == job.id).one()
        fresh = db.query(PipelineJob).filter(PipelineJob.id == job.id).first()
        assert run.outcome == "error"
        assert "playwright crashed" in run.error
        assert fresh.state == "active"
        assert abs((aware(fresh.next_run_at) - (aware(run.finished_at) + timedelta(hours=1))).total_seconds()) < 2


# ---------- DB 预算窗口（24h 滑动，PipelineEvent 求和） ----------


def test_budget_window_24h_sliding():
    with TestSession() as db:
        add_event(db, "xhs", "search", NOW - timedelta(hours=1))
        add_event(db, "xhs", "detail_attempt", NOW - timedelta(hours=23, minutes=59))
        add_event(db, "xhs", "search", NOW - timedelta(hours=25))  # 窗口外不计
        add_event(db, "xhs", "saved", NOW - timedelta(hours=1))  # 非预算事件不计
        add_event(db, "weibo", "search", NOW - timedelta(hours=1))  # 其他源不计
        assert budget_used_24h(db, "xhs", NOW) == 2
        assert budget_used_24h(db, "weibo", NOW) == 1
        assert blocked_within_24h(db, "xhs", NOW) is False


def test_blocked_window_24h():
    with TestSession() as db:
        add_event(db, "xhs", "blocked", NOW - timedelta(hours=25))
        assert blocked_within_24h(db, "xhs", NOW) is False
        add_event(db, "xhs", "blocked", NOW - timedelta(hours=1))
        assert blocked_within_24h(db, "xhs", NOW) is True


def test_db_budget_exhausted_skips_engine(monkeypatch):
    """DB 台账 24h 内已达 session_budget → 预检拦下，结局 budget_stop。"""
    with TestSession() as db:
        for i in range(25):
            add_event(db, "xhs", "search", NOW - timedelta(hours=1), keyword=f"k{i}")
    job, run, calls = run_job(monkeypatch, [("job_done", {"fetched_new": 0})])
    assert calls == []
    assert run["outcome"] == "budget_stop"
    assert job["state"] == "active"


# ---------- 详情连续失败提前收工 ----------


def test_detail_failures_early_stop(monkeypatch):
    job, run, _ = run_job(monkeypatch, [
        ("detail_attempt", {"id": "a1"}),
        ("failed", {"id": "a1"}),
        ("detail_attempt", {"id": "a2"}),
        ("failed", {"id": "a2"}),
        ("detail_attempt", {"id": "a3"}),
        ("failed", {"id": "a3"}),  # 第 3 次连续失败 → sink 抛 _EarlyStop，后续事件不再发生
        ("saved", {"id": "a4"}),
    ])
    # 详情连续失败视为预算见底前兆：主动收工记 budget_stop，不算 streak
    assert run["outcome"] == "budget_stop"
    assert run["saved"] == 0  # 中断点之后的 saved 未发生
    assert run["detail_failures"] == 3
    assert job["state"] == "active"
    assert job["streaks"] == 0


def test_detail_failure_streak_reset_by_saved(monkeypatch):
    """saved 会重置连续失败计数：2 失败 + saved + 2 失败 不触发提前收工。"""
    job, run, _ = run_job(monkeypatch, [
        ("failed", {"id": "a1"}),
        ("failed", {"id": "a2"}),
        ("saved", {"id": "a3"}),
        ("failed", {"id": "a4"}),
        ("failed", {"id": "a5"}),
        ("job_done", {"fetched_new": 1}),
    ])
    assert run["outcome"] == "clean"
    assert run["detail_failures"] == 4
    assert run["saved"] == 1


# ---------- 队列排序 ----------


def test_keyword_attempts_counting():
    with TestSession() as db:
        add_event(db, "xhs", "search", NOW, keyword="a")
        add_event(db, "xhs", "search", NOW, keyword="a")
        add_event(db, "weibo", "search", NOW, keyword="a")
        add_event(db, "xhs", "search", NOW, keyword="b")
        add_event(db, "xhs", "search_results", NOW, keyword="c")  # 非 search 事件不计
        assert keyword_attempts(db) == {"a": 3, "b": 1}


def test_queue_ordered_by_attempts_ascending(monkeypatch):
    with TestSession() as db:
        for _ in range(5):
            add_event(db, "xhs", "search", NOW, keyword="a")
        add_event(db, "xhs", "search", NOW, keyword="c")
    policy = dict(POLICY, keywords=["a", "b", "c"])
    _, _, calls = run_job(monkeypatch, [("job_done", {"fetched_new": 0})], policy=policy)
    # 尝试次数 a=5, c=1, b=0 → 升序 b, c, a
    assert calls[0]["keywords"] == ["b", "c", "a"]


# ---------- 事件双写 ----------


def test_engine_events_written_to_db(monkeypatch):
    with TestSession() as db:
        job = make_job(db)
        job_id = job.id
    _, run, _ = run_job(monkeypatch, [
        ("search", {"keyword": "白河湾"}),
        ("saved", {"id": "a1"}),
        ("job_done", {"fetched_new": 1}),
    ])
    with TestSession() as db:
        run_row = db.query(PipelineRun).filter(PipelineRun.job_id == job_id).one()
        rows = (
            db.query(PipelineEvent)
            .filter(PipelineEvent.job_id == job_id)
            .order_by(PipelineEvent.id)
            .all()
        )
        assert [r.event for r in rows] == ["search", "saved", "job_done"]
        assert all(r.run_id == run_row.id for r in rows)
        assert rows[0].source == "xhs"
        assert rows[0].payload["keyword"] == "白河湾"
