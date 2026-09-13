"""Track idempotent legacy browser imports."""
from alembic import op
import sqlalchemy as sa

revision = "20260913_legacy"
down_revision = "20260912_initial"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("legacy_imports",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("import_id", sa.String(64), primary_key=True),
        sa.Column("result", sa.JSON(), nullable=False))


def downgrade():
    op.drop_table("legacy_imports")
