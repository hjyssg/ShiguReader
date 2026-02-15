"""Add performance indexes for tags and history queries

Revision ID: 20260215_0002
Revises: 20260215_0001_add_rec_score_to_files
Create Date: 2026-02-15 08:33:00

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260215_0002"
down_revision = "20260215_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Index for tags API - file_tags join with files on mtime
    # This helps the window function query for getting latest file per tag
    op.create_index(
        "idx_file_tags_tag_mtime",
        "file_tags",
        ["tag_name", "filepath"],
    )
    
    # Composite index for files mtime queries
    # Already have idx_files_mtime, but this one is specifically for tag thumbnail queries
    # The existing idx_files_mtime should be sufficient
    
    # Index for progress history queries - already exists as idx_progress_last_opened
    # No additional indexes needed for history


def downgrade() -> None:
    op.drop_index("idx_file_tags_tag_mtime", table_name="file_tags")