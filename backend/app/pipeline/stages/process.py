"""process 阶段占位（ADR-008：本期仅注册，不实现）。"""

from app.pipeline.stages.base import Stage, StageContext, StageOutcome, register_stage


class ProcessStage(Stage):
    def run(self, ctx: StageContext) -> StageOutcome:
        ctx.emit("skipped", note="process 阶段尚未实现（本期占位）")
        return StageOutcome(outcome="clean")


register_stage("process", ProcessStage)
