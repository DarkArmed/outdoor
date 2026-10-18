"""调度循环测试：到期执行 / paused 跳过 / cooldown 自动恢复 / 结局重排 / 防重入 /
运行中可见性（run 即时落库）/ collect 类作业串行执行。"""

import itertools
import threading
import time
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import PipelineEvent, PipelineJob, PipelineRun
from app.pipeline.scheduler import InlineExecutor, Scheduler
from app.pipeline.stages import Stage, StageOutcome, register_stage

# 与 conftest 同一个 sqlite 文件（autouse fixture 负责建/删表）
engine = create_engine("sqlite:///./test.db", connect_args={"check_same_thread": False})
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

NOW = datetime(2026, 10, 17, 10, 0, tzinfo=timezone.utc)
_names = itertools.count(1)


class FakeStage(Stage):
    """按 job.policy["fake"] 返回结局；"raise" 抛异常。记录调用过的作业名。"""

    calls: list[str] = []

    def run(self, ctx):
        FakeStage.calls.append(ctx.job.name)
        fake = (ctx.job.policy or {}).get("fake")
        if fake == "raise":
            raise RuntimeError("boom")
        return StageOutcome(outcome=fake or "clean", requests=2, saved=1, detail_failures=0)


register_stage("fake", FakeStage)


@pytest.fixture(autouse=True)
def _reset_calls():
    FakeStage.calls = []


