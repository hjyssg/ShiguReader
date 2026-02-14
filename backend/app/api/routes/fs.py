from __future__ import annotations

import asyncio
import hashlib
import logging
import math
import os
import shutil
import string
import threading
import zipfile
from time import time
from pathlib import Path
from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from app.constants import ARCHIVE_SUFFIXES, AUDIO_SUFFIXES, IMAGE_SUFFIXES, VIDEO_SUFFIXES
from app.core.config import settings
from app.file_processing.archive_lister import list_archive_entries
from app.file_processing.ignore import should_ignore
from app.file_processing.folder_watcher import FolderWatcher
from app.file_processing.name_parser import parse
from app.file_processing.stepwise_extractor import stepwise_extract
from app.index_db.db import get_index_session
from app.index_db.repository import IndexRepository, UpsertFileInput, UpsertFolderInput
from app.services.thumb_service import ThumbService
from app.utils import detect_file_type, get_mime_type

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/fs", tags=["filesystem"])


_active_watchers: dict[str, FolderWatcher] = {}
_watcher_lock = threading.Lock()
_scan_status: dict[str, dict] = {}
_scan_status_lock = threading.Lock()


def _build_thumb_url(path: Path | str) -> str:
    encoded_path = quote(str(path), safe="")
    return f"{settings.API_V1_STR}/fs/thumb?path={encoded_path}"


def _parse_roots() -> list[Path]:
    """Parse FS_ROOTS from settings."""
    if not settings.FS_ROOTS:
        return []
    return [Path(r.strip()).resolve() for r in settings.FS_ROOTS.split(",") if r.strip()]


def _validate_path(path: Path) -> Path:
    """Resolve and validate path."""
    try:
        return path.resolve()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid path: {e}")




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
    image_count: int | None = None  # 压缩包内图片数量
    video_count: int | None = None  # 压缩包内视频数量
    audio_count: int | None = None  # 压缩包内音频数量


class ListResponse(BaseModel):
    items: list[FileSystemItem]


class ScanRequest(BaseModel):
    path: str
    recursive: bool = True


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


class ZipFolderRequest(BaseModel):
    folder_path: str
    output_path: str | None = None


class RenameRequest(BaseModel):
    path: str
    new_name: str


class UnzipRequest(BaseModel):
    archive_path: str
    output_dir: str | None = None


class PathOperationResponse(BaseModel):
    status: Literal["ok"]
    message: str
    path: str
    dest_path: str | None = None


SortBy = Literal["name", "mtime", "type", "recommendation", "image_count"]
SortOrder = Literal["asc", "desc"]


def _compute_recommendation_scores(repo: IndexRepository, filepaths: list[str]) -> dict[str, float]:
    """根据 favorite 目录统计信息计算推荐分数。"""
    if not filepaths:
        return {}

    favorite_dir = (settings.FAVORITE_DIR or "").strip()
    if not favorite_dir:
        return {filepath: 0.0 for filepath in filepaths}

    favorite_prefix = str(Path(favorite_dir).resolve())

    try:
        author_freq = repo.get_favorite_author_frequencies(favorite_prefix)
        tag_freq = repo.get_favorite_tag_frequencies(favorite_prefix)
        tag_total = repo.get_tag_total_counts()

        artists_by_file = repo.get_artists_by_filepaths(filepaths)
        tags_by_file = repo.get_tags_by_filepaths(filepaths)
    except Exception:
        return {filepath: 0.0 for filepath in filepaths}

    scores: dict[str, float] = {}
    for filepath in filepaths:
        authors = artists_by_file.get(filepath, [])
        tags = tags_by_file.get(filepath, [])

        fa = max((author_freq.get(author, 0) for author in authors), default=0)
        author_score = math.log1p(fa)

        tag_score = 0.0
        for tag in tags:
            ft = tag_freq.get(tag, 0)
            nt = max(tag_total.get(tag, 0), 1)
            current = math.log1p(ft) * (1.0 / math.sqrt(nt))
            if current > tag_score:
                tag_score = current

        scores[filepath] = round(author_score + tag_score, 6)

    return scores


def _sort_items(items: list[FileSystemItem], sort_by: SortBy, sort_order: SortOrder) -> None:
    reverse = sort_order == "desc"

    def key_name(x: FileSystemItem):
        return x.name.lower()

    def key_type(x: FileSystemItem):
        return (x.file_type or "unknown", x.name.lower())

    def key_mtime(x: FileSystemItem):
        return x.mtime or 0

    def key_recommendation(x: FileSystemItem):
        return x.recommendation_score or 0.0

    def key_image_count(x: FileSystemItem):
        return x.image_count or 0

    folders = [x for x in items if x.item_type == "folder"]
    files = [x for x in items if x.item_type == "file"]

    folders.sort(key=key_name)

    if sort_by == "type":
        files.sort(key=key_type, reverse=reverse)
    elif sort_by == "mtime":
        files.sort(key=key_mtime, reverse=reverse)
    elif sort_by == "recommendation":
        files.sort(key=key_recommendation, reverse=reverse)
    elif sort_by == "image_count":
        files.sort(key=key_image_count, reverse=reverse)
    else:
        files.sort(key=key_name, reverse=reverse)

    items[:] = folders + files


