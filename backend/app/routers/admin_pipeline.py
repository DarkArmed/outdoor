"""管理员流水线 API：监控总览 + 作业控制。

调度循环只跑在独立 worker 进程（python -m app.pipeline.worker），API 进程不持有
Scheduler 实例：trigger 只是把 next_run_at 拨到当前时间，由 worker 下个 tick 拾起执行。

pause / resume 与 cooldown 的交互语义：
  - pause：enabled=False；active → paused；cooldown 中暂停保留 state=cooldown
    （冷却剩余时长是风控结果，暂停不应抹掉它；worker 对 paused/cooldown/disabled 都跳过）
  - resume：enabled=True；paused → active；cooldown 未到期仍回 cooldown
    （到期由调度器自动恢复 active），已过期则直接回 active 并清掉 cooldown_until
"""

import json
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_admin
from app.database import get_db
from app.models import PipelineEvent, PipelineJob, PipelineRun, User
from app.pipeline import policies
from app.pipeline.stages.collect import blocked_within_24h, budget_used_24h, guide_pipeline_dir
from app.schemas import (
    PipelineEventOut,
    PipelineJobOut,
    PipelineJobUpdate,
    PipelineOverviewOut,
    PipelineRunOut,
    PipelineSourceBudgetOut,
)

router = APIRouter(prefix="/api/admin/pipeline", tags=["admin-pipeline"])

RUN_AT_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
INTERVAL_RE = re.compile(r"^\d+[hmd]$")


def _engine_rate_limits() -> dict:
    """guide-pipeline config 的 rate_limits 段（读不到返回空，由调用方用 job policy 兜底）。"""
    try:
        tools_dir = guide_pipeline_dir()
        path = tools_dir / "config.json"
        if not path.exists():
            path = tools_dir / "config.example.json"
        config = json.loads(path.read_text(encoding="utf-8"))
        return config.get("rate_limits") or {}
    except Exception:
        return {}


def _get_job_or_404(db: Session, job_id: int) -> PipelineJob:
    job = db.query(PipelineJob).filter(PipelineJob.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/overview", response_model=PipelineOverviewOut)
def overview(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    jobs = db.query(PipelineJob).order_by(PipelineJob.id).all()
    limits = _engine_rate_limits()
    default_cap = (limits.get("default") or {}).get("daily_cap")

    # 预算用量按源聚合：源集合取各 job policy.sources 的并集
    sources = sorted({s for job in jobs for s in ((job.policy or {}).get("sources") or [])})
    budgets = []
    for source in sources:
        limit = (limits.get(source) or {}).get("daily_cap") or default_cap
        limit_source = "engine_config"
        if limit is None:
            # 引擎 config 读不到该源限额：兜底用包含该源的 job 中最大的 session_budget
            limit_source = "job_policy"
            limit = max(
                (
                    int((job.policy or {}).get("session_budget", 0))
                    for job in jobs
                    if source in ((job.policy or {}).get("sources") or [])
                ),
                default=None,
            )
        budgets.append(
            PipelineSourceBudgetOut(
                source=source,
                used_24h=budget_used_24h(db, source, now),
                limit=limit,
                limit_source=limit_source,
                in_cooldown=blocked_within_24h(db, source, now),
            )
        )
    return PipelineOverviewOut(
        jobs=jobs,
        budgets=budgets,
        cooldown_sources=[b.source for b in budgets if b.in_cooldown],
    )


@router.get("/runs", response_model=list[PipelineRunOut])
def list_runs(
    skip: int = 0,
    limit: int = 100,
    job_id: int | None = None,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = db.query(PipelineRun)
    if job_id is not None:
        query = query.filter(PipelineRun.job_id == job_id)
    return query.order_by(PipelineRun.started_at.desc(), PipelineRun.id.desc()).offset(skip).limit(limit).all()


@router.get("/events", response_model=list[PipelineEventOut])
def list_events(
    skip: int = 0,
    limit: int = 100,
    source: str | None = None,
    event: str | None = None,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = db.query(PipelineEvent)
    if source is not None:
        query = query.filter(PipelineEvent.source == source)
    if event is not None:
        query = query.filter(PipelineEvent.event == event)
    return query.order_by(PipelineEvent.ts.desc(), PipelineEvent.id.desc()).offset(skip).limit(limit).all()


@router.post("/jobs/{job_id}/pause", response_model=PipelineJobOut)
def pause_job(
    job_id: int,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    job = _get_job_or_404(db, job_id)
    job.enabled = False
    if job.state == "active":
        job.state = "paused"
    # cooldown 中暂停：保留 state=cooldown，语义见模块 docstring
    db.commit()
    db.refresh(job)
    return job


@router.post("/jobs/{job_id}/resume", response_model=PipelineJobOut)
def resume_job(
    job_id: int,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    job = _get_job_or_404(db, job_id)
    job.enabled = True
    if job.state == "paused":
        job.state = "active"
    elif job.state == "cooldown":
        until = policies.as_utc(job.cooldown_until) if job.cooldown_until else None
        if until is None or until <= datetime.now(timezone.utc):
            job.state = "active"
            job.cooldown_until = None
        # 未到期：保持 cooldown，由调度器到期自动恢复 active
    db.commit()
    db.refresh(job)
    return job


@router.post("/jobs/{job_id}/trigger", response_model=PipelineJobOut)
def trigger_job(
    job_id: int,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    job = _get_job_or_404(db, job_id)
    if not job.enabled or job.state == "paused":
        raise HTTPException(status_code=409, detail="Job is paused/disabled, resume it first")
    if job.state == "cooldown":
        # 调度器只拾取 state=active 的作业，冷却中触发是无效操作；风控冷却不手动绕过
        raise HTTPException(status_code=409, detail="Job is in cooldown until cooldown_until")
    job.next_run_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    return job


@router.patch("/jobs/{job_id}", response_model=PipelineJobOut)
def update_job(
    job_id: int,
    payload: PipelineJobUpdate,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    job = _get_job_or_404(db, job_id)
    policy = dict(job.policy or {})

    if payload.session_budget is not None:
        if not 1 <= payload.session_budget <= 200:
            raise HTTPException(status_code=400, detail="session_budget must be between 1 and 200")
        policy["session_budget"] = payload.session_budget
    if payload.run_at is not None:
        if not RUN_AT_RE.match(payload.run_at):
            raise HTTPException(status_code=400, detail="run_at must be HH:MM")
        policy["run_at"] = payload.run_at
    if payload.interval is not None:
        if not INTERVAL_RE.match(payload.interval):
            raise HTTPException(status_code=400, detail="interval must look like 24h / 30m / 1d")
        policy["interval"] = payload.interval
    if payload.name is not None:
        job.name = payload.name

    if policy != (job.policy or {}):
        # JSON 列需要整体重新赋值才能被 SQLAlchemy 感知变更
        job.policy = policy

    if payload.reschedule:
        # 显式 reschedule=true 才按新参数重排 next_run_at；与 worker 结局重排共用同一
        # 策略函数（run_at 窗口 / interval 最小间隔 / 两者取较晚），保证 API 与 worker
        # 计算完全一致；cooldown 中的作业以冷却结束时间为基准（不提前解除风控冷却）
        now = datetime.now(timezone.utc)
        base = now
        if job.state == "cooldown" and job.cooldown_until:
            until = policies.as_utc(job.cooldown_until)
            if until > now:
                base = until
        job.next_run_at = policies.next_for_policy(base, job.policy)

    db.commit()
    db.refresh(job)
    return job
