"""流水线 worker 入口：python -m app.pipeline.worker

独立常驻进程（ADR-008）：启动时幂等确保默认作业存在（只在不存在时插入，
不覆盖用户在后台改过的参数），然后进入调度循环。不挂进 main.py lifespan。
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import PipelineJob
from app.pipeline import policies
from app.pipeline.scheduler import Scheduler

logger = logging.getLogger(__name__)

# 默认作业（INV-001 节奏内置）：按源独立——多源捆一个作业时任一源 blocked 会整组冷却。
# xhs 每 24h 一轮、08:30、会话预算 25；其余源风控宽松，预算参考引擎 config 的
# daily_cap 取 150，run_at 错开避免同一窗口排队（执行器串行，见 scheduler）
DEFAULT_JOBS = [
    {
        "type": "collect",
        "name": "collect.xhs_daily",
        "policy": {"sources": ["xhs"], "session_budget": 25, "interval": "24h", "run_at": "08:30"},
    },
    {
        "type": "collect",
        "name": "collect.weibo_daily",
        "policy": {"sources": ["weibo"], "session_budget": 150, "interval": "24h", "run_at": "09:00"},
    },
    {
        "type": "collect",
        "name": "collect.ctrip_daily",
        "policy": {"sources": ["ctrip"], "session_budget": 150, "interval": "24h", "run_at": "09:30"},
    },
    {
        "type": "collect",
        "name": "collect.visitbeijing_daily",
        "policy": {"sources": ["visitbeijing"], "session_budget": 150, "interval": "24h", "run_at": "10:00"},
    },
]

# 已被按源独立作业取代的旧合并作业：启动时停用（enabled=False），不删行保留历史与运行记录
LEGACY_JOB_NAMES = ["collect.others_daily"]


def ensure_default_jobs(db: Session, now: datetime | None = None) -> list[PipelineJob]:
    """幂等 upsert 默认作业：同名作业已存在则跳过（不覆盖用户改过的参数）。"""
    now = now or datetime.now(timezone.utc)
    created: list[PipelineJob] = []
    for spec in DEFAULT_JOBS:
        exists = db.query(PipelineJob).filter(PipelineJob.name == spec["name"]).first()
        if exists is not None:
            continue
        job = PipelineJob(
            type=spec["type"],
            name=spec["name"],
            policy=dict(spec["policy"]),
            next_run_at=policies.next_daily(now, policies.run_at_of(spec["policy"])),
        )
        db.add(job)
        created.append(job)
    for name in LEGACY_JOB_NAMES:
        legacy = db.query(PipelineJob).filter(PipelineJob.name == name).first()
        if legacy is not None and legacy.enabled:
            # 旧合并作业已拆分为按源独立作业：停用防止重复采集同一批源（行保留不删）
            legacy.enabled = False
            logger.info("停用旧合并作业: %s（已拆分为按源独立作业）", name)
    db.commit()
    return created


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    with SessionLocal() as db:
        created = ensure_default_jobs(db)
        for job in created:
            logger.info("创建默认作业: %s", job.name)
    Scheduler().run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