def trigger_favorite_scan() -> None:
    """启动时异步扫描 favorite 目录，避免阻塞应用启动。"""
    favorite_dir = (settings.FAVORITE_DIR or "").strip()
    if not favorite_dir:
        return

    favorite_path = Path(favorite_dir)
    try:
        resolved = _validate_path(favorite_path)
    except HTTPException:
        logger.warning("Skip favorite scan: invalid favorite path %s", favorite_dir)
        return

    if not resolved.exists() or not resolved.is_dir():
        logger.warning("Skip favorite scan: favorite path not found or not directory: %s", resolved)
        return

    threading.Thread(target=_run_scan, args=(resolved, True), daemon=True).start()


def _update_scan_status(path_key: str, **kwargs) -> None:
    with _scan_status_lock:
        current = _scan_status.get(path_key, {})
        current.update(kwargs)
        _scan_status[path_key] = current


def _build_scan_status_item(path_key: str, record: dict) -> ScanStatusItem:
    normalized = dict(record)
    normalized.setdefault("path", path_key)
    normalized.setdefault("status", "running")
    return ScanStatusItem(**normalized)


def _run_scan(path: Path, recursive: bool) -> None:
    """Recursively (or non-recursively) scan files, upsert DB and parse metadata."""
    path_key = str(path)
    _update_scan_status(
        path_key,
        path=path_key,
        status="running",
        message="Scanning in background",
        recursive=recursive,
        scanned_folders=0,
        scanned_files=0,
        parsed_files=0,
        started_at=int(time()),
        finished_at=None,
    )

    folders_to_upsert: list[UpsertFolderInput] = []
    files_to_upsert: list[UpsertFileInput] = []
    parse_results: list[dict] = []

    scanned_folders = 0
    scanned_files = 0
    parsed_files = 0

    try:
        if recursive:
            for root, dirs, filenames in os.walk(path):
                # Prune ignored directories in-place to skip entire subtrees
                dirs[:] = [d for d in dirs if not should_ignore(d)]
                filenames = [f for f in filenames if not should_ignore(f)]

                root_path = Path(root)
                try:
                    root_stat = root_path.stat()
                    folders_to_upsert.append(
                        UpsertFolderInput(
                            filepath=str(root_path),
                            dirname=root_path.name or str(root_path),
                            mtime=int(root_stat.st_mtime),
                            scan_state=1,
                            watch_state=0,
                            scanned=True,
                        )
                    )
                    scanned_folders += 1
                except Exception as e:
                    logger.warning(f"Failed to stat folder {root_path}: {e}")

                for filename in filenames:
                    file_path = root_path / filename
                    try:
                        stat = file_path.stat()
                        file_type = detect_file_type(file_path)
                        fingerprint = f"{file_path.name}-{stat.st_size}-{int(stat.st_mtime)}"
                        files_to_upsert.append(
                            UpsertFileInput(
                                filepath=str(file_path),
                                filename=file_path.name,
                                mtime=int(stat.st_mtime),
                                filesize=stat.st_size,
                                fingerprint=fingerprint,
                                folderpath=str(root_path),
                                file_type=file_type,
                                ext=file_path.suffix.lower() if file_path.suffix else None,
                                scan_state=1,
                                watch_state=0,
                                scanned=True,
                            )
                        )
                        scanned_files += 1

                        parsed = parse(file_path.name)
                        if parsed is not None:
                            parse_results.append(
                                {
                                    "filepath": str(file_path),
                                    "title": parsed.title,
                                    "authors": parsed.authors,
                                    "group_name": parsed.group,
                                    "raw_tags": parsed.raw_tags,
                                    "event": parsed.event,
                                    "date_tag": parsed.date_tag,
                                    "media_type": parsed.type,
                                }
                            )
                            parsed_files += 1
                    except Exception as e:
                        logger.warning(f"Failed to process file {file_path}: {e}")
        else:
            root_stat = path.stat()
            folders_to_upsert.append(
                UpsertFolderInput(
                    filepath=str(path),
                    dirname=path.name or str(path),
                    mtime=int(root_stat.st_mtime),
                    scan_state=1,
                    watch_state=0,
                    scanned=True,
                )
            )
            scanned_folders += 1

            for entry in path.iterdir():
                if should_ignore(entry.name):
                    continue
                try:
                    stat = entry.stat()
                    if entry.is_dir():
                        folders_to_upsert.append(
                            UpsertFolderInput(
                                filepath=str(entry),
                                dirname=entry.name,
                                mtime=int(stat.st_mtime),
                                scan_state=1,
                                watch_state=0,
                                scanned=False,
                            )
                        )
                    elif entry.is_file():
                        file_type = detect_file_type(entry)
                        fingerprint = f"{entry.name}-{stat.st_size}-{int(stat.st_mtime)}"
                        files_to_upsert.append(
                            UpsertFileInput(
                                filepath=str(entry),
                                filename=entry.name,
                                mtime=int(stat.st_mtime),
                                filesize=stat.st_size,
                                fingerprint=fingerprint,
                                folderpath=str(path),
                                file_type=file_type,
                                ext=entry.suffix.lower() if entry.suffix else None,
                                scan_state=1,
                                watch_state=0,
                                scanned=True,
                            )
                        )
                        scanned_files += 1

                        parsed = parse(entry.name)
                        if parsed is not None:
                            parse_results.append(
                                {
                                    "filepath": str(entry),
                                    "title": parsed.title,
                                    "authors": parsed.authors,
                                    "group_name": parsed.group,
                                    "raw_tags": parsed.raw_tags,
                                    "event": parsed.event,
                                    "date_tag": parsed.date_tag,
                                    "media_type": parsed.type,
                                }
                            )
                            parsed_files += 1
                except Exception as e:
                    logger.warning(f"Failed to process entry {entry}: {e}")

        with get_index_session() as session:
            repo = IndexRepository(session)
            if folders_to_upsert:
                repo.batch_upsert_folders(folders_to_upsert)
            if files_to_upsert:
                repo.batch_upsert_files(files_to_upsert)
            if parse_results:
                repo.batch_save_parse_results(parse_results)

        _update_scan_status(
            path_key,
            status="completed",
            message="Scan completed",
            scanned_folders=scanned_folders,
            scanned_files=scanned_files,
            parsed_files=parsed_files,
            finished_at=int(time()),
        )
    except Exception as e:
        logger.error(f"Scan failed for {path}: {e}")
        _update_scan_status(
            path_key,
            status="error",
            message=f"Scan failed: {e}",
            scanned_folders=scanned_folders,
            scanned_files=scanned_files,
            parsed_files=parsed_files,
            finished_at=int(time()),
        )


