"""DB 轮询调度器（ADR-008 决策 2：自研，约 30s tick，不引入 APScheduler/Celery）。

每 tick：
  1. state='cooldown' 且 cooldown_until 到期 → 自动回 active，排到下一个 run_at 窗口
  2. enabled 且 active 且 next_run_at 到期 → 提交线程池执行（Playwright 同步阻塞，
     阶段跑在 worker 线程，主循环不阻塞）
  3. paused / disabled 跳过

单实例部署（PRD 明确不做多 worker）。同一 job 不重入：内存锁（self._running）+
执行前把 next_run_at 先推到下一个窗口双保险，跑完由 policies 按结局重算。
"""

from __future__ import annotations

import logging
import signal
import threading
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import datetime, timezone

from app.config import get_settings
from app.database import SessionLocal
from app.models import PipelineJob, PipelineRun
from app.pipeline import policies
from app.pipeline.stages import StageContext, StageOutcome, get_stage

logger = logging.getLogger(__name__)


class InlineExecutor:
    """同步执行器：submit 立即在当前线程跑完（测试/调试用，生产走 ThreadPoolExecutor）。"""

    def submit(self, fn, *args, **kwargs) -> Future:
        future: Future = Future()
        try:
            future.set_result(fn(*args, **kwargs))
        except BaseException as exc:
            future.set_exception(exc)
        return future

    def shutdown(self, wait: bool = True, cancel_futures: bool = False) -> None:
        pass


class Scheduler:
    def __init__(self, session_factory=None, tick_seconds: int | None = None, executor=None):
        self._session_factory = session_factory or SessionLocal
        self.tick_seconds = tick_seconds if tick_seconds is not None else get_settings().pipeline_tick_seconds
        self._executor = executor or ThreadPoolExecutor(max_workers=2, thread_name_prefix="pipeline")
        self._stop = threading.Event()
        self._lock = threading.Lock()
        self._running: set[int] = set()
        self._futures: list[Future] = []

    def tick(self, now: datetime | None = None) -> list[int]:
        """单趟调度：返回本次提交执行的 job id 列表。"""
        now = now or datetime.now(timezone.utc)
        submitted: list[int] = []
        with self._session_factory() as db:
            # 冷却到期自动恢复：回 active 并排到下一个 run_at 窗口（INV-001 节奏）
            cooled = (
                db.query(PipelineJob)
                .filter(
                    PipelineJob.state == "cooldown",
                    PipelineJob.cooldown_until.isnot(None),
                    PipelineJob.cooldown_until <= now,
                )
                .all()
            )
            for job in cooled:
                job.state = "active"
                job.cooldown_until = None
                job.next_run_at = policies.next_daily(now, policies.run_at_of(job.policy))
                logger.info("作业冷却结束恢复 active: %s", job.name)

            due = (
                db.query(PipelineJob)
                .filter(
                    PipelineJob.enabled.is_(True),
                    PipelineJob.state == "active",
                    PipelineJob.next_run_at.isnot(None),
                    PipelineJob.next_run_at <= now,
                )
                .all()
            )
            for job in due:
                with self._lock:
                    if job.id in self._running:
                        continue
                    self._running.add(job.id)
                # 先把 next_run_at 推到下一个窗口防重入；跑完由 policies 按结局覆盖
                job.next_run_at = policies.next_daily(now, policies.run_at_of(job.policy))
                submitted.append(job.id)
            db.commit()
        # commit 之后再提交线程池，保证 worker 线程读到的是已落库状态
        for job_id in submitted:
            self._futures.append(self._executor.submit(self._execute, job_id))
        return submitted

    def _execute(self, job_id: int) -> None:
        """单个作业完整执行（worker 线程）：跑阶段 → 写 PipelineRun 结局 → 按结局重排。"""
        try:
            with self._session_factory() as db:
                job = db.query(PipelineJob).filter(PipelineJob.id == job_id).first()
                if job is None:
                    return
                run = PipelineRun(job_id=job.id)
                db.add(run)
                db.flush()  # 先拿到 run.id 供事件关联
                ctx = StageContext(db=db, job=job, run=run)
                try:
                    stage = get_stage(job.type)()
                    outcome = stage.run(ctx)
                except Exception as exc:
                    logger.exception("作业执行异常: %s", job.name)
                    db.rollback()
                    run = PipelineRun(job_id=job.id)
                    db.add(run)
                    db.flush()
                    outcome = StageOutcome(outcome="error", error=f"{type(exc).__name__}: {exc}")

                finished = datetime.now(timezone.utc)
                run.finished_at = finished
                run.outcome = outcome.outcome
                run.requests = outcome.requests
                run.saved = outcome.saved
                run.detail_failures = outcome.detail_failures
                run.error = outcome.error

                decision = policies.next_schedule(
                    outcome.outcome,
                    now=finished,
                    run_at=policies.run_at_of(job.policy),
                    consecutive_streaks=job.consecutive_streaks,
                    cooldown_until=policies.as_utc(job.cooldown_until) if job.cooldown_until else None,
                )
                job.last_run_at = finished
                job.next_run_at = decision.next_run_at
                job.state = decision.state
                job.cooldown_until = decision.cooldown_until
                job.consecutive_streaks = decision.consecutive_streaks
                db.commit()
                logger.info("作业完成: %s outcome=%s next=%s", job.name, outcome.outcome, decision.next_run_at)
        finally:
            with self._lock:
                self._running.discard(job_id)

    def wait_idle(self, timeout: float | None = None) -> None:
        """等待当前已提交的作业全部完成（测试与退出用）。"""
        for future in list(self._futures):
            future.result(timeout=timeout)

    def run(self) -> None:
        """调度主循环：SIGTERM/SIGINT 优雅退出。

        退出时不再启新轮；正在跑的作业选择等待完成而非强断——采集轮次有会话预算
        上限、时长可控，强断会留下未完结的 PipelineRun 与半成品语料目录。
        """

        def _handle_signal(signum, frame):
            logger.info("收到信号 %s，停止调度循环", signum)
            self._stop.set()

        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                signal.signal(sig, _handle_signal)
            except (ValueError, OSError):
                pass  # 非主线程或平台不支持时跳过（如测试中嵌入）

        logger.info("调度循环启动，tick=%ss", self.tick_seconds)
        while not self._stop.is_set():
            try:
                self.tick()
            except Exception:
                logger.exception("调度 tick 失败")
            self._stop.wait(self.tick_seconds)
        self._executor.shutdown(wait=True, cancel_futures=True)
        logger.info("调度循环已退出")
