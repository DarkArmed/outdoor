"""initial

Revision ID: 20260912_initial
Revises:
Create Date: 2026-09-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260912_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=False)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)

    op.create_table(
        "milestones",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("icon", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("rule", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_milestones_id"), "milestones", ["id"], unique=False)

    op.create_table(
        "networks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("region", sa.String(length=64), nullable=False),
        sa.Column("bbox", sa.JSON(), nullable=False),
        sa.Column("ways", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("region"),
    )
    op.create_index(op.f("ix_networks_id"), "networks", ["id"], unique=False)

    op.create_table(
        "plans",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("date", sa.String(length=64), nullable=False),
        sa.Column("type", sa.String(length=16), nullable=False),
        sa.Column("theme", sa.String(length=32), nullable=False),
        sa.Column("emoji", sa.String(length=16), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=False),
        sa.Column("archived", sa.Boolean(), nullable=False),
        sa.Column("mom", sa.Boolean(), nullable=False),
        sa.Column("goal", sa.Text(), nullable=False),
        sa.Column("tips", sa.JSON(), nullable=False),
        sa.Column("itinerary", sa.JSON(), nullable=False),
        sa.Column("day_names", sa.JSON(), nullable=False),
        sa.Column("drive", sa.JSON(), nullable=False),
        sa.Column("hike", sa.JSON(), nullable=False),
        sa.Column("gear", sa.JSON(), nullable=False),
        sa.Column("safety", sa.JSON(), nullable=False),
        sa.Column("review", sa.JSON(), nullable=False),
        sa.Column("badge", sa.JSON(), nullable=True),
        sa.Column("tasks", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_plans_id"), "plans", ["id"], unique=False)

    op.create_table(
        "profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("home_name", sa.String(length=255), nullable=False),
        sa.Column("home_city", sa.String(length=100), nullable=False),
        sa.Column("family_travelers", sa.JSON(), nullable=False),
        sa.Column("child", sa.JSON(), nullable=False),
        sa.Column("prefs", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_profiles_id"), "profiles", ["id"], unique=False)

    op.create_table(
        "routes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("plan_id", sa.String(length=64), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("drive", sa.JSON(), nullable=False),
        sa.Column("hike", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("plan_id"),
    )
    op.create_index(op.f("ix_routes_id"), "routes", ["id"], unique=False)
    op.create_index(op.f("ix_routes_plan_id"), "routes", ["plan_id"], unique=False)

    op.create_table(
        "trips",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("plan_id", sa.String(length=64), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("overrides", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("planned_date", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_trips_id"), "trips", ["id"], unique=False)
    op.create_index(op.f("ix_trips_plan_id"), "trips", ["plan_id"], unique=False)
    op.create_index(op.f("ix_trips_user_id"), "trips", ["user_id"], unique=False)

    op.create_table(
        "badge_unlocks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("badge_id", sa.String(length=64), nullable=False),
        sa.Column("unlocked_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "badge_id", name="uix_badge_user_badge"),
    )
    op.create_index(op.f("ix_badge_unlocks_id"), "badge_unlocks", ["id"], unique=False)

    op.create_table(
        "checkins",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("trip_id", sa.Integer(), nullable=False),
        sa.Column("checked_in_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["trip_id"], ["trips.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_checkins_id"), "checkins", ["id"], unique=False)
    op.create_index(op.f("ix_checkins_trip_id"), "checkins", ["trip_id"], unique=False)

    op.create_table(
        "gear_states",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("trip_id", sa.Integer(), nullable=False),
        sa.Column("item_idx", sa.Integer(), nullable=False),
        sa.Column("checked", sa.Boolean(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["trip_id"], ["trips.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("trip_id", "item_idx", name="uix_gear_trip_idx"),
    )
    op.create_index(op.f("ix_gear_states_id"), "gear_states", ["id"], unique=False)
    op.create_index(op.f("ix_gear_states_trip_id"), "gear_states", ["trip_id"], unique=False)

    op.create_table(
        "task_states",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("trip_id", sa.Integer(), nullable=False),
        sa.Column("task_idx", sa.Integer(), nullable=False),
        sa.Column("checked", sa.Boolean(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["trip_id"], ["trips.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("trip_id", "task_idx", name="uix_task_trip_idx"),
    )
    op.create_index(op.f("ix_task_states_id"), "task_states", ["id"], unique=False)
    op.create_index(op.f("ix_task_states_trip_id"), "task_states", ["trip_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_task_states_trip_id"), table_name="task_states")
    op.drop_index(op.f("ix_task_states_id"), table_name="task_states")
    op.drop_table("task_states")
    op.drop_index(op.f("ix_gear_states_trip_id"), table_name="gear_states")
    op.drop_index(op.f("ix_gear_states_id"), table_name="gear_states")
    op.drop_table("gear_states")
    op.drop_index(op.f("ix_checkins_trip_id"), table_name="checkins")
    op.drop_index(op.f("ix_checkins_id"), table_name="checkins")
    op.drop_table("checkins")
    op.drop_index(op.f("ix_badge_unlocks_id"), table_name="badge_unlocks")
    op.drop_table("badge_unlocks")
    op.drop_index(op.f("ix_trips_user_id"), table_name="trips")
    op.drop_index(op.f("ix_trips_plan_id"), table_name="trips")
    op.drop_index(op.f("ix_trips_id"), table_name="trips")
    op.drop_table("trips")
    op.drop_index(op.f("ix_routes_plan_id"), table_name="routes")
    op.drop_index(op.f("ix_routes_id"), table_name="routes")
    op.drop_table("routes")
    op.drop_index(op.f("ix_profiles_id"), table_name="profiles")
    op.drop_table("profiles")
    op.drop_index(op.f("ix_plans_id"), table_name="plans")
    op.drop_table("plans")
    op.drop_index(op.f("ix_networks_id"), table_name="networks")
    op.drop_table("networks")
    op.drop_index(op.f("ix_milestones_id"), table_name="milestones")
    op.drop_table("milestones")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