@router.get("/roots", response_model=list[RootItem])
async def get_roots() -> list[RootItem]:
    """Get configured root directories."""
    roots = _parse_roots()
    return [
        RootItem(path=str(root), dirname=root.name or str(root))
        for root in roots
    ]


@router.get("/favorite", response_model=RootItem | None)
async def get_favorite_root() -> RootItem | None:
    """Get configured favorite directory as a root-like item."""
    favorite_dir = (settings.FAVORITE_DIR or "").strip()
    if not favorite_dir:
        return None

    path = _validate_path(Path(favorite_dir))
    if not path.exists() or not path.is_dir():
        return None

    return RootItem(path=str(path), dirname=path.name or str(path))


@router.get("/drives", response_model=list[RootItem])
async def get_drives() -> list[RootItem]:
    """Get available drive letters (Windows only)."""
    drives = []
    for letter in string.ascii_uppercase:
        drive_path = Path(f"{letter}:\\")
        if drive_path.exists():
            drives.append(
                RootItem(path=str(drive_path), dirname=f"{letter}:")
            )
    return drives


@router.get("/list", response_model=ListResponse)
async def list_directory(
    background_tasks: BackgroundTasks,
    path: str = Query(..., description="Directory path to list"),
    sort_by: SortBy = Query("name", description="Sort by field"),
    sort_order: SortOrder = Query("asc", description="Sort order"),
    has_video: bool | None = Query(None, description="筛选包含视频的压缩包"),
    has_audio: bool | None = Query(None, description="筛选包含音频的压缩包"),
) -> ListResponse:
    """List contents of a directory."""
    target_path = Path(path)
    validated_path = _validate_path(target_path)
    
    if not validated_path.exists():
        raise HTTPException(status_code=404, detail="Path not found")
    
    if not validated_path.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")
    
    items: list[FileSystemItem] = []
    folders_to_upsert: list[UpsertFolderInput] = []
    files_to_upsert: list[UpsertFileInput] = []
    
    try:
        # Upsert current directory itself
        dir_stat = validated_path.stat()
        folders_to_upsert.append(
            UpsertFolderInput(
                filepath=str(validated_path),
                dirname=validated_path.name or str(validated_path),
                mtime=int(dir_stat.st_mtime),
                scan_state=1,
                watch_state=0,
                scanned=True,
            )
        )
        
        for entry in validated_path.iterdir():
            if should_ignore(entry.name):
                continue
            try:
                stat = entry.stat()
                
                if entry.is_dir():
                    items.append(
                        FileSystemItem(
                            name=entry.name,
                            path=str(entry),
                            item_type="folder",
                            file_type=None,
                            filesize=None,
                            mtime=int(stat.st_mtime),
                            thumbnail_url=None,
                        )
                    )
                    folders_to_upsert.append(
                        UpsertFolderInput(
                            filepath=str(entry),
                            dirname=entry.name,
                            mtime=int(stat.st_mtime),
                            scan_state=1,
                            watch_state=0,
                            scanned=False,
                        )
                    )
                elif entry.is_file():
                    file_type = detect_file_type(entry)
                    thumbnail_url = None
                    
                    if file_type in ("archive", "video", "image"):
                        thumbnail_url = _build_thumb_url(entry)
                    
                    items.append(
                        FileSystemItem(
                            name=entry.name,
                            path=str(entry),
                            item_type="file",
                            file_type=file_type,
                            filesize=stat.st_size,
                            mtime=int(stat.st_mtime),
                            thumbnail_url=thumbnail_url,
                        )
                    )
                    
                    # Prepare file for DB upsert
                    fingerprint = f"{entry.name}-{stat.st_size}-{int(stat.st_mtime)}"
                    files_to_upsert.append(
                        UpsertFileInput(
                            filepath=str(entry),
                            filename=entry.name,
                            mtime=int(stat.st_mtime),
                            filesize=stat.st_size,
                            fingerprint=fingerprint,
                            folderpath=str(validated_path),
                            file_type=file_type,
                            ext=entry.suffix.lower() if entry.suffix else None,
                            scan_state=1,
                            watch_state=0,
                            scanned=False,
                        )
                    )
            except Exception as e:
                logger.warning(f"Failed to process entry {entry}: {e}")
                continue
    except Exception as e:
        logger.error(f"Failed to list directory {validated_path}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list directory: {e}")
    
    try:
        with get_index_session() as session:
            repo = IndexRepository(session)
            
            # 获取推荐分数
            scores = _compute_recommendation_scores(repo, [x.path for x in items if x.item_type == "file"])
            
            # 获取压缩包元数据
            archive_paths = [x.path for x in items if x.item_type == "file" and x.file_type == "archive"]
            archive_meta_map = {}
            if archive_paths:
                try:
                    archive_metas = repo.get_archive_metas_by_filepaths(archive_paths)
                    archive_meta_map = {meta.filepath: meta for meta in archive_metas}
                except Exception as e:
                    logger.warning(f"Failed to get archive metadata: {e}")
            
            # 填充数据
            for item in items:
                if item.item_type == "file":
                    item.recommendation_score = scores.get(item.path, 0.0)
                    
                    # 填充压缩包元数据
                    if item.file_type == "archive":
                        meta = archive_meta_map.get(item.path)
                        if meta:
                            item.image_count = meta.image_file_num
                            item.video_count = meta.video_file_num
                            item.audio_count = meta.music_file_num
    except Exception as e:
        logger.warning(f"Failed to get metadata: {e}")
        for item in items:
            if item.item_type == "file":
                item.recommendation_score = 0.0

    # 应用筛选
    if has_video is not None or has_audio is not None:
        filtered_items = []
        for item in items:
            # 保留文件夹
            if item.item_type == "folder":
                filtered_items.append(item)
                continue
            
            # 保留非压缩包文件
            if item.file_type != "archive":
                filtered_items.append(item)
                continue
            
            # 筛选压缩包
            if has_video is not None:
                has_video_content = (item.video_count or 0) > 0
                if has_video != has_video_content:
                    continue
            
            if has_audio is not None:
                has_audio_content = (item.audio_count or 0) > 0
                if has_audio != has_audio_content:
                    continue
            
            filtered_items.append(item)
        
        items = filtered_items

    _sort_items(items, sort_by, sort_order)
    
    # Batch upsert to DB in background
    def upsert_to_db():
        try:
            with get_index_session() as session:
                repo = IndexRepository(session)
                if folders_to_upsert:
                    repo.batch_upsert_folders(folders_to_upsert)
                if files_to_upsert:
                    repo.batch_upsert_files(files_to_upsert)

                    parse_results: list[dict] = []
                    for file_data in files_to_upsert:
                        try:
                            parsed = parse(file_data.filename)
                            if parsed is None:
                                continue

                            parse_results.append(
                                {
                                    "filepath": file_data.filepath,
                                    "title": parsed.title,
                                    "authors": parsed.authors,
                                    "group_name": parsed.group,
                                    "raw_tags": parsed.raw_tags,
                                    "event": parsed.event,
                                    "date_tag": parsed.date_tag,
                                    "media_type": parsed.type,
                                }
                            )
                        except Exception as e:
                            logger.warning(f"Failed to parse filename {file_data.filename}: {e}")

                    if parse_results:
                        repo.batch_save_parse_results(parse_results)
            logger.info(f"DB upsert completed for {validated_path}: {len(folders_to_upsert)} folders, {len(files_to_upsert)} files")
        except Exception as e:
            logger.error(f"DB upsert failed for {validated_path}: {e}")
    
    background_tasks.add_task(upsert_to_db)
    
    return ListResponse(items=items)


