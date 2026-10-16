"""worker 默认作业幂等 upsert 测试。"""

from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import PipelineJob
from app.pipeline.worker import DEFAULT_JOBS, ensure_default_jobs

# 与 conftest 同一个 sqlite 文件（autouse fixture 负责建/删表）
engine = create_engine("sqlite:///./test.db", connect_args={"check_same_thread": False})
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

NOW = datetime(2026, 10, 17, 10, 0, tzinfo=timezone.utc)


def test_default_jobs_created_with_expected_policy():
    with TestSession() as db:
        created = ensure_default_jobs(db, now=NOW)
        assert {j.name for j in created} == {"collect.xhs_daily", "collect.others_daily"}

        xhs = db.query(PipelineJob).filter(PipelineJob.name == "collect.xhs_daily").one()
        assert xhs.type == "collect"
        assert xhs.policy["sources"] == ["xhs"]
        assert xhs.policy["session_budget"] == 25
        assert xhs.policy["run_at"] == "08:30"
        assert xhs.enabled is True
        assert xhs.state == "active"
        assert xhs.next_run_at is not None

        others = db.query(PipelineJob).filter(PipelineJob.name == "collect.others_daily").one()
        assert others.policy["sources"] == ["weibo", "ctrip", "visitbeijing"]
        assert others.policy["session_budget"] == 150
        assert others.policy["run_at"] == "09:30"


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
