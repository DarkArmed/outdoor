"""阶段抽象与注册表：作业类型 → Stage 实现（ADR-008 决策 4）。

新阶段/新源走 register_stage 加入，调度器核心不动。
"""

from __future__ import annotations

import abc
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models import PipelineEvent, PipelineJob, PipelineRun


@dataclass
class StageContext:
    """阶段执行上下文：DB session、作业、本轮运行记录、事件发射器。"""

    db: Session
    job: PipelineJob
    run: PipelineRun

    def emit(self, event: str, source: str | None = None, ts: datetime | None = None, **payload: Any) -> PipelineEvent:
        # ts 传 None 时用模型默认 utcnow
        row = PipelineEvent(
            ts=ts,
            job_id=self.job.id,
            run_id=self.run.id,
            source=source,
            event=event,
            payload=payload or None,
        )
        self.db.add(row)
        return row


@dataclass
class StageOutcome:
    outcome: str  # clean / budget_stop / streak / frozen / error
    requests: int = 0
    saved: int = 0
    detail_failures: int = 0
    error: str | None = None
    extra: dict = field(default_factory=dict)


class Stage(abc.ABC):
    """阶段接口：run(ctx) -> StageOutcome。"""

    @abc.abstractmethod
    def run(self, ctx: StageContext) -> StageOutcome: ...


_REGISTRY: dict[str, type[Stage]] = {}


def register_stage(job_type: str, cls: type[Stage]) -> None:
    _REGISTRY[job_type] = cls


def get_stage(job_type: str) -> type[Stage]:
    try:
        return _REGISTRY[job_type]
    except KeyError:
        raise KeyError(f"未注册的阶段类型: {job_type}（可选: {sorted(_REGISTRY)}）") from None
