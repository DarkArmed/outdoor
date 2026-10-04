"""Join the existing Web import and WeChat login migration histories.

Revision ID: 20261003_merge_web_wechat
Revises: 20260913_legacy, 20261001_wechat_login
Create Date: 2026-10-03
"""

revision = "20261003_merge_web_wechat"
down_revision = ("20260913_legacy", "20261001_wechat_login")
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Both parent revisions already contain their independent schema changes.
    pass


def downgrade() -> None:
    # Reopening the two parent heads does not remove either branch's data.
    pass
