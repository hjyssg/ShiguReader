"""add folder open history and activity logs

Revision ID: 20260217_0001
Revises: 20260215_0002
Create Date: 2026-02-17 10:20:00

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260217_0001"
down_revision = "20260215_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "folder_open_history",
        sa.Column("folderpath", sa.String(), nullable=False),
        sa.Column("last_opened_at", sa.Integer(), nullable=False),
        sa.Column("open_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_at", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["folderpath"], ["folders.filepath"]),
        sa.PrimaryKeyConstraint("folderpath"),
    )

    op.create_table(
        "activity_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("activity_type", sa.String(), nullable=False),
        sa.Column("message", sa.String(), nullable=False),
        sa.Column("target_path", sa.String(), nullable=True),
        sa.Column("created_at", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_activity_logs_created_at", "activity_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("idx_activity_logs_created_at", table_name="activity_logs")
    op.drop_table("activity_logs")
    op.drop_table("folder_open_history")
