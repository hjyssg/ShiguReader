"""remove all foreign key constraints from index db

Revision ID: 20260218_0002
Revises: 20260218_0001
Create Date: 2026-02-20
"""

from __future__ import annotations

from alembic import op


revision = "20260218_0002"
down_revision = "20260218_0001"
branch_labels = None
depends_on = None


def _rebuild_files_without_fk() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_files_set_updated_at")
    op.drop_index("idx_files_folderpath_file_type", table_name="files")
    op.drop_index("idx_files_content_hash", table_name="files")
    op.drop_index("idx_files_fingerprint", table_name="files")
    op.drop_index("idx_files_mtime", table_name="files")
    op.drop_index("idx_files_last_seen", table_name="files")
    op.drop_index("idx_files_watch_state", table_name="files")
    op.drop_index("idx_files_scan_state", table_name="files")
    op.drop_index("idx_files_type", table_name="files")
    op.drop_index("idx_files_folderpath", table_name="files")

    op.execute(
        """
CREATE TABLE files_new (
  filepath TEXT NOT NULL PRIMARY KEY,
  folderpath TEXT NULL,
  filename TEXT NOT NULL,
  mtime INTEGER NOT NULL,
  filesize INTEGER NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'unknown',
  ext TEXT NULL,
  thumbnail_filepath TEXT NULL,
  fingerprint TEXT NOT NULL,
  content_hash TEXT NULL,
  scan_state INTEGER NOT NULL DEFAULT 0,
  watch_state INTEGER NOT NULL DEFAULT 0,
  first_seen_at INTEGER NULL,
  last_seen_at INTEGER NULL,
  last_scanned_at INTEGER NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  rec_score FLOAT NOT NULL DEFAULT 0.0,
  CONSTRAINT ck_files_file_type CHECK (file_type IN ('image','video','archive','audio','unknown')),
  CONSTRAINT ck_files_scan_state CHECK (scan_state IN (0,1,2)),
  CONSTRAINT ck_files_watch_state CHECK (watch_state IN (0,1))
)
"""
    )
    op.execute(
        """
INSERT INTO files_new (
  filepath, folderpath, filename, mtime, filesize, file_type, ext,
  thumbnail_filepath, fingerprint, content_hash, scan_state, watch_state,
  first_seen_at, last_seen_at, last_scanned_at, created_at, updated_at, rec_score
)
SELECT
  filepath, folderpath, filename, mtime, filesize, file_type, ext,
  thumbnail_filepath, fingerprint, content_hash, scan_state, watch_state,
  first_seen_at, last_seen_at, last_scanned_at, created_at, updated_at, rec_score
FROM files
"""
    )
    op.execute("DROP TABLE files")
    op.execute("ALTER TABLE files_new RENAME TO files")

    op.create_index("idx_files_folderpath", "files", ["folderpath"])
    op.create_index("idx_files_type", "files", ["file_type"])
    op.create_index("idx_files_scan_state", "files", ["scan_state"])
    op.create_index("idx_files_watch_state", "files", ["watch_state"])
    op.create_index("idx_files_last_seen", "files", ["last_seen_at"])
    op.create_index("idx_files_mtime", "files", ["mtime"])
    op.create_index("idx_files_fingerprint", "files", ["fingerprint"])
    op.create_index("idx_files_content_hash", "files", ["content_hash"])
    op.create_index("idx_files_folderpath_file_type", "files", ["folderpath", "file_type"])
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


def _rebuild_single_pk_table_without_fk(table: str, extra_cols_sql: str, select_cols: str, indexes: list[tuple[str, list[str]]]) -> None:
    for idx_name, _ in indexes:
        op.drop_index(idx_name, table_name=table)

    op.execute(
        f"""
CREATE TABLE {table}_new (
  filepath TEXT NOT NULL PRIMARY KEY,
  {extra_cols_sql}
)
"""
    )
    op.execute(f"INSERT INTO {table}_new SELECT {select_cols} FROM {table}")
    op.execute(f"DROP TABLE {table}")
    op.execute(f"ALTER TABLE {table}_new RENAME TO {table}")

    for idx_name, cols in indexes:
        op.create_index(idx_name, table, cols)


