"""wechat login

Revision ID: 20261001_wechat_login
Revises: 20260912_initial
Create Date: 2026-10-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20261001_wechat_login"
down_revision: Union[str, None] = "20260912_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # batch mode: SQLite cannot ALTER constraints, Postgres issues plain ALTERs
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("wechat_openid", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("nickname", sa.String(length=64), nullable=True))
        batch_op.create_unique_constraint("uq_users_wechat_openid", ["wechat_openid"])
    op.create_index(op.f("ix_users_wechat_openid"), "users", ["wechat_openid"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_wechat_openid"), table_name="users")
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_constraint("uq_users_wechat_openid", type_="unique")
        batch_op.drop_column("nickname")
        batch_op.drop_column("wechat_openid")
