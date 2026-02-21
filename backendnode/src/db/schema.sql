-- ShiguReader index database schema

CREATE TABLE IF NOT EXISTS folders (
  filepath TEXT PRIMARY KEY,
  dirname TEXT NOT NULL,
  mtime INTEGER,
  last_seen_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS files (
  filepath TEXT PRIMARY KEY,
  folderpath TEXT,
  filename TEXT NOT NULL,
  mtime INTEGER NOT NULL,
  filesize INTEGER NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'unknown',
  ext TEXT,
  thumbnail_filepath TEXT,
  rec_score REAL NOT NULL DEFAULT 0.0,
  is_missing INTEGER NOT NULL DEFAULT 0,
  last_seen_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_files_folderpath ON files(folderpath);
CREATE INDEX IF NOT EXISTS idx_files_filename ON files(filename);
CREATE INDEX IF NOT EXISTS idx_files_file_type ON files(file_type);
CREATE INDEX IF NOT EXISTS idx_files_is_missing ON files(is_missing);

CREATE TABLE IF NOT EXISTS archive_meta (
  filepath TEXT PRIMARY KEY,
  archive_type TEXT NOT NULL,
  entry_count INTEGER NOT NULL DEFAULT 0,
  image_file_num INTEGER NOT NULL DEFAULT 0,
  video_file_num INTEGER NOT NULL DEFAULT 0,
  music_file_num INTEGER NOT NULL DEFAULT 0,
  scanned_at INTEGER,
  version_sig TEXT,
  cover_entry TEXT,
  index_status TEXT NOT NULL DEFAULT 'fresh'
);

CREATE TABLE IF NOT EXISTS video_meta (
  filepath TEXT PRIMARY KEY,
  duration_sec REAL,
  width INTEGER,
  height INTEGER,
  fps REAL,
  codec TEXT,
  bitrate INTEGER,
  audio_codec TEXT,
  audio_channels INTEGER,
  sample_rate INTEGER,
  has_subtitle INTEGER NOT NULL DEFAULT 0,
  scanned_at INTEGER
);

CREATE TABLE IF NOT EXISTS folder_open_history (
  folderpath TEXT PRIMARY KEY,
  last_opened_at INTEGER NOT NULL DEFAULT (unixepoch()),
  open_count INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  task_key TEXT,
  message TEXT NOT NULL,
  target_path TEXT,
  context_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS progress (
  filepath TEXT PRIMARY KEY,
  filename TEXT,
  file_type TEXT,
  filesize INTEGER,
  mtime INTEGER,
  thumbnail_url TEXT,
  last_opened_at INTEGER NOT NULL DEFAULT (unixepoch()),
  total_time_sec REAL NOT NULL DEFAULT 0,
  page_current INTEGER,
  page_total INTEGER,
  position_sec REAL,
  duration_sec REAL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS tags (
  tag_name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS file_tags (
  filepath TEXT NOT NULL,
  tag_name TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (filepath, tag_name)
);

CREATE INDEX IF NOT EXISTS idx_file_tags_tag ON file_tags(tag_name);

CREATE TABLE IF NOT EXISTS artists (
  artist_name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS file_artists (
  filepath TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (filepath, artist_name, role)
);

CREATE INDEX IF NOT EXISTS idx_file_artists_artist ON file_artists(artist_name);
CREATE INDEX IF NOT EXISTS idx_file_artists_role ON file_artists(role);
CREATE INDEX IF NOT EXISTS idx_file_artists_role_artist ON file_artists(role, artist_name);

-- Additional performance indexes
CREATE INDEX IF NOT EXISTS idx_files_rec_score ON files(rec_score);
CREATE INDEX IF NOT EXISTS idx_files_folderpath_file_type ON files(folderpath, file_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_activity_type ON activity_logs(activity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_progress_last_opened_at ON progress(last_opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_folder_open_history_last_opened_at ON folder_open_history(last_opened_at);

CREATE TABLE IF NOT EXISTS parsed_metadata (
  filepath TEXT PRIMARY KEY,
  title TEXT,
  group_name TEXT,
  event TEXT,
  date_tag TEXT,
  media_type TEXT,
  parsed_at INTEGER NOT NULL DEFAULT (unixepoch())
);
