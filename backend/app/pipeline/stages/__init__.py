"""阶段包：导入即完成全部内置阶段注册（调度器/worker 只需 import 本包）。"""

from app.pipeline.stages.base import Stage, StageContext, StageOutcome, get_stage, register_stage
from app.pipeline.stages import collect, consume, emit, process  # noqa: F401 注册副作用

__all__ = ["Stage", "StageContext", "StageOutcome", "get_stage", "register_stage"]
