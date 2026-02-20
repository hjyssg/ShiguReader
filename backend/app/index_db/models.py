from __future__ import annotations

from sqlmodel import Field, SQLModel

# scan_state / watch_state 状态位约定：
# - 0: inactive（当前不在该状态）
# - 1: active（当前在该状态）
#
# scan_state: 是否在最近一次文件系统扫描中“确认存在/可见”
# watch_state: 是否处于目录监听（watcher）覆盖范围
STATE_INACTIVE = 0
STATE_ACTIVE = 1


def _ts_now() -> int:
    """统一的秒级时间戳默认值工厂。"""
    from time import time

    return int(time())


class Folder(SQLModel, table=True):
    __tablename__ = "folders"

    filepath: str = Field(primary_key=True)  # 目录绝对路径（主键）
    dirname: str  # 目录名（basename）
    mtime: int | None = None  # 目录最后修改时间（秒级 Unix 时间戳）

    scan_state: int = Field(default=STATE_INACTIVE)  # 0=未确认存在，1=扫描确认存在
    watch_state: int = Field(default=STATE_INACTIVE)  # 0=未监听，1=已在 watcher 监听范围

    first_seen_at: int | None = None  # 首次被扫描发现时间
    last_seen_at: int | None = None  # 最近一次“仍存在”确认时间
    last_scanned_at: int | None = None  # 最近一次被主动扫描时间

    created_at: int = Field(default_factory=_ts_now)  # 记录创建时间
    updated_at: int = Field(default_factory=_ts_now)  # 记录更新时间


class File(SQLModel, table=True):
    __tablename__ = "files"

    filepath: str = Field(primary_key=True)  # 文件绝对路径（主键）
    folderpath: str | None = Field(default=None)  # 所属目录路径

    filename: str  # 文件名（basename）
    mtime: int  # 文件最后修改时间（秒级 Unix 时间戳）
    filesize: int  # 文件大小（字节）

    file_type: str = Field(default="unknown")  # 业务类型：image/video/archive/audio/unknown
    ext: str | None = None  # 扩展名（小写，含点）
    thumbnail_filepath: str | None = None  # 缩略图缓存路径（本地）

    fingerprint: str  # 轻量指纹（通常由 name-size-mtime 组成）
    content_hash: str | None = None  # 内容哈希（可选；大多数流程不依赖）

    rec_score: float = Field(default=0.0)  # 推荐分数（用于排序）

    scan_state: int = Field(default=STATE_INACTIVE)  # 0=未确认存在，1=扫描确认存在
    watch_state: int = Field(default=STATE_INACTIVE)  # 0=未监听，1=已在 watcher 监听范围

    first_seen_at: int | None = None  # 首次被扫描发现时间
    last_seen_at: int | None = None  # 最近一次“仍存在”确认时间
    last_scanned_at: int | None = None  # 最近一次被主动扫描时间

    created_at: int = Field(default_factory=_ts_now)  # 记录创建时间
    updated_at: int = Field(default_factory=_ts_now)  # 记录更新时间


class ArchiveMeta(SQLModel, table=True):
    __tablename__ = "archive_meta"

    filepath: str = Field(primary_key=True)
    archive_type: str
    entry_count: int = 0
    image_file_num: int = 0
    video_file_num: int = 0
    music_file_num: int = 0
    scanned_at: int | None = None


class VideoMeta(SQLModel, table=True):
    __tablename__ = "video_meta"

    filepath: str = Field(primary_key=True)

    duration_sec: float | None = None
    width: int | None = None
    height: int | None = None
    fps: float | None = None

    codec: str | None = None
    bitrate: int | None = None

    audio_codec: str | None = None
    audio_channels: int | None = None
    sample_rate: int | None = None

    has_subtitle: int = 0  # 0=无字幕，1=有字幕
    scanned_at: int | None = None  # 视频元信息扫描时间


class FolderOpenHistory(SQLModel, table=True):
    __tablename__ = "folder_open_history"

    folderpath: str = Field(primary_key=True)
    last_opened_at: int = Field(default_factory=_ts_now)
    open_count: int = 1
    updated_at: int = Field(default_factory=_ts_now)


class ActivityLog(SQLModel, table=True):
    __tablename__ = "activity_logs"

    id: int | None = Field(default=None, primary_key=True)
    activity_type: str
    status: str = Field(default="completed")
    task_key: str | None = None
    message: str
    target_path: str | None = None
    context_json: str | None = None
    created_at: int = Field(default_factory=_ts_now)

class Progress(SQLModel, table=True):
    __tablename__ = "progress"

    filepath: str = Field(primary_key=True)
    filename: str | None = None
    file_type: str | None = None
    filesize: int | None = None
    mtime: int | None = None
    thumbnail_url: str | None = None
    last_opened_at: int = Field(default_factory=_ts_now)  # 最近打开时间
    total_time_sec: float = 0  # 累计阅读/播放时长（秒）

    page_current: int | None = None  # 当前页（图像/文档）
    page_total: int | None = None  # 总页数

    position_sec: float | None = None  # 当前播放位置（秒）
    duration_sec: float | None = None  # 媒体总时长（秒）

    updated_at: int = Field(default_factory=_ts_now)  # 进度更新时间


class Tag(SQLModel, table=True):
    __tablename__ = "tags"

    tag_name: str = Field(primary_key=True)


class FileTag(SQLModel, table=True):
    __tablename__ = "file_tags"

    filepath: str = Field(primary_key=True)
    tag_name: str = Field(primary_key=True)
    created_at: int = Field(default_factory=_ts_now)


class Artist(SQLModel, table=True):
    __tablename__ = "artists"

    artist_name: str = Field(primary_key=True)


class FileArtist(SQLModel, table=True):
    __tablename__ = "file_artists"

    filepath: str = Field(primary_key=True)
    artist_name: str = Field(primary_key=True)
    role: str = Field(default="", primary_key=True)
    created_at: int = Field(default_factory=_ts_now)


class ParsedMetadata(SQLModel, table=True):
    __tablename__ = "parsed_metadata"

    filepath: str = Field(primary_key=True)
    title: str | None = None
    group_name: str | None = None
    event: str | None = None
    date_tag: str | None = None
    media_type: str | None = None
    parsed_at: int = Field(default_factory=_ts_now)
