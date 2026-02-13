from __future__ import annotations

from sqlmodel import Field, SQLModel


def _ts_now() -> int:
    from time import time

    return int(time())


class Folder(SQLModel, table=True):
    __tablename__ = "folders"

    filepath: str = Field(primary_key=True)
    dirname: str
    mtime: int | None = None

    scan_state: int = Field(default=0)
    watch_state: int = Field(default=0)

    first_seen_at: int | None = None
    last_seen_at: int | None = None
    last_scanned_at: int | None = None

    created_at: int = Field(default_factory=_ts_now)
    updated_at: int = Field(default_factory=_ts_now)


class File(SQLModel, table=True):
    __tablename__ = "files"

    filepath: str = Field(primary_key=True)
    folderpath: str | None = Field(default=None, foreign_key="folders.filepath")

    filename: str
    mtime: int
    filesize: int

    file_type: str = Field(default="unknown")
    ext: str | None = None
    thumbnail_filepath: str | None = None

    fingerprint: str
    content_hash: str | None = None

    scan_state: int = Field(default=0)
    watch_state: int = Field(default=0)

    first_seen_at: int | None = None
    last_seen_at: int | None = None
    last_scanned_at: int | None = None

    created_at: int = Field(default_factory=_ts_now)
    updated_at: int = Field(default_factory=_ts_now)


class ArchiveMeta(SQLModel, table=True):
    __tablename__ = "archive_meta"

    filepath: str = Field(primary_key=True, foreign_key="files.filepath")
    archive_type: str
    entry_count: int = 0
    image_file_num: int = 0
    video_file_num: int = 0
    music_file_num: int = 0
    scanned_at: int | None = None


class VideoMeta(SQLModel, table=True):
    __tablename__ = "video_meta"

    filepath: str = Field(primary_key=True, foreign_key="files.filepath")

    duration_sec: float | None = None
    width: int | None = None
    height: int | None = None
    fps: float | None = None

    codec: str | None = None
    bitrate: int | None = None

    audio_codec: str | None = None
    audio_channels: int | None = None
    sample_rate: int | None = None

    has_subtitle: int = 0
    scanned_at: int | None = None


class Progress(SQLModel, table=True):
    __tablename__ = "progress"

    filepath: str = Field(primary_key=True)
    filename: str | None = None
    file_type: str | None = None
    filesize: int | None = None
    mtime: int | None = None
    thumbnail_url: str | None = None
    last_opened_at: int = Field(default_factory=_ts_now)
    total_time_sec: float = 0

    page_current: int | None = None
    page_total: int | None = None

    position_sec: float | None = None
    duration_sec: float | None = None

    updated_at: int = Field(default_factory=_ts_now)


class Tag(SQLModel, table=True):
    __tablename__ = "tags"

    tag_name: str = Field(primary_key=True)


class FileTag(SQLModel, table=True):
    __tablename__ = "file_tags"

    filepath: str = Field(primary_key=True, foreign_key="files.filepath")
    tag_name: str = Field(primary_key=True, foreign_key="tags.tag_name")
    created_at: int = Field(default_factory=_ts_now)


class Artist(SQLModel, table=True):
    __tablename__ = "artists"

    artist_name: str = Field(primary_key=True)


class FileArtist(SQLModel, table=True):
    __tablename__ = "file_artists"

    filepath: str = Field(primary_key=True, foreign_key="files.filepath")
    artist_name: str = Field(primary_key=True, foreign_key="artists.artist_name")
    role: str = Field(default="", primary_key=True)
    created_at: int = Field(default_factory=_ts_now)


class ParsedMetadata(SQLModel, table=True):
    __tablename__ = "parsed_metadata"

    filepath: str = Field(primary_key=True, foreign_key="files.filepath")
    title: str | None = None
    group_name: str | None = None
    event: str | None = None
    date_tag: str | None = None
    media_type: str | None = None
    parsed_at: int = Field(default_factory=_ts_now)