def upgrade() -> None:
    _rebuild_files_without_fk()

    _rebuild_single_pk_table_without_fk(
        table="archive_meta",
        extra_cols_sql="""
  archive_type TEXT NOT NULL,
  entry_count INTEGER NOT NULL DEFAULT 0,
  image_file_num INTEGER NOT NULL DEFAULT 0,
  video_file_num INTEGER NOT NULL DEFAULT 0,
  music_file_num INTEGER NOT NULL DEFAULT 0,
  scanned_at INTEGER NULL
""".strip(),
        select_cols="filepath, archive_type, entry_count, image_file_num, video_file_num, music_file_num, scanned_at",
        indexes=[("idx_archive_meta_scanned_at", ["scanned_at"])],
    )

    _rebuild_single_pk_table_without_fk(
        table="video_meta",
        extra_cols_sql="""
  duration_sec FLOAT NULL,
  width INTEGER NULL,
  height INTEGER NULL,
  fps FLOAT NULL,
  codec TEXT NULL,
  bitrate INTEGER NULL,
  audio_codec TEXT NULL,
  audio_channels INTEGER NULL,
  sample_rate INTEGER NULL,
  has_subtitle INTEGER NOT NULL DEFAULT 0,
  scanned_at INTEGER NULL,
  CONSTRAINT ck_video_meta_has_subtitle CHECK (has_subtitle IN (0,1))
""".strip(),
        select_cols="filepath, duration_sec, width, height, fps, codec, bitrate, audio_codec, audio_channels, sample_rate, has_subtitle, scanned_at",
        indexes=[("idx_video_meta_scanned_at", ["scanned_at"])],
    )

    op.drop_index("idx_folder_open_history_last_opened_at", table_name="folder_open_history")
    op.execute(
        """
CREATE TABLE folder_open_history_new (
  folderpath TEXT NOT NULL PRIMARY KEY,
  last_opened_at INTEGER NOT NULL,
  open_count INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
)
"""
    )
    op.execute(
        """
INSERT INTO folder_open_history_new (folderpath, last_opened_at, open_count, updated_at)
SELECT folderpath, last_opened_at, open_count, updated_at FROM folder_open_history
"""
    )
    op.execute("DROP TABLE folder_open_history")
    op.execute("ALTER TABLE folder_open_history_new RENAME TO folder_open_history")
    op.create_index("idx_folder_open_history_last_opened_at", "folder_open_history", ["last_opened_at"])

    op.drop_index("idx_file_tags_tag_mtime", table_name="file_tags")
    op.drop_index("idx_file_tags_tag_name", table_name="file_tags")
    op.execute(
        """
CREATE TABLE file_tags_new (
  filepath TEXT NOT NULL,
  tag_name TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  PRIMARY KEY (filepath, tag_name)
)
"""
    )
    op.execute(
        """
INSERT INTO file_tags_new (filepath, tag_name, created_at)
SELECT filepath, tag_name, created_at FROM file_tags
"""
    )
    op.execute("DROP TABLE file_tags")
    op.execute("ALTER TABLE file_tags_new RENAME TO file_tags")
    op.create_index("idx_file_tags_tag_name", "file_tags", ["tag_name"])
    op.create_index("idx_file_tags_tag_mtime", "file_tags", ["tag_name", "filepath"])

    op.drop_index("idx_file_artists_role", table_name="file_artists")
    op.drop_index("idx_file_artists_artist_name", table_name="file_artists")
    op.execute(
        """
CREATE TABLE file_artists_new (
  filepath TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  PRIMARY KEY (filepath, artist_name, role)
)
"""
    )
    op.execute(
        """
INSERT INTO file_artists_new (filepath, artist_name, role, created_at)
SELECT filepath, artist_name, role, created_at FROM file_artists
"""
    )
    op.execute("DROP TABLE file_artists")
    op.execute("ALTER TABLE file_artists_new RENAME TO file_artists")
    op.create_index("idx_file_artists_artist_name", "file_artists", ["artist_name"])
    op.create_index("idx_file_artists_role", "file_artists", ["role"])

    op.drop_index("idx_parsed_metadata_media_type", table_name="parsed_metadata")
    op.drop_index("idx_parsed_metadata_group_name", table_name="parsed_metadata")
    op.drop_index("idx_parsed_metadata_event", table_name="parsed_metadata")
    op.execute(
        """
CREATE TABLE parsed_metadata_new (
  filepath TEXT NOT NULL PRIMARY KEY,
  title TEXT NULL,
  group_name TEXT NULL,
  event TEXT NULL,
  date_tag TEXT NULL,
  media_type TEXT NULL,
  parsed_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
)
"""
    )
    op.execute(
        """
INSERT INTO parsed_metadata_new (filepath, title, group_name, event, date_tag, media_type, parsed_at)
SELECT filepath, title, group_name, event, date_tag, media_type, parsed_at FROM parsed_metadata
"""
    )
    op.execute("DROP TABLE parsed_metadata")
    op.execute("ALTER TABLE parsed_metadata_new RENAME TO parsed_metadata")
    op.create_index("idx_parsed_metadata_event", "parsed_metadata", ["event"])
    op.create_index("idx_parsed_metadata_group_name", "parsed_metadata", ["group_name"])
    op.create_index("idx_parsed_metadata_media_type", "parsed_metadata", ["media_type"])


def downgrade() -> None:
    raise NotImplementedError("This migration intentionally removes all foreign keys and does not support downgrade.")
