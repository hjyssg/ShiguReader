from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class RootItem(BaseModel):
    path: str
    dirname: str


class FileSystemItem(BaseModel):
    name: str
    path: str
    item_type: Literal["folder", "file"]
    file_type: Literal["image", "video", "archive", "audio", "unknown"] | None = None
    filesize: int | None = None
    mtime: int | None = None
    thumbnail_url: str | None = None
    recommendation_score: float | None = None
    scan_state: int = 0  # Reserved for DB integration
    watch_state: int = 0  # Reserved for DB integration
    confidence_level: Literal["certain", "likely_present", "uncertain"] = "uncertain"
    confidence_score: float = 0.2
    image_count: int | None = None  # 压缩包内图片数量
    video_count: int | None = None  # 压缩包内视频数量
    audio_count: int | None = None  # 压缩包内音频数量
    avg_image_size: int | None = None  # 压缩包内图片平均大小（字节）


class ListResponse(BaseModel):
    items: list[FileSystemItem]


class ScanRequest(BaseModel):
    path: str
    recursive: bool = True


class BackfillRequest(BaseModel):
    path: str
    recursive: bool = True
    fill_thumbnail: bool = True
    fill_meta: bool = True


class BackfillResponse(BaseModel):
    status: Literal["ok"]
    scanned_files: int
    backfilled_thumbnails: int
    backfilled_meta: int
    message: str


class ScanStartResponse(BaseModel):
    status: Literal["started"]
    message: str
    path: str


class ScanStatusItem(BaseModel):
    path: str
    status: Literal["running", "completed", "error"]
    message: str | None = None
    recursive: bool = True
    scanned_folders: int = 0
    scanned_files: int = 0
    parsed_files: int = 0
    watcher_active: bool = False
    started_at: int | None = None
    finished_at: int | None = None


class MovePathRequest(BaseModel):
    source_path: str
    dest_path: str


class DeletePathRequest(BaseModel):
    path: str
    permanently: bool = False


class ZipFolderRequest(BaseModel):
    folder_path: str
    output_path: str | None = None


class RenameRequest(BaseModel):
    path: str
    new_name: str


class UnzipRequest(BaseModel):
    archive_path: str
    output_dir: str | None = None


class ActivityItem(BaseModel):
    id: int
    activity_type: Literal["scan", "minify_zip_images", "move", "delete", "rename", "startup", "cache_cleanup", "db_sync"]
    status: Literal["started", "running", "completed", "failed"] = "completed"
    task_key: str | None = None
    message: str
    target_path: str | None = None
    context: dict | None = None
    created_at: int


class RecentActivityResponse(BaseModel):
    items: list[ActivityItem]


class LibraryOverviewResponse(BaseModel):
    archives: int
    videos: int
    images: int
    audio: int
    folders: int


class TopOpenedFoldersResponse(BaseModel):
    folder_ids: list[str]


class PathOperationResponse(BaseModel):
    status: Literal["ok"]
    message: str
    path: str
    dest_path: str | None = None


SortBy = Literal["name", "mtime", "type", "recommendation", "image_count"]
SortOrder = Literal["asc", "desc"]