@router.post("/move-file", response_model=PathOperationResponse)
async def move_file(request: MovePathRequest) -> PathOperationResponse:
    source = _validate_path(Path(request.source_path))
    dest = _validate_path(Path(request.dest_path))

    if not source.exists() or not source.is_file():
        raise HTTPException(status_code=404, detail="Source file not found")
    if dest.exists():
        raise HTTPException(status_code=409, detail="Destination already exists")
    if not dest.parent.exists() or not dest.parent.is_dir():
        raise HTTPException(status_code=400, detail="Destination parent is invalid")

    try:
        shutil.move(str(source), str(dest))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=f"Permission denied: {e}")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Move failed: {e}")

    try:
        with get_index_session() as session:
            repo = IndexRepository(session)
            repo.delete_file(str(source))
    except Exception as e:
        logger.warning("DB cleanup failed after move-file %s -> %s: %s", source, dest, e)

    _run_scan(dest.parent, False)
    return PathOperationResponse(status="ok", message="File moved", path=str(source), dest_path=str(dest))


@router.post("/move-folder", response_model=PathOperationResponse)
async def move_folder(request: MovePathRequest) -> PathOperationResponse:
    source = _validate_path(Path(request.source_path))
    dest = _validate_path(Path(request.dest_path))

    if not source.exists() or not source.is_dir():
        raise HTTPException(status_code=404, detail="Source folder not found")
    if dest.exists():
        raise HTTPException(status_code=409, detail="Destination already exists")
    if not dest.parent.exists() or not dest.parent.is_dir():
        raise HTTPException(status_code=400, detail="Destination parent is invalid")

    src_norm = str(source).replace("\\", "/").rstrip("/") + "/"
    dst_norm = str(dest).replace("\\", "/").rstrip("/") + "/"
    if dst_norm.startswith(src_norm):
        raise HTTPException(status_code=400, detail="Cannot move folder into its own subfolder")

    try:
        shutil.move(str(source), str(dest))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=f"Permission denied: {e}")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Move failed: {e}")

    try:
        with get_index_session() as session:
            repo = IndexRepository(session)
            repo.delete_paths_by_prefix(str(source))
    except Exception as e:
        logger.warning("DB cleanup failed after move-folder %s -> %s: %s", source, dest, e)

    _run_scan(dest, True)
    return PathOperationResponse(status="ok", message="Folder moved", path=str(source), dest_path=str(dest))


