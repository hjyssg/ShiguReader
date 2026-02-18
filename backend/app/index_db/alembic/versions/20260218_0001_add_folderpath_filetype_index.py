"""add composite index for folderpath+file_type to speed up /fs/list

Revision ID: 20260218_0001
Revises: 20260217_0003
Create Date: 2026-02-18
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "20260218_0001"
down_revision = "20260217_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Composite index for get_archive_metas_by_folder subquery:
    #   SELECT filepath FROM files WHERE folderpath=? AND file_type='archive'
    op.create_index(
        "idx_files_folderpath_file_type",
        "files",
        ["folderpath", "file_type"],
    )


def downgrade() -> None:
    op.drop_index("idx_files_folderpath_file_type", table_name="files")
