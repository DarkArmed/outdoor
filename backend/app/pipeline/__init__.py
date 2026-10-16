"""数据流水线：DB 轮询调度器 + worker + 阶段注册架构（PRD-008 / ADR-008）。

worker 是独立常驻进程（python -m app.pipeline.worker），不挂进 main.py lifespan。
调度语义内置 INV-001 操作规则（见 policies.py / stages/collect.py 注释）。
"""