@router.delete("/delete", response_model=PathOperationResponse)
async def delete_path(request: DeletePathRequest) -> PathOperationResponse:
    target = _validate_path(Path(request.path))

    if not target.exists():
        raise HTTPException(status_code=404, detail="Path not found")

    try:
        if target.is_file():
            target.unlink()
            try:
                with get_index_session() as session:
                    repo = IndexRepository(session)
                    repo.delete_file(str(target))
            except Exception as e:
                logger.warning("DB cleanup failed after delete-file %s: %s", target, e)
            return PathOperationResponse(status="ok", message="File deleted", path=str(target))

        shutil.rmtree(target)
        try:
            with get_index_session() as session:
                repo = IndexRepository(session)
                repo.delete_paths_by_prefix(str(target))
        except Exception as e:
            logger.warning("DB cleanup failed after delete-folder %s: %s", target, e)
        return PathOperationResponse(status="ok", message="Folder deleted", path=str(target))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=f"Permission denied: {e}")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {e}")


@router.post("/zip-folder", response_model=PathOperationResponse)
async def zip_folder(request: ZipFolderRequest) -> PathOperationResponse:
    folder = _validate_path(Path(request.folder_path))
    if not folder.exists() or not folder.is_dir():
        raise HTTPException(status_code=404, detail="Folder not found")

    output_path = _validate_path(Path(request.output_path)) if request.output_path else folder.with_suffix(".zip")
    if output_path.exists():
        raise HTTPException(status_code=409, detail="Output zip already exists")
    if not output_path.parent.exists() or not output_path.parent.is_dir():
        raise HTTPException(status_code=400, detail="Output parent is invalid")

    try:
        with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, filenames in os.walk(folder):
                dirs[:] = [d for d in dirs if not should_ignore(d)]
                for fname in filenames:
                    if should_ignore(fname):
                        continue
                    file = Path(root) / fname
                    zf.write(file, arcname=file.relative_to(folder))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=f"Permission denied: {e}")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Zip failed: {e}")

    return PathOperationResponse(status="ok", message="Folder zipped", path=str(folder), dest_path=str(output_path))


@router.post("/rename", response_model=PathOperationResponse)
async def rename_path(request: RenameRequest) -> PathOperationResponse:
    """重命名文件或文件夹。"""
    source = _validate_path(Path(request.path))
    
    if not source.exists():
        raise HTTPException(status_code=404, detail="Path not found")
    
    # 构建目标路径（同目录下的新名称）
    dest = source.parent / request.new_name
    
    if dest.exists():
        raise HTTPException(status_code=409, detail="Destination already exists")
    
    try:
        source.rename(dest)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=f"Permission denied: {e}")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Rename failed: {e}")
    
    # 更新数据库
    try:
        with get_index_session() as session:
            repo = IndexRepository(session)
            if source.is_file():
                repo.delete_file(str(source))
            else:
                repo.delete_paths_by_prefix(str(source))
    except Exception as e:
        logger.warning("DB cleanup failed after rename %s -> %s: %s", source, dest, e)
    
    # 重新扫描目标路径
    if dest.is_dir():
        _run_scan(dest, True)
    else:
        _run_scan(dest.parent, False)
    
    return PathOperationResponse(status="ok", message="Renamed successfully", path=str(source), dest_path=str(dest))


@router.get("/download", response_model=None)
async def download_file(path: str = Query(..., description="File path to download")):
    """下载单个文件。"""
    target_path = Path(path)
    validated_path = _validate_path(target_path)
    
    if not validated_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    if not validated_path.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")
    
    return FileResponse(
        validated_path,
        media_type=get_mime_type(validated_path),
        filename=validated_path.name,
        headers={"Content-Disposition": f'attachment; filename="{validated_path.name}"'},
    )


