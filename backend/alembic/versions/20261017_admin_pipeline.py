"""admin flag and pipeline tables

Revision ID: 20261017_admin_pipeline
Revises: 20261003_merge_web_wechat
Create Date: 2026-10-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20261017_admin_pipeline"
down_revision: Union[str, None] = "20261003_merge_web_wechat"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # batch mode: SQLite cannot ALTER constraints, Postgres issues plain ALTERs
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(
            sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false())
        )

    op.create_table(
        "pipeline_jobs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("policy", sa.JSON(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("state", sa.String(length=16), nullable=False),
        sa.Column("cooldown_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("consecutive_streaks", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_pipeline_jobs_id"), "pipeline_jobs", ["id"], unique=False)
    op.create_index(op.f("ix_pipeline_jobs_type"), "pipeline_jobs", ["type"], unique=False)

    op.create_table(
        "pipeline_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("outcome", sa.String(length=32), nullable=True),
        sa.Column("requests", sa.Integer(), nullable=False),
        sa.Column("saved", sa.Integer(), nullable=False),
        sa.Column("detail_failures", sa.Integer(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["job_id"], ["pipeline_jobs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_pipeline_runs_id"), "pipeline_runs", ["id"], unique=False)
    op.create_index(op.f("ix_pipeline_runs_job_id"), "pipeline_runs", ["job_id"], unique=False)

    op.create_table(
        "pipeline_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=True),
        sa.Column("run_id", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(length=64), nullable=True),
        sa.Column("event", sa.String(length=64), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["job_id"], ["pipeline_jobs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["run_id"], ["pipeline_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_pipeline_events_id"), "pipeline_events", ["id"], unique=False)
    op.create_index(op.f("ix_pipeline_events_ts"), "pipeline_events", ["ts"], unique=False)
    op.create_index(op.f("ix_pipeline_events_job_id"), "pipeline_events", ["job_id"], unique=False)
    op.create_index(op.f("ix_pipeline_events_run_id"), "pipeline_events", ["run_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_pipeline_events_run_id"), table_name="pipeline_events")
    op.drop_index(op.f("ix_pipeline_events_job_id"), table_name="pipeline_events")
    op.drop_index(op.f("ix_pipeline_events_ts"), table_name="pipeline_events")
    op.drop_index(op.f("ix_pipeline_events_id"), table_name="pipeline_events")
    op.drop_table("pipeline_events")
    op.drop_index(op.f("ix_pipeline_runs_job_id"), table_name="pipeline_runs")
    op.drop_index(op.f("ix_pipeline_runs_id"), table_name="pipeline_runs")
    op.drop_table("pipeline_runs")
    op.drop_index(op.f("ix_pipeline_jobs_type"), table_name="pipeline_jobs")
    op.drop_index(op.f("ix_pipeline_jobs_id"), table_name="pipeline_jobs")
    op.drop_table("pipeline_jobs")
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("is_admin")
