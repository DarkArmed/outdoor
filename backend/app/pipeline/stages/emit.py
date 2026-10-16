"""emit 阶段占位（ADR-008：本期仅注册，产出交接点见 PRD-007，不实现）。"""

from app.pipeline.stages.base import Stage, StageContext, StageOutcome, register_stage


class EmitStage(Stage):
    def run(self, ctx: StageContext) -> StageOutcome:
        ctx.emit("skipped", note="emit 阶段尚未实现（本期占位）")
        return StageOutcome(outcome="clean")


register_stage("emit", EmitStage)
