"""Initialize index db schema

Revision ID: 20260213_0001
Revises:
Create Date: 2026-02-13 01:18:00

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260213_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "folders",
        sa.Column("filepath", sa.Text(), nullable=False),
        sa.Column("dirname", sa.Text(), nullable=False),
        sa.Column("mtime", sa.Integer(), nullable=True),
        sa.Column("scan_state", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("watch_state", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("first_seen_at", sa.Integer(), nullable=True),
        sa.Column("last_seen_at", sa.Integer(), nullable=True),
        sa.Column("last_scanned_at", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("(strftime('%s','now'))"),
        ),
        sa.Column(
            "updated_at",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("(strftime('%s','now'))"),
        ),
        sa.CheckConstraint("scan_state IN (0,1,2)", name="ck_folders_scan_state"),
        sa.CheckConstraint("watch_state IN (0,1)", name="ck_folders_watch_state"),
        sa.PrimaryKeyConstraint("filepath"),
    )

    op.create_index("idx_folders_dirname", "folders", ["dirname"])
    op.create_index("idx_folders_scan_state", "folders", ["scan_state"])
    op.create_index("idx_folders_watch_state", "folders", ["watch_state"])
    op.create_index("idx_folders_last_seen", "folders", ["last_seen_at"])

    op.create_table(
        "files",
        sa.Column("filepath", sa.Text(), nullable=False),
        sa.Column("folderpath", sa.Text(), nullable=True),
        sa.Column("filename", sa.Text(), nullable=False),
        sa.Column("mtime", sa.Integer(), nullable=False),
        sa.Column("filesize", sa.Integer(), nullable=False),
        sa.Column("file_type", sa.Text(), nullable=False, server_default="unknown"),
        sa.Column("ext", sa.Text(), nullable=True),
        sa.Column("thumbnail_filepath", sa.Text(), nullable=True),
        sa.Column("fingerprint", sa.Text(), nullable=False),
        sa.Column("content_hash", sa.Text(), nullable=True),
        sa.Column("scan_state", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("watch_state", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("first_seen_at", sa.Integer(), nullable=True),
        sa.Column("last_seen_at", sa.Integer(), nullable=True),
        sa.Column("last_scanned_at", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("(strftime('%s','now'))"),
        ),
        sa.Column(
            "updated_at",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("(strftime('%s','now'))"),
        ),
        sa.CheckConstraint(
            "file_type IN ('image','video','archive','audio','unknown')",
            name="ck_files_file_type",
        ),
        sa.CheckConstraint("scan_state IN (0,1,2)", name="ck_files_scan_state"),
        sa.CheckConstraint("watch_state IN (0,1)", name="ck_files_watch_state"),
        sa.PrimaryKeyConstraint("filepath"),
    )

    op.create_index("idx_files_folderpath", "files", ["folderpath"])
    op.create_index("idx_files_type", "files", ["file_type"])
    op.create_index("idx_files_scan_state", "files", ["scan_state"])
    op.create_index("idx_files_watch_state", "files", ["watch_state"])
    op.create_index("idx_files_last_seen", "files", ["last_seen_at"])
    op.create_index("idx_files_mtime", "files", ["mtime"])
    op.create_index("idx_files_fingerprint", "files", ["fingerprint"])
    op.create_index("idx_files_content_hash", "files", ["content_hash"])

    op.create_table(
        "archive_meta",
        sa.Column("filepath", sa.Text(), nullable=False),
        sa.Column("archive_type", sa.Text(), nullable=False),
        sa.Column("entry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("image_file_num", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("video_file_num", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("music_file_num", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("scanned_at", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("filepath"),
    )
    op.create_index("idx_archive_meta_scanned_at", "archive_meta", ["scanned_at"])

    op.create_table(
        "video_meta",
        sa.Column("filepath", sa.Text(), nullable=False),
        sa.Column("duration_sec", sa.Float(), nullable=True),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("fps", sa.Float(), nullable=True),
        sa.Column("codec", sa.Text(), nullable=True),
        sa.Column("bitrate", sa.Integer(), nullable=True),
        sa.Column("audio_codec", sa.Text(), nullable=True),
        sa.Column("audio_channels", sa.Integer(), nullable=True),
        sa.Column("sample_rate", sa.Integer(), nullable=True),
        sa.Column("has_subtitle", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("scanned_at", sa.Integer(), nullable=True),
        sa.CheckConstraint("has_subtitle IN (0,1)", name="ck_video_meta_has_subtitle"),
        sa.PrimaryKeyConstraint("filepath"),
    )
    op.create_index("idx_video_meta_scanned_at", "video_meta", ["scanned_at"])

    op.create_table(
        "progress",
        sa.Column("filepath", sa.Text(), nullable=False),
        sa.Column(
            "last_opened_at",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("(strftime('%s','now'))"),
        ),
        sa.Column("total_time_sec", sa.Float(), nullable=False, server_default="0"),
        sa.Column("page_current", sa.Integer(), nullable=True),
        sa.Column("page_total", sa.Integer(), nullable=True),
        sa.Column("position_sec", sa.Float(), nullable=True),
        sa.Column("duration_sec", sa.Float(), nullable=True),
        sa.Column(
            "updated_at",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("(strftime('%s','now'))"),
        ),
        sa.PrimaryKeyConstraint("filepath"),
    )
    op.create_index("idx_progress_last_opened", "progress", ["last_opened_at"])

    op.create_table("tags", sa.Column("tag_name", sa.Text(), nullable=False), sa.PrimaryKeyConstraint("tag_name"))

    op.create_table(
        "file_tags",
        sa.Column("filepath", sa.Text(), nullable=False),
        sa.Column("tag_name", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("(strftime('%s','now'))"),
        ),
        sa.PrimaryKeyConstraint("filepath", "tag_name"),
    )
    op.create_index("idx_file_tags_tag_name", "file_tags", ["tag_name"])

    op.create_table(
        "artists",
        sa.Column("artist_name", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("artist_name"),
    )

    op.create_table(
        "file_artists",
        sa.Column("filepath", sa.Text(), nullable=False),
        sa.Column("artist_name", sa.Text(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "created_at",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("(strftime('%s','now'))"),
        ),
        sa.PrimaryKeyConstraint("filepath", "artist_name", "role"),
    )
    op.create_index("idx_file_artists_artist_name", "file_artists", ["artist_name"])
    op.create_index("idx_file_artists_role", "file_artists", ["role"])

    op.execute(
        """