@router.post("/unzip", response_model=PathOperationResponse)
async def unzip_archive(request: UnzipRequest) -> PathOperationResponse:
    """解压压缩包到指定目录，保持原始目录结构。"""
    archive = _validate_path(Path(request.archive_path))
    
    if not archive.exists():
        raise HTTPException(status_code=404, detail="Archive not found")
    
    if not archive.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")
    
    file_type = detect_file_type(archive)
    if file_type != "archive":
        raise HTTPException(status_code=400, detail="File is not an archive")
    
    # 默认解压到同名文件夹
    if request.output_dir:
        output_dir = _validate_path(Path(request.output_dir))
    else:
        output_dir = archive.parent / archive.stem
    
    if output_dir.exists():
        raise HTTPException(status_code=409, detail="Output directory already exists")
    
    try:
        output_dir.mkdir(parents=True, exist_ok=False)
        
        with zipfile.ZipFile(archive, "r") as zf:
            # 解压所有文件，保持原始目录结构
            zf.extractall(output_dir)
        
        return PathOperationResponse(
            status="ok",
            message="Archive extracted successfully",
            path=str(archive),
            dest_path=str(output_dir),
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=f"Permission denied: {e}")
    except zipfile.BadZipFile as e:
        raise HTTPException(status_code=400, detail=f"Invalid archive file: {e}")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {e}")


@router.post("/scan-favorite", response_model=ScanStartResponse)
async def scan_favorite(background_tasks: BackgroundTasks) -> ScanStartResponse:
    favorite_dir = (settings.FAVORITE_DIR or "").strip()
    if not favorite_dir:
        raise HTTPException(status_code=400, detail="FAVORITE_DIR is not configured")

    favorite_path = _validate_path(Path(favorite_dir))
    if not favorite_path.exists() or not favorite_path.is_dir():
        raise HTTPException(status_code=404, detail="Favorite directory not found")

    background_tasks.add_task(_run_scan, favorite_path, True)
    return ScanStartResponse(status="started", message="Favorite directory scan started", path=str(favorite_path))


@router.post("/scan", response_model=ScanStartResponse)
async def scan_directory(background_tasks: BackgroundTasks, request: ScanRequest) -> ScanStartResponse:
    """Scan a directory and optionally recurse into subfolders."""
    target_path = Path(request.path)
    validated_path = _validate_path(target_path)

    if not validated_path.exists():
        raise HTTPException(status_code=404, detail="Path not found")

    if not validated_path.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")

    background_tasks.add_task(_run_scan, validated_path, request.recursive)

    return ScanStartResponse(
        status="started",
        message="Scan task started",
        path=str(validated_path),
    )


@router.post("/scan-watch", response_model=ScanStartResponse)
async def scan_and_watch(background_tasks: BackgroundTasks, request: ScanRequest) -> ScanStartResponse:
    """Scan a directory recursively and start watchdog listener."""
    target_path = Path(request.path)
    validated_path = _validate_path(target_path)

    if not validated_path.exists():
        raise HTTPException(status_code=404, detail="Path not found")

    if not validated_path.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")

    path_key = str(validated_path)
    with _watcher_lock:
        watcher = _active_watchers.get(path_key)
        if watcher is None:
            watcher = FolderWatcher(validated_path)
            watcher.start()
            _active_watchers[path_key] = watcher

    _update_scan_status(
        path_key,
        path=path_key,
        status="running",
        message="Scan+watch task starting",
        recursive=request.recursive,
        scanned_folders=0,
        scanned_files=0,
        parsed_files=0,
        watcher_active=True,
        started_at=int(time()),
        finished_at=None,
    )
    background_tasks.add_task(_run_scan, validated_path, request.recursive)

    return ScanStartResponse(
        status="started",
        message="Scan+watch task started",
        path=path_key,
    )


@router.get("/scan-status", response_model=list[ScanStatusItem])
async def get_scan_status(path: str | None = Query(None, description="Optional path filter")) -> list[ScanStatusItem]:
    """Get background scan status for all paths or one path."""
    with _scan_status_lock:
        if path:
            record = _scan_status.get(path)
            if record is None:
                return []
            return [_build_scan_status_item(path, record)]

        return [_build_scan_status_item(path_key, record) for path_key, record in _scan_status.items()]


@router.get("/thumb", response_model=None)
async def get_thumbnail(path: str = Query(..., description="File path for thumbnail")):
    """Get or generate thumbnail for a file."""
    target_path = Path(path)
    validated_path = _validate_path(target_path)
    
    if not validated_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    if not validated_path.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")
    
    file_type = detect_file_type(validated_path)
    
    if file_type not in ("archive", "video", "image"):
        raise HTTPException(status_code=400, detail=f"Thumbnail not supported for file type: {file_type}")
    
    try:
        thumb_service = await ThumbService.get_instance()
        cache_path = await thumb_service.get_or_generate(validated_path)

        # Cache may have been removed externally (e.g. manual cleanup), regenerate once.
        if not cache_path.exists():
            logger.warning(f"Thumbnail cache missing after generation, force regenerate: {validated_path}")
            cache_path = await thumb_service.get_or_generate(validated_path, force=True)

        if not cache_path.exists():
            raise FileNotFoundError(f"Thumbnail cache not found after regeneration: {cache_path}")
        
        media_type = get_mime_type(cache_path)

        return FileResponse(
            cache_path,
            media_type=media_type,
            headers={"Cache-Control": "public, max-age=31536000"},
        )
    except TimeoutError:
        raise HTTPException(status_code=504, detail="Thumbnail generation timeout")
    except Exception as e:
        logger.error(f"Thumbnail generation failed for {validated_path}: {e}")
        raise HTTPException(status_code=500, detail=f"Thumbnail generation failed: {e}")


