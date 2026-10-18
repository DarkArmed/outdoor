"""worker 默认作业幂等 upsert 测试：按源独立作业 + 旧合并作业停用。"""

from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import PipelineJob
from app.pipeline.worker import DEFAULT_JOBS, ensure_default_jobs

# 与 conftest 同一个 sqlite 文件（autouse fixture 负责建/删表）
engine = create_engine("sqlite:///./test.db", connect_args={"check_same_thread": False})
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

NOW = datetime(2026, 10, 17, 10, 0, tzinfo=timezone.utc)

EXPECTED = {
    "collect.xhs_daily": (["xhs"], 25, "08:30"),
    "collect.weibo_daily": (["weibo"], 150, "09:00"),
    "collect.ctrip_daily": (["ctrip"], 150, "09:30"),
    "collect.visitbeijing_daily": (["visitbeijing"], 150, "10:00"),
}


def test_default_jobs_created_per_source():
    """默认作业按源独立：单源 blocked 冷却不拖垮其他源（缺陷 6）。"""
    with TestSession() as db:
        created = ensure_default_jobs(db, now=NOW)
        assert {j.name for j in created} == set(EXPECTED)
        assert len(DEFAULT_JOBS) == 4

        for name, (sources, budget, run_at) in EXPECTED.items():
            job = db.query(PipelineJob).filter(PipelineJob.name == name).one()
            assert job.type == "collect"
            assert job.policy["sources"] == sources
            assert job.policy["session_budget"] == budget
            assert job.policy["run_at"] == run_at
            assert job.enabled is True
            assert job.state == "active"
            assert job.next_run_at is not None


def test_legacy_others_daily_disabled_not_deleted():
    """已存在的旧合并作业 collect.others_daily 被停用（保留行与历史运行记录）。"""
    with TestSession() as db:
        legacy = PipelineJob(
            type="collect",
            name="collect.others_daily",
            policy={"sources": ["weibo", "ctrip", "visitbeijing"], "session_budget": 150, "run_at": "09:30"},
            enabled=True,
        )
        db.add(legacy)
        db.commit()

        ensure_default_jobs(db, now=NOW)

        legacy = db.query(PipelineJob).filter(PipelineJob.name == "collect.others_daily").one()
        assert legacy.enabled is False  # 停用不删行
        assert legacy.policy["sources"] == ["weibo", "ctrip", "visitbeijing"]  # 原参数不动
        # 新的按源独立作业照常创建
        assert db.query(PipelineJob).filter(PipelineJob.name == "collect.weibo_daily").count() == 1


def test_ensure_default_jobs_idempotent_and_no_overwrite():
    with TestSession() as db:
        ensure_default_jobs(db, now=NOW)
        # 模拟用户在后台改过参数
        xhs = db.query(PipelineJob).filter(PipelineJob.name == "collect.xhs_daily").one()
        xhs.policy = {**xhs.policy, "session_budget": 10}
        db.commit()

        created_again = ensure_default_jobs(db, now=NOW)
        assert created_again == []  # 第二次不产生新作业
        assert db.query(PipelineJob).count() == len(DEFAULT_JOBS)
        xhs = db.query(PipelineJob).filter(PipelineJob.name == "collect.xhs_daily").one()
        assert xhs.policy["session_budget"] == 10  # 用户改过的参数不被覆盖
