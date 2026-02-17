"""add indexes for top opened folders query

Revision ID: 20260217_0003
Revises: 20260217_0002
Create Date: 2026-02-17
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "20260217_0003"
down_revision = "20260217_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "idx_folder_open_history_last_opened_at",
        "folder_open_history",
        ["last_opened_at"],
    )
    op.create_index(
        "idx_progress_last_opened_filepath",
        "progress",
        ["last_opened_at", "filepath"],
    )


def downgrade() -> None:
    op.drop_index("idx_progress_last_opened_filepath", table_name="progress")
    op.drop_index("idx_folder_open_history_last_opened_at", table_name="folder_open_history")