# Archive-related endpoints


class ArchiveEntry(BaseModel):
    name: str
    entry_path: str
    file_type: Literal["image", "video", "audio", "unknown"]
    index: int


class ArchiveListResponse(BaseModel):
    entries: list[ArchiveEntry]
    total: int


class ExtractStatus(BaseModel):
    status: Literal["extracting", "completed", "error"]
    extracted_count: int
    total_count: int
    cache_dir: str


def _get_extract_cache_dir(archive_path: Path) -> Path:
    """Generate cache directory for extracted archive."""
    stat = archive_path.stat()
    fingerprint = f"{archive_path.name}-{stat.st_size}-{int(stat.st_mtime)}"
    path_hash = hashlib.sha256(str(archive_path.resolve()).encode()).hexdigest()
    
    cache_dir = Path(settings.THUMB_CACHE_DIR).parent / "extract_cache" / path_hash[:2] / path_hash[2:]
    return cache_dir




@router.get("/archive/list", response_model=ArchiveListResponse)
async def list_archive(path: str = Query(..., description="Archive file path")) -> ArchiveListResponse:
    """List contents of an archive file."""
    target_path = Path(path)
    validated_path = _validate_path(target_path)
    
    if not validated_path.exists():
        raise HTTPException(status_code=404, detail="Archive not found")
    
    if not validated_path.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")
    
    file_type = detect_file_type(validated_path)
    if file_type != "archive":
        raise HTTPException(status_code=400, detail="File is not an archive")
    
    try:
        entries = await asyncio.to_thread(list_archive_entries, validated_path)
        
        # Filter and create archive entries (only image, video, audio)
        archive_entries = []
        image_index = 0
        for entry in entries:
            file_type = detect_file_type(entry)
            if file_type in ("image", "video", "audio"):
                archive_entries.append(
                    ArchiveEntry(
                        name=Path(entry).name,
                        entry_path=entry,
                        file_type=file_type,
                        index=image_index,
                    )
                )
                image_index += 1
        
        return ArchiveListResponse(entries=archive_entries, total=len(archive_entries))
    except Exception as e:
        logger.error(f"Failed to list archive {validated_path}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list archive: {e}")


# ---------------------------------------------------------------------------
# 解压任务状态追踪
# 用于避免前端翻页时重复触发解压（幂等性保证）
# ---------------------------------------------------------------------------
_active_extractions: dict[str, bool] = {}
_extraction_lock = threading.Lock()


# ---------------------------------------------------------------------------
# extract_cache 清理
# ---------------------------------------------------------------------------

def _get_extract_cache_root() -> Path:
    """返回 extract_cache 根目录。"""
    return Path(settings.THUMB_CACHE_DIR).parent / "extract_cache"


def _format_bytes(size: int) -> str:
    """将字节数格式化为人类可读的字符串。"""
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


def clear_extract_cache() -> dict:
    """清理所有解压缓存，返回清理统计信息。

    启动时可直接调用（无活跃解压任务）。
    手动触发时会跳过正在解压的缓存目录。
    """
    cache_root = _get_extract_cache_root()
    if not cache_root.exists():
        return {"deleted_files": 0, "freed_bytes": 0}

    # 收集正在解压的 cache_dir，避免误删
    with _extraction_lock:
        active_keys = set(_active_extractions.keys())

    deleted_files = 0
    freed_bytes = 0

    for shard_dir in list(cache_root.iterdir()):
        if not shard_dir.is_dir():
            continue
        for entry_dir in list(shard_dir.iterdir()):
            if not entry_dir.is_dir():
                continue
            if str(entry_dir) in active_keys:
                logger.info("跳过正在解压的缓存: %s", entry_dir)
                continue
            # 统计大小
            for f in entry_dir.rglob("*"):
                if f.is_file():
                    try:
                        freed_bytes += f.stat().st_size
                        deleted_files += 1
                    except OSError:
                        pass
            shutil.rmtree(entry_dir, ignore_errors=True)
        # 清理空的 shard 目录
        try:
            if shard_dir.exists() and not any(shard_dir.iterdir()):
                shard_dir.rmdir()
        except OSError:
            pass

    logger.info("extract_cache 清理完成: 删除 %d 个文件, 释放 %s", deleted_files, _format_bytes(freed_bytes))
    return {"deleted_files": deleted_files, "freed_bytes": freed_bytes}


class ClearCacheResponse(BaseModel):
    status: Literal["ok"]
    message: str
    deleted_files: int
    freed_bytes: int
    freed_size_readable: str


@router.delete("/extract-cache", response_model=ClearCacheResponse)
async def clear_extract_cache_endpoint() -> ClearCacheResponse:
    """清理所有解压缓存（跳过正在解压的目录）。"""
    try:
        result = await asyncio.to_thread(clear_extract_cache)
        return ClearCacheResponse(
            status="ok",
            message="Extract cache cleared successfully",
            deleted_files=result["deleted_files"],
            freed_bytes=result["freed_bytes"],
            freed_size_readable=_format_bytes(result["freed_bytes"]),
        )
    except Exception as e:
        logger.error(f"Failed to clear extract cache: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear cache: {e}")


