"""Make progress history retention-friendly

Revision ID: 20260213_0003
Revises: 20260213_0002
Create Date: 2026-02-13 18:30:00
"""

from alembic import op


revision = "20260213_0003"
down_revision = "20260213_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
CREATE TABLE IF NOT EXISTS progress_new (
  filepath TEXT PRIMARY KEY NOT NULL,
  filename TEXT NULL,
  file_type TEXT NULL,
  filesize INTEGER NULL,
  mtime INTEGER NULL,
  thumbnail_url TEXT NULL,
  last_opened_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  total_time_sec FLOAT NOT NULL DEFAULT 0,
  page_current INTEGER NULL,
  page_total INTEGER NULL,
  position_sec FLOAT NULL,
  duration_sec FLOAT NULL,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
)
"""
    )

    op.execute(
        """
INSERT OR REPLACE INTO progress_new (
  filepath,
  filename,
  file_type,
  filesize,
  mtime,
  thumbnail_url,
  last_opened_at,
  total_time_sec,
  page_current,
  page_total,
  position_sec,
  duration_sec,
  updated_at
)
SELECT
  p.filepath,
  f.filename,
  f.file_type,
  f.filesize,
  f.mtime,
  CASE WHEN f.filepath IS NOT NULL THEN '/api/v1/fs/thumb?path=' || replace(replace(replace(f.filepath, '%', '%25'), ' ', '%20'), '#', '%23') ELSE NULL END,
  p.last_opened_at,
  p.total_time_sec,
  p.page_current,
  p.page_total,
  p.position_sec,
  p.duration_sec,
  p.updated_at
FROM progress p
LEFT JOIN files f ON f.filepath = p.filepath
"""
    )

    op.execute("DROP TABLE progress")
    op.execute("ALTER TABLE progress_new RENAME TO progress")
    op.create_index("idx_progress_last_opened", "progress", ["last_opened_at"])

    op.execute("DROP TRIGGER IF EXISTS trg_progress_set_updated_at")
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
    op.drop_index("idx_progress_last_opened", table_name="progress")

    op.execute(
        """
CREATE TABLE IF NOT EXISTS progress_old (
  filepath TEXT PRIMARY KEY NOT NULL,
  last_opened_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  total_time_sec FLOAT NOT NULL DEFAULT 0,
  page_current INTEGER NULL,
  page_total INTEGER NULL,
  position_sec FLOAT NULL,
  duration_sec FLOAT NULL,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  FOREIGN KEY(filepath) REFERENCES files(filepath) ON DELETE CASCADE
)
"""
    )

    op.execute(
        """
INSERT OR REPLACE INTO progress_old (
  filepath,
  last_opened_at,
  total_time_sec,
  page_current,
  page_total,
  position_sec,
  duration_sec,
  updated_at
)
SELECT
  filepath,
  last_opened_at,
  total_time_sec,
  page_current,
  page_total,
  position_sec,
  duration_sec,
  updated_at
FROM progress
"""
    )

    op.execute("DROP TABLE progress")
    op.execute("ALTER TABLE progress_old RENAME TO progress")
    op.create_index("idx_progress_last_opened", "progress", ["last_opened_at"])

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