CREATE TRIGGER IF NOT EXISTS trg_folders_set_updated_at
AFTER UPDATE ON folders
FOR EACH ROW
BEGIN
  UPDATE folders
     SET updated_at = strftime('%s','now')
   WHERE filepath = NEW.filepath;
END;
"""
    )

    op.execute(
        """
CREATE TRIGGER IF NOT EXISTS trg_files_set_updated_at
AFTER UPDATE ON files
FOR EACH ROW
BEGIN
  UPDATE files
     SET updated_at = strftime('%s','now')
   WHERE filepath = NEW.filepath;
END;
"""
    )

    op.execute(
        """
CREATE TRIGGER IF NOT EXISTS trg_progress_set_updated_at
AFTER UPDATE ON progress
FOR EACH ROW
BEGIN
  UPDATE progress
     SET updated_at = strftime('%s','now')
   WHERE filepath = NEW.filepath;
END;
"""
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_progress_set_updated_at")
    op.execute("DROP TRIGGER IF EXISTS trg_files_set_updated_at")
    op.execute("DROP TRIGGER IF EXISTS trg_folders_set_updated_at")

    op.drop_index("idx_file_artists_role", table_name="file_artists")
    op.drop_index("idx_file_artists_artist_name", table_name="file_artists")
    op.drop_table("file_artists")
    op.drop_table("artists")

    op.drop_index("idx_file_tags_tag_name", table_name="file_tags")
    op.drop_table("file_tags")
    op.drop_table("tags")

    op.drop_index("idx_progress_last_opened", table_name="progress")
    op.drop_table("progress")

    op.drop_index("idx_video_meta_scanned_at", table_name="video_meta")
    op.drop_table("video_meta")

    op.drop_index("idx_archive_meta_scanned_at", table_name="archive_meta")
    op.drop_table("archive_meta")

    op.drop_index("idx_files_content_hash", table_name="files")
    op.drop_index("idx_files_fingerprint", table_name="files")
    op.drop_index("idx_files_mtime", table_name="files")
    op.drop_index("idx_files_last_seen", table_name="files")
    op.drop_index("idx_files_watch_state", table_name="files")
    op.drop_index("idx_files_scan_state", table_name="files")
    op.drop_index("idx_files_type", table_name="files")
    op.drop_index("idx_files_folderpath", table_name="files")
    op.drop_table("files")

    op.drop_index("idx_folders_last_seen", table_name="folders")
    op.drop_index("idx_folders_watch_state", table_name="folders")
    op.drop_index("idx_folders_scan_state", table_name="folders")
    op.drop_index("idx_folders_dirname", table_name="folders")
    op.drop_table("folders")