@router.post("/archive/extract", response_model=ExtractStatus)
async def extract_archive(
    background_tasks: BackgroundTasks,
    path: str = Query(..., description="压缩包文件路径"),
    page: int = Query(0, description="当前页码（基于过滤后的媒体文件列表）"),
) -> ExtractStatus:
    """三阶段优先级解压压缩包。

    阶段 1：当前页（立即可用）
    阶段 2：前后 ±5 页（快速可用）
    阶段 3：剩余文件（后台解压，图片优先）

    此端点是幂等的 — 重复调用不会触发重复解压。
    前端每次翻页都会调用此接口，后端通过 _active_extractions 锁避免重复工作。
    """
    target_path = Path(path)
    validated_path = _validate_path(target_path)

    if not validated_path.exists():
        raise HTTPException(status_code=404, detail="Archive not found")

    file_type = detect_file_type(validated_path)
    if file_type != "archive":
        raise HTTPException(status_code=400, detail="File is not an archive")

    cache_dir = _get_extract_cache_dir(validated_path)
    cache_key = str(cache_dir)

    # ---- 检查是否已经完全解压完成 ----
    if cache_dir.exists():
        try:
            entries = await asyncio.to_thread(list_archive_entries, validated_path)
            extracted_files = list(cache_dir.rglob("*"))
            extracted_count = len([f for f in extracted_files if f.is_file()])

            if extracted_count >= len(entries):
                return ExtractStatus(
                    status="completed",
                    extracted_count=extracted_count,
                    total_count=len(entries),
                    cache_dir=str(cache_dir),
                )
        except Exception as e:
            logger.warning(f"检查解压状态失败: {e}")

    # ---- 检查是否正在解压中（避免重复触发） ----
    with _extraction_lock:
        if cache_key in _active_extractions:
            # 已有解压任务在运行，直接返回当前进度
            try:
                extracted_files = list(cache_dir.rglob("*")) if cache_dir.exists() else []
                extracted_count = len([f for f in extracted_files if f.is_file()])
                return ExtractStatus(
                    status="extracting",
                    extracted_count=extracted_count,
                    total_count=0,
                    cache_dir=str(cache_dir),
                )
            except Exception:
                return ExtractStatus(
                    status="extracting",
                    extracted_count=0,
                    total_count=0,
                    cache_dir=str(cache_dir),
                )

        # 标记为正在解压
        _active_extractions[cache_key] = True

    # ---- 在后台启动三阶段解压 ----
    async def extract_task():
        try:
            # 获取压缩包内所有文件条目
            all_entries = await asyncio.to_thread(list_archive_entries, validated_path)

            # 过滤出媒体文件（与 list_archive 端点保持一致）
            # 前端的 page 索引是基于这个过滤后的列表
            media_entries = [
                e for e in all_entries
                if detect_file_type(e) in ("image", "video", "audio")
            ]

            # 阶段 1：当前页对应的媒体文件
            current_page_entry = [media_entries[page]] if 0 <= page < len(media_entries) else []

            # 阶段 2：前后 ±5 页的媒体文件（排除当前页）
            start_idx = max(0, page - 5)
            end_idx = min(len(media_entries), page + 6)
            secondary = [e for e in media_entries[start_idx:end_idx] if e not in current_page_entry]

            logger.info(
                f"三阶段解压 {validated_path.name}: "
                f"当前页={page}, 次优先={start_idx}-{end_idx}, "
                f"媒体文件={len(media_entries)}, 总文件={len(all_entries)}"
            )

            # 调用 stepwise_extract 执行三阶段解压
            # 注意：传入的是完整的 all_entries 对应的 entry 名称
            # stepwise_extract 内部会自动处理剩余文件（第三阶段）
            await asyncio.to_thread(
                stepwise_extract,
                validated_path,
                cache_dir,
                current_page_entries=current_page_entry,
                secondary_entries=secondary,
            )

            logger.info(f"解压完成: {validated_path.name}")
        except Exception as e:
            logger.error(f"解压失败: {validated_path.name}, 错误: {e}")
        finally:
            # 解压完成或失败后，移除活跃状态
            with _extraction_lock:
                _active_extractions.pop(cache_key, None)

    background_tasks.add_task(extract_task)

    return ExtractStatus(
        status="extracting",
        extracted_count=0,
        total_count=0,
        cache_dir=str(cache_dir),
    )


@router.get("/archive/file", response_model=None)
async def get_archive_file(
    path: str = Query(..., description="Archive file path"),
    entry: str = Query(..., description="Entry path within archive"),
):
    """Get a file from extracted archive cache."""
    target_path = Path(path)
    validated_path = _validate_path(target_path)
    
    if not validated_path.exists():
        raise HTTPException(status_code=404, detail="Archive not found")
    
    cache_dir = _get_extract_cache_dir(validated_path)
    file_path = cache_dir / entry
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not extracted yet")
    
    if not file_path.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")
    
    return FileResponse(file_path, media_type=get_mime_type(file_path))


@router.get("/file", response_model=None)
async def get_file(path: str = Query(..., description="File path")):
    """Serve a file directly from disk."""
    target_path = Path(path)
    validated_path = _validate_path(target_path)
    
    if not validated_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    if not validated_path.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")
    
    return FileResponse(validated_path, media_type=get_mime_type(validated_path))