def make_job(db, *, fake="clean", type_="fake", state="active", enabled=True, next_run_at=None,
             cooldown_until=None, streaks=0, run_at="08:30"):
    job = PipelineJob(
        type=type_,
        name=f"fake.job_{next(_names)}",
        policy={"fake": fake, "run_at": run_at},
        enabled=enabled,
        state=state,
        next_run_at=NOW - timedelta(minutes=1) if next_run_at is None else next_run_at,
        cooldown_until=cooldown_until,
        consecutive_streaks=streaks,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    db.expunge(job)  # 带出已加载属性，供 session 关闭后断言
    return job


def make_scheduler():
    return Scheduler(session_factory=TestSession, tick_seconds=1, executor=InlineExecutor())


def fetch_job(job_id):
    with TestSession() as db:
        return db.query(PipelineJob).filter(PipelineJob.id == job_id).first()


def aware(dt):
    """SQLite 读出的是 naive datetime，统一按 UTC 补齐再比较。"""
    return dt if dt is None or dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def test_due_job_executed():
    with TestSession() as db:
        job = make_job(db)
    submitted = make_scheduler().tick(now=NOW)
    assert submitted == [job.id]
    assert FakeStage.calls == [job.name]

    fresh = fetch_job(job.id)
    finished = fetch_run_finish(job.id)
    assert fresh.last_run_at is not None
    assert aware(fresh.next_run_at) > finished  # clean → 下一个 08:30 窗口
    local = aware(fresh.next_run_at).astimezone()
    assert (local.hour, local.minute) == (8, 30)
    assert fresh.state == "active"
    with TestSession() as db:
        run = db.query(PipelineRun).filter(PipelineRun.job_id == job.id).one()
        assert run.outcome == "clean"
        assert (run.requests, run.saved, run.detail_failures) == (2, 1, 0)
        assert run.finished_at is not None


def test_paused_job_skipped():
    with TestSession() as db:
        job = make_job(db, state="paused")
    assert make_scheduler().tick(now=NOW) == []
    assert FakeStage.calls == []
    assert fetch_job(job.id).last_run_at is None


def test_disabled_job_skipped():
    with TestSession() as db:
        make_job(db, enabled=False)
    assert make_scheduler().tick(now=NOW) == []
    assert FakeStage.calls == []


def test_cooldown_due_recovers_to_active():
    with TestSession() as db:
        job = make_job(db, state="cooldown", cooldown_until=NOW - timedelta(minutes=1), streaks=1)
    # 恢复只翻状态并排到下一个窗口，本 tick 不立即执行
    assert make_scheduler().tick(now=NOW) == []
    fresh = fetch_job(job.id)
    assert fresh.state == "active"
    assert fresh.cooldown_until is None
    assert aware(fresh.next_run_at) > NOW


def test_cooldown_not_due_untouched():
    until = NOW + timedelta(hours=5)
    with TestSession() as db:
        job = make_job(db, state="cooldown", cooldown_until=until, streaks=1)
    assert make_scheduler().tick(now=NOW) == []
    fresh = fetch_job(job.id)
    assert fresh.state == "cooldown"


def test_streak_outcome_cools_down_24h():
    with TestSession() as db:
        job = make_job(db, fake="streak")
    make_scheduler().tick(now=NOW)
    fresh = fetch_job(job.id)
    assert fresh.state == "cooldown"
    assert fresh.consecutive_streaks == 1
    expected_until = fetch_run_finish(job.id) + timedelta(hours=24)
    assert abs((aware(fresh.cooldown_until) - expected_until).total_seconds()) < 2


def test_error_outcome_retries_in_1h():
    with TestSession() as db:
        job = make_job(db, fake="raise", streaks=2)
    make_scheduler().tick(now=NOW)
    fresh = fetch_job(job.id)
    assert fresh.state == "active"
    assert fresh.consecutive_streaks == 2  # error 不放大 streak
    finished = fetch_run_finish(job.id)
    assert abs((aware(fresh.next_run_at) - (finished + timedelta(hours=1))).total_seconds()) < 2
    with TestSession() as db:
        run = db.query(PipelineRun).filter(PipelineRun.job_id == job.id).one()
        assert run.outcome == "error"
        assert "boom" in run.error


def fetch_run_finish(job_id):
    with TestSession() as db:
        run = db.query(PipelineRun).filter(PipelineRun.job_id == job_id).one()
        finished = run.finished_at
        return finished if finished.tzinfo else finished.replace(tzinfo=timezone.utc)


def test_no_reentry_while_running():
    scheduler = make_scheduler()
    with TestSession() as db:
        job = make_job(db)
    scheduler._running.add(job.id)  # 模拟上一轮还在跑
    assert scheduler.tick(now=NOW) == []
    assert FakeStage.calls == []


# ---------- 缺陷 3：运行中 dashboard 可见（run 即时落库 + 事件逐条提交） ----------


class MidRunProbeStage(Stage):
    """运行中途从另一连接检查：run 已落库（finished_at=NULL 即运行中）且已发事件可见。"""

    seen: dict = {}

    def run(self, ctx):
        ctx.emit("search", source="xhs", keyword="k")
        with TestSession() as other:  # 另一连接视角（dashboard 查询路径）
            run = other.query(PipelineRun).filter(PipelineRun.id == ctx.run.id).first()
            events = other.query(PipelineEvent).filter(PipelineEvent.run_id == ctx.run.id).all()
            MidRunProbeStage.seen = {
                "run_found": run is not None,
                "finished_at": run.finished_at if run else "missing",
                "events": [e.event for e in events],
            }
        ctx.emit("saved", source="xhs", id="a1")
        return StageOutcome(outcome="clean", requests=1, saved=1)


register_stage("fake_probe", MidRunProbeStage)


def test_run_and_events_visible_mid_run():
    with TestSession() as db:
        make_job(db, type_="fake_probe")
    make_scheduler().tick(now=NOW)
    assert MidRunProbeStage.seen["run_found"] is True
    assert MidRunProbeStage.seen["finished_at"] is None  # 运行中 finished_at 为 NULL
    assert MidRunProbeStage.seen["events"] == ["search"]  # 已发事件运行中即可见


# ---------- 缺陷 6：collect 类作业串行执行（默认线程池 max_workers=1） ----------


class SlowStage(Stage):
    """记录并发度：同时活跃的执行数峰值。"""

    lock = threading.Lock()
    active = 0
    max_active = 0

    def run(self, ctx):
        with SlowStage.lock:
            SlowStage.active += 1
            SlowStage.max_active = max(SlowStage.max_active, SlowStage.active)
        time.sleep(0.05)
        with SlowStage.lock:
            SlowStage.active -= 1
        return StageOutcome(outcome="clean")


register_stage("fake_slow", SlowStage)


def test_due_jobs_run_serially_with_default_executor():
    """同一 tick 多个到期作业不并发执行（默认执行器 max_workers=1，保护语料库写入）。"""
    SlowStage.active = SlowStage.max_active = 0
    scheduler = Scheduler(session_factory=TestSession, tick_seconds=1)  # 默认线程池
    try:
        with TestSession() as db:
            for _ in range(3):
                make_job(db, type_="fake_slow")
        submitted = scheduler.tick(now=NOW)
        assert len(submitted) == 3
        scheduler.wait_idle(timeout=10)
        assert SlowStage.max_active == 1
    finally:
        scheduler._executor.shutdown(wait=True)
