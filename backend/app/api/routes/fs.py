from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import stat as stat_module
import shutil
import string
import threading
import zipfile
from dataclasses import dataclass
from collections.abc import Iterable
from time import time
from time import sleep
import json
from pathlib import Path
from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from send2trash import send2trash
from sqlmodel import select

from app.api.routes.fs_models import (
    ActivityItem,
    BackfillRequest,
    BackfillResponse,
    DeletePathRequest,
    FileSystemItem,
    LibraryOverviewResponse,
    ListResponse,
    MovePathRequest,
    PathOperationResponse,
    RecentActivityResponse,
    RenameRequest,
    RootItem,
    ScanRequest,
    ScanStartResponse,
    ScanStatusItem,
    SortBy,
    SortOrder,
    TopOpenedFoldersResponse,
    UnzipRequest,
    ZipFolderRequest,
)
from app.api.routes.fs_recommendation import (
    refresh_all_rec_scores as _refresh_all_rec_scores,
    refresh_rec_cache as _refresh_rec_cache,
    update_rec_scores_for_files as _update_rec_scores_for_files,
)
from app.constants import ARCHIVE_SUFFIXES, AUDIO_SUFFIXES, IMAGE_SUFFIXES, VIDEO_SUFFIXES
from app.core.config import settings
from app.file_processing._archive_backend import extract_entries
from app.file_processing.archive_lister import list_archive_entries
from app.file_processing.ignore import should_ignore
from app.file_processing.folder_watcher import FolderWatcher
from app.file_processing.name_parser import parse
from app.file_processing.stepwise_extractor import stepwise_extract
from app.index_db.confidence import compute_confidence
from app.index_db.db import get_index_session
from app.index_db.models import File, Folder
from app.index_db.repository import ActivityLogInput, IndexRepository, UpsertFileInput, UpsertFolderInput
from app.services.file_sync_roots import derive_minimal_scan_roots, is_filesystem_root, normalize_allowed_roots
from app.services.thumb_service import ThumbService
from app.utils import detect_file_type, get_mime_type

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/fs", tags=["filesystem"])


_active_watchers: dict[str, FolderWatcher] = {}
_watcher_lock = threading.Lock()
_scan_status: dict[str, dict] = {}
_scan_status_lock = threading.Lock()
_SCAN_DB_BATCH_SIZE = 500
_SYNC_LOW_PRIORITY_SLEEP_EVERY = 500
_SYNC_LOW_PRIORITY_SLEEP_SEC = 0.001
_SCAN_SNAPSHOT_TTL_SEC = 300


@dataclass(slots=True)
class ScanSnapshot:
    root: str
    recursive: bool
    created_at: float
    files: dict[str, tuple[int, int]]


_scan_snapshot_lock = threading.Lock()
_scan_snapshot_cache: dict[str, ScanSnapshot] = {}
_scan_live_cache: dict[str, dict[str, tuple[int, int]]] = {}

_TARGET_SUFFIXES = tuple(
    sorted({*IMAGE_SUFFIXES, *VIDEO_SUFFIXES, *ARCHIVE_SUFFIXES, *AUDIO_SUFFIXES}, key=len, reverse=True)
)


def _build_thumb_url(path: Path | str) -> str:
    encoded_path = quote(str(path), safe="")
    return f"{settings.API_V1_STR}/fs/thumb?path={encoded_path}"



def _log_activity(
    activity_type: str,
    message: str,
    target_path: str | None = None,
    *,
    status: Literal["started", "running", "completed", "failed"] = "completed",
    task_key: str | None = None,
    context: dict[str, object] | None = None,
) -> None:
    try:
        with get_index_session() as session:
            repo = IndexRepository(session)
            latest = repo.list_activity_logs(limit=1)
            if latest:
                prev = latest[0]
                if (
                    prev.activity_type == activity_type
                    and prev.status == status
                    and prev.message == message
                    and prev.task_key == task_key
                    and int(time()) - int(prev.created_at) <= 3
                ):
                    return

            repo.log_activity(
                ActivityLogInput(
                    activity_type=activity_type,
                    status=status,
                    task_key=task_key,
                    message=message,
                    target_path=target_path,
                    context=context,
                )
            )
            repo.cleanup_activity_logs(keep_latest=500)
    except Exception as e:
        logger.warning("log activity failed: %s", e)


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


def _build_permission_denied_detail(operation: str, target: Path, error: PermissionError) -> str:
    """构建更可调试的权限错误信息。"""
    errno_value = getattr(error, "errno", None)
    winerror_value = getattr(error, "winerror", None)
    strerror_value = getattr(error, "strerror", None)
    filename_value = getattr(error, "filename", None)

    parts = [
        f"{operation} failed (permission denied)",
        f"path={target}",
    ]
    if filename_value:
        parts.append(f"filename={filename_value}")
    if errno_value is not None:
        parts.append(f"errno={errno_value}")
    if winerror_value is not None:
        parts.append(f"winerror={winerror_value}")
    if strerror_value:
        parts.append(f"reason={strerror_value}")
    else:
        parts.append(f"reason={error}")

    # Windows 常见：winerror=32（文件被其他进程占用）
    if winerror_value == 32:
        parts.append("hint=file is likely in use by another process")

    return "; ".join(parts)


def _probe_zip_media_stats(archive_path: Path) -> tuple[int, int, int, int | None]:
    """统计 zip 内媒体数量，并按图片条目实际字节计算平均图片大小。"""
    image_file_num = 0
    video_file_num = 0
    music_file_num = 0
    image_total_size = 0

    with zipfile.ZipFile(archive_path, "r") as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            file_type = detect_file_type(info.filename)
            if file_type == "image":
                image_file_num += 1
                image_total_size += max(0, int(info.file_size))
            elif file_type == "video":
                video_file_num += 1
            elif file_type == "audio":
                music_file_num += 1

    avg_image_size = image_total_size // image_file_num if image_file_num > 0 else None
    return image_file_num, video_file_num, music_file_num, avg_image_size




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

    def key_last_read_at(x: FileSystemItem):
        return x.last_read_at or 0

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
    elif sort_by == "last_read_at":
        files.sort(key=key_last_read_at, reverse=reverse)
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

    # 先用已有 DB 数据预热 rec 缓存，这样 scan 完成前 list 也能用
    try:
        with get_index_session() as session:
            _refresh_rec_cache(IndexRepository(session))
    except Exception as e:
        logger.warning("Failed to warm rec cache on startup: %s", e)

    _log_activity("scan", f"开始启动扫描任务: {resolved}", str(resolved), status="started", task_key=f"scan:{resolved}")
    threading.Thread(target=_run_scan, args=(resolved, True), daemon=True).start()


def trigger_file_db_sync() -> None:
    """启动时后台同步 file 表与真实文件系统（低优先级，不阻塞 API）。"""

    _log_activity("db_sync", "开始同步文件索引表", status="started", task_key="startup:db_sync")
    threading.Thread(target=_sync_file_table_with_filesystem, daemon=True, name="file-db-sync").start()


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
    _log_activity("scan", f"开始扫描: {path_key}", path_key, status="running", task_key=f"scan:{path_key}")

    folders_to_upsert: list[UpsertFolderInput] = []
    files_to_upsert: list[UpsertFileInput] = []
    parse_results: list[dict] = []

    scanned_folders = 0
    scanned_files = 0
    parsed_files = 0
    scanned_filepaths: list[str] = []
    live_snapshot: dict[str, tuple[int, int]] = {}

    with _scan_snapshot_lock:
        _scan_live_cache[path_key] = live_snapshot

    def _flush_scan_batch(repo: IndexRepository) -> None:
        nonlocal folders_to_upsert, files_to_upsert, parse_results
        if folders_to_upsert:
            repo.batch_upsert_folders(folders_to_upsert, batch_size=_SCAN_DB_BATCH_SIZE)
            folders_to_upsert = []
        if files_to_upsert:
            repo.batch_upsert_files(files_to_upsert, batch_size=_SCAN_DB_BATCH_SIZE)
            files_to_upsert = []
        if parse_results:
            repo.batch_save_parse_results(parse_results, batch_size=_SCAN_DB_BATCH_SIZE)
            parse_results = []

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
                        scanned_filepaths.append(str(file_path))
                        live_snapshot[str(file_path)] = (int(stat.st_size), int(stat.st_mtime))
                        scanned_files += 1

                        parsed = parse(file_path.name)
                        if parsed is not None:
                            parse_results.append(
                                {
                                    "filepath": str(file_path),
                                    "title": parsed.title,
                                    "authors": parsed.authors,
                                    "cosers": parsed.cosers,
                                    "group_name": parsed.group,
                                    "raw_tags": parsed.raw_tags,
                                    "event": parsed.event,
                                    "date_tag": parsed.date_tag,
                                    "media_type": parsed.type,
                                }
                            )
                            parsed_files += 1

                        if (
                            len(folders_to_upsert) >= _SCAN_DB_BATCH_SIZE
                            or len(files_to_upsert) >= _SCAN_DB_BATCH_SIZE
                            or len(parse_results) >= _SCAN_DB_BATCH_SIZE
                        ):
                            # Stability-first: avoid opening many short-lived write sessions
                            # during scan; flush at the final write stage instead.
                            pass

                        if scanned_files % 100 == 0:
                            logger.info(f"Scanning {path_key}: {scanned_files} files, {scanned_folders} folders...")
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
                        scanned_filepaths.append(str(entry))
                        live_snapshot[str(entry)] = (int(stat.st_size), int(stat.st_mtime))
                        scanned_files += 1

                        parsed = parse(entry.name)
                        if parsed is not None:
                            parse_results.append(
                                {
                                    "filepath": str(entry),
                                    "title": parsed.title,
                                    "authors": parsed.authors,
                                    "cosers": parsed.cosers,
                                    "group_name": parsed.group,
                                    "raw_tags": parsed.raw_tags,
                                    "event": parsed.event,
                                    "date_tag": parsed.date_tag,
                                    "media_type": parsed.type,
                                }
                            )
                            parsed_files += 1

                        if (
                            len(folders_to_upsert) >= _SCAN_DB_BATCH_SIZE
                            or len(files_to_upsert) >= _SCAN_DB_BATCH_SIZE
                            or len(parse_results) >= _SCAN_DB_BATCH_SIZE
                        ):
                            # Stability-first: avoid opening many short-lived write sessions
                            # during scan; flush at the final write stage instead.
                            pass

                        if scanned_files % 100 == 0:
                            logger.info(f"Scanning {path_key}: {scanned_files} files, {scanned_folders} folders...")
                except Exception as e:
                    logger.warning(f"Failed to process entry {entry}: {e}")

        with get_index_session() as session:
            repo = IndexRepository(session)
            _flush_scan_batch(repo)

            # --- 更新 rec_score ---
            favorite_dir = (settings.FAVORITE_DIR or "").strip()
            is_favorite_scan = False
            if favorite_dir:
                fav_prefix = str(Path(favorite_dir).resolve())
                is_favorite_scan = str(path).startswith(fav_prefix)

            if is_favorite_scan:
                # favorite 目录变化 → 刷新全局缓存 + 全量重算
                _refresh_all_rec_scores(repo)
            elif scanned_filepaths:
                # 非 favorite scan → 只给新文件算分数
                _update_rec_scores_for_files(repo, scanned_filepaths)

        _update_scan_status(
            path_key,
            status="completed",
            message="Scan completed",
            scanned_folders=scanned_folders,
            scanned_files=scanned_files,
            parsed_files=parsed_files,
            finished_at=int(time()),
        )
        _log_activity(
            "scan",
            f"扫描完成: {path_key}",
            path_key,
            status="completed",
            task_key=f"scan:{path_key}",
            context={"scanned_folders": scanned_folders, "scanned_files": scanned_files, "parsed_files": parsed_files},
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
        _log_activity(
            "scan",
            f"扫描失败: {path_key}",
            path_key,
            status="failed",
            task_key=f"scan:{path_key}",
            context={"error": str(e), "scanned_folders": scanned_folders, "scanned_files": scanned_files},
        )
    finally:
        with _scan_snapshot_lock:
            current_live = _scan_live_cache.pop(path_key, live_snapshot)
            _scan_snapshot_cache[path_key] = ScanSnapshot(
                root=path_key,
                recursive=recursive,
                created_at=time(),
                files=dict(current_live),
            )


def _is_target_extension(name: str) -> bool:
    lowered = name.lower()
    return any(lowered.endswith(suffix) for suffix in _TARGET_SUFFIXES)


def _snapshot_covers_root(snapshot_root: str, root: Path) -> bool:
    snapshot_path = Path(snapshot_root)
    return root == snapshot_path or root.is_relative_to(snapshot_path)


def _collect_cached_scan_for_root(root: Path) -> dict[str, tuple[int, int]] | None:
    """复用已有扫描任务的 live/snapshot 结果，避免重复 IO。"""
    now_ts = time()
    with _scan_snapshot_lock:
        for snapshot_root, live_map in _scan_live_cache.items():
            if _snapshot_covers_root(snapshot_root, root):
                prefix = str(root)
                return {p: stat for p, stat in live_map.items() if p == prefix or p.startswith(prefix + os.sep)}

        stale_keys = [k for k, s in _scan_snapshot_cache.items() if now_ts - s.created_at > _SCAN_SNAPSHOT_TTL_SEC]
        for key in stale_keys:
            _scan_snapshot_cache.pop(key, None)

        for snapshot in _scan_snapshot_cache.values():
            if _snapshot_covers_root(snapshot.root, root):
                prefix = str(root)
                return {p: stat for p, stat in snapshot.files.items() if p == prefix or p.startswith(prefix + os.sep)}
    return None


def _should_skip_sync_path(path: Path) -> bool:
    """
    file-sync 的硬编码跳过规则（Windows 兼容/历史目录）。

    这些目录经常包含重解析点/循环别名（如 Local Settings -> Application Data -> ...），
    会触发 WinError 1921 / 非法路径。业务上也不应纳入媒体索引扫描。
    """
    normalized = str(path).replace("\\", "/").lower()
    skip_fragments = (
        "/temporary internet files/",
        "/content.ie5/",
        "/local settings/application data/",
        "/appdata/local/microsoft/windows/inetcache/",
    )
    return any(fragment in normalized for fragment in skip_fragments)


def _has_windows_reparse_point(path: Path | str) -> bool:
    """Windows 下判断路径是否为 reparse point（junction/symlink 等）。"""
    if os.name != "nt":
        return False
    try:
        st = os.lstat(path)
    except OSError:
        return False
    attrs = getattr(st, "st_file_attributes", 0)
    reparse_flag = getattr(stat_module, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
    return bool(attrs & reparse_flag)


def _is_link_or_reparse(path: Path | str) -> bool:
    """统一判断符号链接/重解析点，避免扫描进入别名目录或循环路径。"""
    p = Path(path)
    try:
        if p.is_symlink():
            return True
    except OSError:
        pass
    return _has_windows_reparse_point(p)


def _collect_allowed_sync_roots() -> list[Path]:
    """收集 file-sync 允许扫描的根目录白名单。"""
    candidates: list[Path] = []
    candidates.extend(_parse_roots())

    for optional_dir in (settings.FAVORITE_DIR, settings.ALREADY_READ_DIR):
        if optional_dir and optional_dir.strip():
            try:
                candidates.append(Path(optional_dir.strip()).resolve())
            except Exception:
                logger.warning("[file-sync] skip invalid allowed root config: %s", optional_dir)

    existing_candidates: list[Path] = []
    for candidate in candidates:
        try:
            resolved = candidate.resolve()
        except Exception:
            continue
        if not resolved.exists() or not resolved.is_dir():
            continue
        if is_filesystem_root(resolved):
            logger.warning(
                "[file-sync] skip allowed root because filesystem root is forbidden: %s",
                resolved,
            )
            continue

        existing_candidates.append(resolved)

    return normalize_allowed_roots(existing_candidates)


def _scan_root_with_scandir(root: Path) -> dict[str, tuple[int, int]]:
    """使用 os.scandir 递归扫描目录，仅收集目标扩展文件。"""
    files: dict[str, tuple[int, int]] = {}
    pending: list[Path] = [root]
    visited = 0

    while pending:
        current = pending.pop()
        if is_filesystem_root(current):
            logger.warning("[file-sync] skip filesystem root directory: %s", current)
            continue
        if _should_skip_sync_path(current):
            logger.info("[file-sync] skip system path: %s", current)
            continue

        try:
            with os.scandir(current) as entries:
                for entry in entries:
                    try:
                        name = entry.name
                        if _is_link_or_reparse(entry.path):
                            logger.info("[file-sync] skip link/reparse entry: %s", entry.path)
                            continue
                        if entry.is_dir(follow_symlinks=False):
                            if name.startswith(".") or should_ignore(name):
                                continue
                            dir_path = Path(entry.path)
                            if is_filesystem_root(dir_path):
                                logger.warning("[file-sync] skip filesystem root directory: %s", dir_path)
                                continue
                            if _should_skip_sync_path(dir_path):
                                continue
                            pending.append(dir_path)
                            continue

                        if not entry.is_file(follow_symlinks=False):
                            continue
                        if should_ignore(name) or not _is_target_extension(name):
                            continue

                        stat = entry.stat(follow_symlinks=False)
                        files[entry.path] = (int(stat.st_size), int(stat.st_mtime))
                        visited += 1
                        if visited % _SYNC_LOW_PRIORITY_SLEEP_EVERY == 0:
                            sleep(_SYNC_LOW_PRIORITY_SLEEP_SEC)
                    except (FileNotFoundError, NotADirectoryError, PermissionError, OSError, ValueError) as e:
                        logger.warning("[file-sync] skip invalid entry: %s (%s)", getattr(entry, "path", current), e)
                        continue
        except (FileNotFoundError, NotADirectoryError, PermissionError, OSError, ValueError) as e:
            logger.warning("[file-sync] skip invalid directory: %s (%s)", current, e)
            continue

    with _scan_snapshot_lock:
        _scan_snapshot_cache[str(root)] = ScanSnapshot(
            root=str(root),
            recursive=True,
            created_at=time(),
            files=dict(files),
        )
    return files




def _should_update_existing_file(
    db_size: int,
    db_mtime: int,
    db_scan_state: int,
    real_size: int,
    real_mtime: int,
) -> bool:
    """文件仍存在时，元数据变化或曾被标记删除都应回写。"""
    return db_size != real_size or db_mtime != real_mtime or db_scan_state == 0


def _build_folder_sync_mappings(
    real_filepaths: set[str],
    db_folder_paths: set[str],
    now_ts: int,
) -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    """基于真实文件集合生成 folders 的批量插入/更新映射。"""
    real_folder_paths = {str(Path(filepath).parent) for filepath in real_filepaths}

    to_insert_folders: list[dict[str, object]] = []
    for folderpath in real_folder_paths - db_folder_paths:
        folder = Path(folderpath)
        to_insert_folders.append(
            {
                "filepath": folderpath,
                "dirname": folder.name or folderpath,
                "mtime": None,
                "scan_state": 1,
                "watch_state": 0,
                "first_seen_at": now_ts,
                "last_seen_at": now_ts,
                "last_scanned_at": now_ts,
                "created_at": now_ts,
                "updated_at": now_ts,
            }
        )

    to_update_folders = [
        {
            "filepath": folderpath,
            "scan_state": 1,
            "last_seen_at": now_ts,
            "last_scanned_at": now_ts,
            "updated_at": now_ts,
        }
        for folderpath in (real_folder_paths & db_folder_paths)
    ]

    return to_insert_folders, to_update_folders

def _sync_file_table_with_filesystem() -> None:
    """同步 files 表与真实文件系统。真实文件系统是唯一真相。"""
    started = time()
    _log_activity("db_sync", "文件索引同步进行中", status="running", task_key="startup:db_sync")
    try:
        with get_index_session() as session:
            repo = IndexRepository(session)
            db_rows = list(session.exec(select(File.filepath, File.filesize, File.mtime, File.scan_state)).all())
            db_folder_paths = set(session.exec(select(Folder.filepath)).all())

            if not db_rows:
                logger.info("[file-sync] skip: no records in file table")
                return

            db_map: dict[str, tuple[int, int, int]] = {fp: (int(size), int(mtime), int(scan_state)) for fp, size, mtime, scan_state in db_rows}
            allowed_roots = _collect_allowed_sync_roots()
            root_dirs = derive_minimal_scan_roots(
                db_map.keys(),
                allowed_roots=allowed_roots,
            )

            real_map: dict[str, tuple[int, int]] = {}
            for root_dir in root_dirs:
                if not root_dir.exists() or not root_dir.is_dir():
                    continue

                cached = _collect_cached_scan_for_root(root_dir)
                if cached is not None:
                    real_map.update(cached)
                    continue

                scanned = _scan_root_with_scandir(root_dir)
                real_map.update(scanned)

            db_paths = set(db_map.keys())
            real_paths = set(real_map.keys())

            new_paths = real_paths - db_paths
            deleted_paths = db_paths - real_paths
            common_paths = db_paths & real_paths

            now_ts = int(time())
            to_insert: list[dict[str, object]] = []
            for filepath in new_paths:
                path = Path(filepath)
                size, mtime = real_map[filepath]
                to_insert.append(
                    {
                        "filepath": filepath,
                        "folderpath": str(path.parent),
                        "filename": path.name,
                        "mtime": mtime,
                        "filesize": size,
                        "file_type": detect_file_type(path),
                        "ext": path.suffix.lower() if path.suffix else None,
                        "thumbnail_filepath": None,
                        "fingerprint": f"{path.name}-{size}-{mtime}",
                        "content_hash": None,
                        "rec_score": 0.0,
                        "scan_state": 1,
                        "watch_state": 0,
                        "first_seen_at": now_ts,
                        "last_seen_at": now_ts,
                        "last_scanned_at": now_ts,
                        "created_at": now_ts,
                        "updated_at": now_ts,
                    }
                )

            changed_paths = {
                filepath
                for filepath in common_paths
                if _should_update_existing_file(
                    db_size=db_map[filepath][0],
                    db_mtime=db_map[filepath][1],
                    db_scan_state=db_map[filepath][2],
                    real_size=real_map[filepath][0],
                    real_mtime=real_map[filepath][1],
                )
            }

            to_update_changed: list[dict[str, object]] = []
            for filepath in changed_paths:
                path = Path(filepath)
                size, mtime = real_map[filepath]
                to_update_changed.append(
                    {
                        "filepath": filepath,
                        "folderpath": str(path.parent),
                        "filename": path.name,
                        "mtime": mtime,
                        "filesize": size,
                        "file_type": detect_file_type(path),
                        "ext": path.suffix.lower() if path.suffix else None,
                        "fingerprint": f"{path.name}-{size}-{mtime}",
                        "scan_state": 1,
                        "last_seen_at": now_ts,
                        "last_scanned_at": now_ts,
                        "updated_at": now_ts,
                    }
                )

            to_mark_deleted = [
                {
                    "filepath": filepath,
                    "scan_state": 0,
                    "updated_at": now_ts,
                }
                for filepath in deleted_paths
                if db_map[filepath][2] != 0
            ]

            to_insert_folders, to_update_folders = _build_folder_sync_mappings(real_paths, db_folder_paths, now_ts)

            if to_insert_folders:
                session.bulk_insert_mappings(Folder, to_insert_folders)
            if to_update_folders:
                session.bulk_update_mappings(Folder, to_update_folders)

            if to_insert:
                session.bulk_insert_mappings(File, to_insert)
            if to_update_changed:
                session.bulk_update_mappings(File, to_update_changed)
            if to_mark_deleted:
                session.bulk_update_mappings(File, to_mark_deleted)
            if to_insert_folders or to_update_folders or to_insert or to_update_changed or to_mark_deleted:
                repo._commit()

            elapsed = time() - started
            logger.info(
                "[file-sync] roots=%d scanned_files=%d new=%d deleted=%d changed=%d elapsed=%.3fs",
                len(root_dirs),
                len(real_map),
                len(to_insert),
                len(to_mark_deleted),
                len(to_update_changed),
                elapsed,
            )
            _log_activity(
                "db_sync",
                "文件索引同步完成",
                status="completed",
                task_key="startup:db_sync",
                context={"roots": len(root_dirs), "scanned_files": len(real_map), "new": len(to_insert), "deleted": len(to_mark_deleted), "changed": len(to_update_changed), "elapsed_sec": round(elapsed, 3)},
            )
    except Exception as e:
        _log_activity("db_sync", "文件索引同步失败", status="failed", task_key="startup:db_sync", context={"error": str(e)})
        logger.error("[file-sync] failed: %s", e)


def _iter_files_for_backfill(path: Path, recursive: bool):
    """Yield files under a directory for backfill operation."""
    if recursive:
        for root, dirs, filenames in os.walk(path):
            dirs[:] = [d for d in dirs if not should_ignore(d)]
            filenames = [f for f in filenames if not should_ignore(f)]
            root_path = Path(root)
            for filename in filenames:
                file_path = root_path / filename
                if file_path.is_file():
                    yield file_path
        return

    for entry in path.iterdir():
        if should_ignore(entry.name):
            continue
        if entry.is_file():
            yield entry


# 接口说明：获取可浏览的根目录列表。
@router.get("/roots", response_model=list[RootItem])
def get_roots() -> list[RootItem]:
    """Get configured root directories."""
    roots = _parse_roots()
    return [
        RootItem(path=str(root), dirname=root.name or str(root))
        for root in roots
    ]


# 接口说明：获取收藏目录信息。
@router.get("/favorite", response_model=RootItem | None)
def get_favorite_root() -> RootItem | None:
    """Get configured favorite directory as a root-like item."""
    favorite_dir = (settings.FAVORITE_DIR or "").strip()
    if not favorite_dir:
        return None

    path = _validate_path(Path(favorite_dir))
    if not path.exists() or not path.is_dir():
        return None

    return RootItem(path=str(path), dirname=path.name or str(path))


# 接口说明：获取已读目录信息。
@router.get("/already-read", response_model=RootItem | None)
def get_already_read_root() -> RootItem | None:
    """Get configured already-read directory as a root-like item."""
    already_read_dir = (settings.ALREADY_READ_DIR or "").strip()
    if not already_read_dir:
        return None

    path = _validate_path(Path(already_read_dir))
    if not path.exists() or not path.is_dir():
        return None

    return RootItem(path=str(path), dirname=path.name or str(path))


# 接口说明：获取系统可用盘符（Windows）。
@router.get("/drives", response_model=list[RootItem])
def get_drives() -> list[RootItem]:
    """Get available drive letters (Windows only)."""
    drives = []
    for letter in string.ascii_uppercase:
        drive_path = Path(f"{letter}:\\")
        if drive_path.exists():
            drives.append(
                RootItem(path=str(drive_path), dirname=f"{letter}:")
            )
    return drives


# 接口说明：列出目录内容并返回文件元信息。
@router.get("/list", response_model=ListResponse)
def list_directory(
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

    # record_folder_open 移到后台，避免阻塞响应
    def _bg_record_open():
        try:
            with get_index_session() as session:
                repo = IndexRepository(session)
                repo.record_folder_open(str(validated_path))
        except Exception as e:
            logger.warning("record folder open failed for %s: %s", validated_path, e)
    background_tasks.add_task(_bg_record_open)

    items: list[FileSystemItem] = []
    folders_to_upsert: list[UpsertFolderInput] = []
    files_to_upsert: list[UpsertFileInput] = []
    
    # 预计算 now_ts，避免每个 entry 都调 time()
    now_ts = int(time())
    
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
        
        # 用 os.scandir() 替代 iterdir() + stat()，减少系统调用
        with os.scandir(validated_path) as entries:
            for entry in entries:
                # 先检查 ignore，避免无用的 lstat 调用
                if should_ignore(entry.name):
                    continue
                
                # 检查是否为链接/重解析点
                if _is_link_or_reparse(entry.path):
                    continue
                
                try:
                    # scandir 的 entry.stat() 在 Windows 上已缓存，不会额外系统调用
                    stat = entry.stat(follow_symlinks=False)
                    
                    if entry.is_dir(follow_symlinks=False):
                        confidence_level, confidence_score = compute_confidence(
                            scan_state=1,
                            watch_state=0,
                            last_seen_at=now_ts,
                            now_ts=now_ts,
                        )
                        items.append(
                            FileSystemItem(
                                name=entry.name,
                                path=entry.path,
                                item_type="folder",
                                file_type=None,
                                filesize=None,
                                mtime=int(stat.st_mtime),
                                thumbnail_url=None,
                                scan_state=1,
                                watch_state=0,
                                confidence_level=confidence_level,
                                confidence_score=confidence_score,
                            )
                        )
                        folders_to_upsert.append(
                            UpsertFolderInput(
                                filepath=entry.path,
                                dirname=entry.name,
                                mtime=int(stat.st_mtime),
                                scan_state=1,
                                watch_state=0,
                                scanned=False,
                            )
                        )
                    elif entry.is_file(follow_symlinks=False):
                        # 直接用字符串操作检测文件类型，避免创建 Path 对象
                        name_lower = entry.name.lower()
                        file_type = "unknown"
                        for suffix in IMAGE_SUFFIXES:
                            if name_lower.endswith(suffix):
                                file_type = "image"
                                break
                        if file_type == "unknown":
                            for suffix in VIDEO_SUFFIXES:
                                if name_lower.endswith(suffix):
                                    file_type = "video"
                                    break
                        if file_type == "unknown":
                            for suffix in ARCHIVE_SUFFIXES:
                                if name_lower.endswith(suffix):
                                    file_type = "archive"
                                    break
                        if file_type == "unknown":
                            for suffix in AUDIO_SUFFIXES:
                                if name_lower.endswith(suffix):
                                    file_type = "audio"
                                    break
                        
                        thumbnail_url = None
                        confidence_level, confidence_score = compute_confidence(
                            scan_state=1,
                            watch_state=0,
                            last_seen_at=now_ts,
                            now_ts=now_ts,
                        )
                        
                        if file_type in ("archive", "video", "image"):
                            thumbnail_url = _build_thumb_url(entry.path)
                        
                        items.append(
                            FileSystemItem(
                                name=entry.name,
                                path=entry.path,
                                item_type="file",
                                file_type=file_type,
                                filesize=stat.st_size,
                                mtime=int(stat.st_mtime),
                                thumbnail_url=thumbnail_url,
                                scan_state=1,
                                watch_state=0,
                                confidence_level=confidence_level,
                                confidence_score=confidence_score,
                            )
                        )
                        
                        # Prepare file for DB upsert
                        # 获取扩展名（避免 Path 对象）
                        ext = None
                        if "." in entry.name:
                            ext = "." + entry.name.rsplit(".", 1)[1].lower()
                        
                        fingerprint = f"{entry.name}-{stat.st_size}-{int(stat.st_mtime)}"
                        files_to_upsert.append(
                            UpsertFileInput(
                                filepath=entry.path,
                                filename=entry.name,
                                mtime=int(stat.st_mtime),
                                filesize=stat.st_size,
                                fingerprint=fingerprint,
                                folderpath=str(validated_path),
                                file_type=file_type,
                                ext=ext,
                                scan_state=1,
                                watch_state=0,
                                scanned=False,
                            )
                        )
                except Exception as e:
                    logger.warning(f"Failed to process entry {entry.name}: {e}")
                    continue
    except Exception as e:
        logger.error(f"Failed to list directory {validated_path}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list directory: {e}")
    
    # 用 folderpath 等值查询替代 IN(...)，只需 1-2 次 SQL
    folderpath_str = str(validated_path)
    try:
        with get_index_session() as session:
            repo = IndexRepository(session)

            # 1 次 SQL: 查出目录下所有文件的 rec_score
            file_data_map = repo.get_file_data_by_folder(folderpath_str)

            # 1 次 SQL (子查询): 查出目录下所有压缩包的 archive_meta
            archive_meta_map = repo.get_archive_metas_by_folder(folderpath_str)

            # 收集没有 DB 缓存的压缩包路径，后台回填
            archives_missing_meta: list[str] = []

            # 填充数据
            for item in items:
                if item.item_type == "file":
                    fdata = file_data_map.get(item.path)
                    item.recommendation_score = fdata["rec_score"] if fdata else 0.0
                    item.last_read_at = fdata["last_read_at"] if fdata else None

                    if item.file_type == "archive":
                        meta = archive_meta_map.get(item.path)
                        if meta:
                            # DB 已有缓存，直接使用，不再打开压缩包
                            item.image_count = meta.image_file_num
                            item.video_count = meta.video_file_num
                            item.audio_count = meta.music_file_num
                            item.avg_image_size = None  # avg_image_size 仅在需要时按需计算
                        else:
                            # DB 无缓存：先给默认值让排序/筛选可用，后台异步回填
                            item.image_count = 0
                            item.video_count = 0
                            item.audio_count = 0
                            item.avg_image_size = None
                            archives_missing_meta.append(item.path)
    except Exception as e:
        logger.warning(f"Failed to get metadata: {e}")
        for item in items:
            if item.item_type == "file":
                item.recommendation_score = 0.0
                item.last_read_at = None

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
                                    "cosers": parsed.cosers,
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

                # 后台回填缺失的 archive_meta（避免阻塞 list 响应）
                for archive_path_str in archives_missing_meta:
                    try:
                        ap = Path(archive_path_str)
                        if ap.suffix.lower() == ".zip":
                            img_n, vid_n, aud_n, _ = _probe_zip_media_stats(ap)
                        else:
                            entries = list_archive_entries(ap)
                            img_n = vid_n = aud_n = 0
                            for ent in entries:
                                et = detect_file_type(ent)
                                if et == "image":
                                    img_n += 1
                                elif et == "video":
                                    vid_n += 1
                                elif et == "audio":
                                    aud_n += 1
                        repo.upsert_archive_meta(
                            filepath=archive_path_str,
                            archive_type=ap.suffix.lower().lstrip("."),
                            entry_count=img_n + vid_n + aud_n,
                            image_file_num=img_n,
                            video_file_num=vid_n,
                            music_file_num=aud_n,
                        )
                    except Exception as e:
                        logger.warning("bg backfill archive meta failed for %s: %s", archive_path_str, e)

            logger.info(f"DB upsert completed for {validated_path}: {len(folders_to_upsert)} folders, {len(files_to_upsert)} files")
        except Exception as e:
            logger.error(f"DB upsert failed for {validated_path}: {e}")
    
    background_tasks.add_task(upsert_to_db)
    
    return ListResponse(items=items)


# 接口说明：根据文件名查找文件的最新路径（用于文件被移动后的重定向）。
class ResolvePathResponse(BaseModel):
    found: bool
    path: str | None = None


@router.get("/resolve-path", response_model=ResolvePathResponse)
def resolve_path(
    filename: str = Query(..., description="文件名"),
    old_path: str = Query("", description="旧路径（用于排除）"),
) -> ResolvePathResponse:
    """通过文件名在索引库中查找文件的最新路径。

    用于文件被移动后，reader 页面自动跳转到新位置。
    只返回 scan_state=1（存在）且文件系统上确实存在的结果。
    """
    if not filename.strip():
        return ResolvePathResponse(found=False)

    try:
        with get_index_session() as session:
            repo = IndexRepository(session)
            # 按 filename 查找，优先最近 seen 的
            stmt = (
                select(File.filepath)
                .where(File.filename == filename.strip())
                .where(File.scan_state == 1)
                .order_by(File.last_seen_at.desc())
                .limit(5)
            )
            candidates = list(session.exec(stmt).all())

            for candidate in candidates:
                if candidate == old_path.strip():
                    continue
                # 确认文件系统上真实存在
                if Path(candidate).exists():
                    return ResolvePathResponse(found=True, path=candidate)

        return ResolvePathResponse(found=False)
    except Exception as e:
        logger.warning("resolve-path failed for filename=%s: %s", filename, e)
        return ResolvePathResponse(found=False)


# 接口说明：确保目录存在（不存在则创建）。
class EnsureDirRequest(BaseModel):
    path: str


@router.post("/ensure-dir", response_model=PathOperationResponse)
def ensure_dir(request: EnsureDirRequest) -> PathOperationResponse:
    """Ensure a directory exists, creating it if necessary."""
    target = _validate_path(Path(request.path))
    if target.exists() and not target.is_dir():
        raise HTTPException(status_code=400, detail="Path exists but is not a directory")
    target.mkdir(parents=True, exist_ok=True)
    return PathOperationResponse(status="ok", message="Directory ensured", path=str(target))


# 接口说明：移动单个文件。
@router.post("/move-file", response_model=PathOperationResponse)
def move_file(request: MovePathRequest) -> PathOperationResponse:
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
        raise HTTPException(
            status_code=403,
            detail=_build_permission_denied_detail("move file", source, e),
        )
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Move failed: {e}")

    try:
        with get_index_session() as session:
            repo = IndexRepository(session)
            repo.delete_file(str(source))
    except Exception as e:
        logger.warning("DB cleanup failed after move-file %s -> %s: %s", source, dest, e)

    _run_scan(dest.parent, False)
    _log_activity("move", f"Moved file: {source.name} -> {dest.name}", str(dest))
    return PathOperationResponse(status="ok", message="File moved", path=str(source), dest_path=str(dest))


# 接口说明：移动整个文件夹。
@router.post("/move-folder", response_model=PathOperationResponse)
def move_folder(request: MovePathRequest) -> PathOperationResponse:
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
        raise HTTPException(
            status_code=403,
            detail=_build_permission_denied_detail("move folder", source, e),
        )
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Move failed: {e}")

    try:
        with get_index_session() as session:
            repo = IndexRepository(session)
            repo.delete_paths_by_prefix(str(source))
    except Exception as e:
        logger.warning("DB cleanup failed after move-folder %s -> %s: %s", source, dest, e)

    _run_scan(dest, True)
    _log_activity("move", f"Moved folder: {source.name} -> {dest.name}", str(dest))
    return PathOperationResponse(status="ok", message="Folder moved", path=str(source), dest_path=str(dest))


# 接口说明：删除文件或目录。
@router.delete("/delete", response_model=PathOperationResponse)
def delete_path(request: DeletePathRequest) -> PathOperationResponse:
    target = _validate_path(Path(request.path))

    if not target.exists():
        raise HTTPException(status_code=404, detail="Path not found")

    is_file_target = target.is_file()

    try:
        if request.permanently:
            if is_file_target:
                target.unlink()
            else:
                shutil.rmtree(target)
            message = "Deleted permanently"
        else:
            send2trash(str(target))
            message = "Moved to recycle bin"

        try:
            with get_index_session() as session:
                repo = IndexRepository(session)
                if is_file_target:
                    repo.delete_file(str(target))
                else:
                    repo.delete_paths_by_prefix(str(target))
        except Exception as e:
            logger.warning("DB cleanup failed after delete %s: %s", target, e)

        _log_activity("delete", f"Deleted: {target.name}", str(target))
        return PathOperationResponse(status="ok", message=message, path=str(target))
    except PermissionError as e:
        operation = "delete file" if is_file_target else "delete folder"
        raise HTTPException(
            status_code=403,
            detail=_build_permission_denied_detail(operation, target, e),
        )
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {e}")


# 接口说明：将目录打包为 zip 文件。
@router.post("/zip-folder", response_model=PathOperationResponse)
def zip_folder(request: ZipFolderRequest) -> PathOperationResponse:
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
                root_path = Path(root)
                dirs[:] = [
                    d
                    for d in dirs
                    if not should_ignore(d)
                    and not _is_link_or_reparse(root_path / d)
                    and not is_filesystem_root(root_path / d)
                ]
                for fname in filenames:
                    if should_ignore(fname):
                        continue
                    file = Path(root) / fname
                    if _is_link_or_reparse(file):
                        continue
                    zf.write(file, arcname=file.relative_to(folder))
    except PermissionError as e:
        raise HTTPException(
            status_code=403,
            detail=_build_permission_denied_detail("zip folder", folder, e),
        )
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Zip failed: {e}")

    return PathOperationResponse(status="ok", message="Folder zipped", path=str(folder), dest_path=str(output_path))


# 接口说明：重命名文件或目录。
@router.post("/rename", response_model=PathOperationResponse)
def rename_path(request: RenameRequest) -> PathOperationResponse:
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
        operation = "rename file" if source.is_file() else "rename folder"
        raise HTTPException(
            status_code=403,
            detail=_build_permission_denied_detail(operation, source, e),
        )
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
    
    _log_activity("rename", f"Renamed: {source.name} -> {dest.name}", str(dest))
    return PathOperationResponse(status="ok", message="Renamed successfully", path=str(source), dest_path=str(dest))


# 接口说明：下载指定文件。
@router.get("/download", response_model=None)
def download_file(path: str = Query(..., description="File path to download")):
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


# 接口说明：解压压缩包到目标目录。
@router.post("/unzip", response_model=PathOperationResponse)
def unzip_archive(request: UnzipRequest) -> PathOperationResponse:
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
        raise HTTPException(
            status_code=403,
            detail=_build_permission_denied_detail("extract archive", archive, e),
        )
    except zipfile.BadZipFile as e:
        raise HTTPException(status_code=400, detail=f"Invalid archive file: {e}")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {e}")


# 接口说明：触发收藏目录后台扫描。
@router.post("/scan-favorite", response_model=ScanStartResponse)
async def scan_favorite(background_tasks: BackgroundTasks) -> ScanStartResponse:
    favorite_dir = (settings.FAVORITE_DIR or "").strip()
    if not favorite_dir:
        raise HTTPException(status_code=400, detail="FAVORITE_DIR is not configured")

    favorite_path = _validate_path(Path(favorite_dir))
    if not favorite_path.exists() or not favorite_path.is_dir():
        raise HTTPException(status_code=404, detail="Favorite directory not found")

    background_tasks.add_task(_run_scan, favorite_path, True)
    _log_activity("scan", f"Started favorite scan: {favorite_path}", str(favorite_path))
    return ScanStartResponse(status="started", message="Favorite directory scan started", path=str(favorite_path))


# 接口说明：触发指定目录后台扫描。
@router.post("/scan", response_model=ScanStartResponse)
async def scan_directory(background_tasks: BackgroundTasks, request: ScanRequest) -> ScanStartResponse:
    """Scan a directory and optionally recurse into subfolders."""
    target_path = Path(request.path)
    validated_path = _validate_path(target_path)

    if not validated_path.exists():
        raise HTTPException(status_code=404, detail="Path not found")

    if not validated_path.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")

    if is_filesystem_root(validated_path):
        raise HTTPException(status_code=400, detail="Refuse to scan filesystem root directory")

    background_tasks.add_task(_run_scan, validated_path, request.recursive)
    _log_activity("scan", f"Started scan: {validated_path}", str(validated_path))

    return ScanStartResponse(
        status="started",
        message="Scan task started",
        path=str(validated_path),
    )


# 接口说明：回填目录文件的缩略图与元数据。
@router.post("/backfill", response_model=BackfillResponse)
async def backfill_directory(request: BackfillRequest) -> BackfillResponse:
    """Backfill missing thumbnail/meta for files under a folder."""
    target_path = Path(request.path)
    validated_path = _validate_path(target_path)

    if not validated_path.exists():
        raise HTTPException(status_code=404, detail="Path not found")

    if not validated_path.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")

    if is_filesystem_root(validated_path):
        raise HTTPException(status_code=400, detail="Refuse to scan filesystem root directory")

    if not request.fill_thumbnail and not request.fill_meta:
        raise HTTPException(status_code=400, detail="Nothing to backfill")

    scanned_files = 0
    backfilled_thumbnails = 0
    backfilled_meta = 0

    thumb_service: ThumbService | None = None
    if request.fill_thumbnail:
        thumb_service = await ThumbService.get_instance()

    with get_index_session() as session:
        repo = IndexRepository(session)
        ensured_folders: set[str] = set()

        def ensure_folder_row(folder_path: Path) -> None:
            folder_str = str(folder_path)
            if folder_str in ensured_folders:
                return
            try:
                folder_stat = folder_path.stat()
                folder_mtime = int(folder_stat.st_mtime)
            except Exception:
                folder_mtime = None

            repo.upsert_folder(
                UpsertFolderInput(
                    filepath=folder_str,
                    dirname=folder_path.name or folder_str,
                    mtime=folder_mtime,
                    scan_state=1,
                    watch_state=0,
                    scanned=False,
                )
            )
            ensured_folders.add(folder_str)

        # Ensure target folder itself exists in DB, then ensure each file parent folder on demand.
        ensure_folder_row(validated_path)

        for file_path in _iter_files_for_backfill(validated_path, request.recursive):
            scanned_files += 1

            try:
                stat = file_path.stat()
            except Exception as e:
                logger.warning("Backfill skipped stat failed for %s: %s", file_path, e)
                continue

            file_type = detect_file_type(file_path)
            filepath = str(file_path)
            ensure_folder_row(file_path.parent)

            # Ensure file row exists for downstream metadata writes.
            db_file = repo.get_file(filepath)
            if db_file is None:
                fingerprint = f"{file_path.name}-{stat.st_size}-{int(stat.st_mtime)}"
                db_file = repo.upsert_file(
                    UpsertFileInput(
                        filepath=filepath,
                        filename=file_path.name,
                        mtime=int(stat.st_mtime),
                        filesize=stat.st_size,
                        fingerprint=fingerprint,
                        folderpath=str(file_path.parent),
                        file_type=file_type,
                        ext=file_path.suffix.lower() if file_path.suffix else None,
                        scan_state=1,
                        watch_state=0,
                        scanned=False,
                    )
                )

            if request.fill_thumbnail and file_type in ("archive", "video", "image"):
                missing_thumb = not (db_file.thumbnail_filepath or "").strip()
                if missing_thumb and thumb_service is not None:
                    try:
                        await thumb_service.get_or_generate(file_path)
                        backfilled_thumbnails += 1
                    except Exception as e:
                        logger.warning("Backfill thumbnail failed for %s: %s", file_path, e)

            if request.fill_meta:
                # Parsed metadata from filename
                if repo.get_parsed_metadata(filepath) is None:
                    try:
                        parsed = parse(file_path.name)
                        if parsed is not None:
                            repo.save_parse_result(
                                filepath,
                                title=parsed.title,
                                authors=parsed.authors,
                                cosers=parsed.cosers,
                                group_name=parsed.group,
                                raw_tags=parsed.raw_tags,
                                event=parsed.event,
                                date_tag=parsed.date_tag,
                                media_type=parsed.type,
                            )
                            backfilled_meta += 1
                    except Exception as e:
                        logger.warning("Backfill parse meta failed for %s: %s", file_path, e)

                # Archive content metadata
                if file_type == "archive" and repo.get_archive_meta(filepath) is None:
                    try:
                        entries = list_archive_entries(file_path)
                        image_file_num = 0
                        video_file_num = 0
                        music_file_num = 0

                        for entry in entries:
                            et = detect_file_type(entry)
                            if et == "image":
                                image_file_num += 1
                            elif et == "video":
                                video_file_num += 1
                            elif et == "audio":
                                music_file_num += 1

                        repo.upsert_archive_meta(
                            filepath=filepath,
                            archive_type=file_path.suffix.lower().lstrip("."),
                            entry_count=len(entries),
                            image_file_num=image_file_num,
                            video_file_num=video_file_num,
                            music_file_num=music_file_num,
                        )
                        backfilled_meta += 1
                    except Exception as e:
                        logger.warning("Backfill archive meta failed for %s: %s", file_path, e)

    return BackfillResponse(
        status="ok",
        scanned_files=scanned_files,
        backfilled_thumbnails=backfilled_thumbnails,
        backfilled_meta=backfilled_meta,
        message="Backfill completed",
    )


# 接口说明：扫描目录并开启实时监听。
@router.post("/scan-watch", response_model=ScanStartResponse)
async def scan_and_watch(background_tasks: BackgroundTasks, request: ScanRequest) -> ScanStartResponse:
    """Scan a directory recursively and start watchdog listener."""
    target_path = Path(request.path)
    validated_path = _validate_path(target_path)

    if not validated_path.exists():
        raise HTTPException(status_code=404, detail="Path not found")

    if not validated_path.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")

    if is_filesystem_root(validated_path):
        raise HTTPException(status_code=400, detail="Refuse to scan filesystem root directory")

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
    _log_activity("scan", f"Started scan: {validated_path}", str(validated_path))

    return ScanStartResponse(
        status="started",
        message="Scan+watch task started",
        path=path_key,
    )


# 接口说明：查询扫描任务状态。
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


@router.post("/sync-file-table", response_model=PathOperationResponse)
async def sync_file_table_now() -> PathOperationResponse:
    """手动触发 files 表与文件系统同步任务。"""
    _log_activity("db_sync", "手动触发文件索引同步", status="started", task_key="manual:db_sync")
    threading.Thread(target=_sync_file_table_with_filesystem, daemon=True, name="file-db-sync-manual").start()
    return PathOperationResponse(status="ok", message="File index sync started", path="/")



## 接口说明：获取最近活动（默认从本次启动开始，最多200条）。
@router.get("/recent-activity", response_model=RecentActivityResponse)
def get_recent_activity(
    limit: int = Query(200, ge=1, le=500),
    since_latest_startup: bool = Query(True, description="Only show activities from latest startup"),
) -> RecentActivityResponse:
    with get_index_session() as session:
        repo = IndexRepository(session)
        rows = (
            repo.list_activity_logs_since_latest_startup(limit=limit)
            if since_latest_startup
            else repo.list_activity_logs(limit=limit)
        )

    return RecentActivityResponse(
        items=[
            ActivityItem(
                id=row.id or 0,
                activity_type=row.activity_type,
                status=row.status,
                task_key=row.task_key,
                message=row.message,
                target_path=row.target_path,
                context=json.loads(row.context_json) if row.context_json else None,
                created_at=row.created_at,
            )
            for row in rows
        ]
    )



@router.get("/top-opened-folders", response_model=TopOpenedFoldersResponse)
def get_top_opened_folders(limit: int = Query(5, ge=1, le=20)) -> TopOpenedFoldersResponse:
    with get_index_session() as session:
        repo = IndexRepository(session)
        folder_ids = repo.list_top_opened_folder_ids(limit=limit)
    return TopOpenedFoldersResponse(folder_ids=folder_ids)


# 接口说明：获取全库总览统计。
@router.get("/library-overview", response_model=LibraryOverviewResponse)
def get_library_overview() -> LibraryOverviewResponse:
    with get_index_session() as session:
        repo = IndexRepository(session)
        return LibraryOverviewResponse(
            archives=repo.count_files_by_type("archive"),
            videos=repo.count_files_by_type("video"),
            images=repo.count_files_by_type("image"),
            audio=repo.count_files_by_type("audio"),
            folders=repo.count_folders(),
        )


# 文件名 stem 最短长度阈值，太短的文件名（如 1.mp4、1.png）不做回退查找
_MIN_STEM_LEN_FOR_FALLBACK = 5


def _is_filename_long_enough(filename: str) -> bool:
    """判断文件名 stem 是否足够长，避免用 1.mp4 这类通用名做回退匹配。"""
    stem = Path(filename).stem
    return len(stem) > _MIN_STEM_LEN_FOR_FALLBACK


def _find_fallback_path(original_path: Path) -> Path | None:
    """当原始文件不存在时，通过文件名在 DB 中查找实际存在的同名文件。"""
    filename = original_path.name
    if not _is_filename_long_enough(filename):
        logger.debug(f"Filename too short for fallback lookup: {filename}")
        return None

    try:
        with get_index_session() as session:
            repo = IndexRepository(session)
            candidates = repo.find_files_by_filename(filename, exclude_path=str(original_path))
            for candidate in candidates:
                candidate_path = Path(candidate.filepath)
                if candidate_path.exists() and candidate_path.is_file():
                    logger.info(f"Thumb fallback: {original_path} -> {candidate_path}")
                    return candidate_path
    except Exception as e:
        logger.warning(f"Fallback path lookup failed for {original_path}: {e}")
    return None


# 接口说明：获取（或生成）文件缩略图。
@router.get("/thumb", response_model=None)
async def get_thumbnail(path: str = Query(..., description="File path for thumbnail")):
    """Get or generate thumbnail for a file."""
    target_path = Path(path)
    validated_path = _validate_path(target_path)

    # 文件不存在时，尝试通过文件名在 DB 中找到同名但路径不同的文件
    if not validated_path.exists():
        fallback = _find_fallback_path(validated_path)
        if fallback is None:
            raise HTTPException(status_code=404, detail="File not found")
        logger.info(f"Thumbnail using fallback path: {validated_path} -> {fallback}")
        validated_path = fallback

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




# 接口说明：列出压缩包内文件与统计信息。
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
    _log_activity("cache_cleanup", "开始清理解压缓存", status="running", task_key="startup:cache_cleanup")
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
    result = {"deleted_files": deleted_files, "freed_bytes": freed_bytes}
    _log_activity("cache_cleanup", "解压缓存清理完成", status="completed", task_key="startup:cache_cleanup", context=result)
    return result


class ClearCacheResponse(BaseModel):
    status: Literal["ok"]
    message: str
    deleted_files: int
    freed_bytes: int
    freed_size_readable: str


# 接口说明：清理压缩包解压缓存。
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


# 接口说明：按页优先解压压缩包内容。
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

    # 先获取条目清单，后续用于：
    # 1) 判断无媒体时直接 completed 返回；
    # 2) 计算当前页优先解压目标。
    try:
        all_entries = await asyncio.to_thread(list_archive_entries, validated_path)
    except Exception as e:
        logger.error(f"Failed to list archive entries for extraction: {validated_path}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list archive: {e}")

    media_entries = [
        e for e in all_entries
        if detect_file_type(e) in ("image", "video", "audio")
    ]

    # 没有可解压媒体时直接返回 completed，避免前端等待。
    if not media_entries:
        return ExtractStatus(
            status="completed",
            extracted_count=0,
            total_count=0,
            cache_dir=str(cache_dir),
        )

    # 阶段 1：当前页（同步保证首屏可用）
    current_page_entry = [media_entries[page]] if 0 <= page < len(media_entries) else []

    # 阶段 2：前后 ±5 页（后台）
    start_idx = max(0, page - 5)
    end_idx = min(len(media_entries), page + 6)
    secondary = [e for e in media_entries[start_idx:end_idx] if e not in current_page_entry]

    # ---- 检查是否已经完全解压完成 ----
    if cache_dir.exists():
        try:
            extracted_files = list(cache_dir.rglob("*"))
            extracted_count = len([f for f in extracted_files if f.is_file()])

            if extracted_count >= len(all_entries):
                return ExtractStatus(
                    status="completed",
                    extracted_count=extracted_count,
                    total_count=len(media_entries),
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
                    total_count=len(media_entries),
                    cache_dir=str(cache_dir),
                )
            except Exception:
                return ExtractStatus(
                    status="extracting",
                    extracted_count=0,
                    total_count=len(media_entries),
                    cache_dir=str(cache_dir),
                )

        # 标记为正在解压
        _active_extractions[cache_key] = True

    # ---- 阶段 1：同步解压当前页，确保返回时首图可读 ----
    try:
        if current_page_entry:
            await asyncio.to_thread(extract_entries, validated_path, cache_dir, current_page_entry)
    except Exception as e:
        logger.error(f"阶段1解压失败: {validated_path.name}, 错误: {e}")
        with _extraction_lock:
            _active_extractions.pop(cache_key, None)
        raise HTTPException(status_code=500, detail=f"Failed to extract current page: {e}")

    # ---- 在后台启动三阶段解压 ----
    async def extract_task():
        try:
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
        extracted_count=1 if current_page_entry else 0,
        total_count=len(media_entries),
        cache_dir=str(cache_dir),
    )


# 接口说明：读取压缩包缓存中的指定文件。
@router.get("/archive/file", response_model=None)
def get_archive_file(
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


# 接口说明：直接读取本地文件内容。
@router.get("/file", response_model=None)
def get_file(path: str = Query(..., description="File path")):
    """Serve a file directly from disk."""
    target_path = Path(path)
    validated_path = _validate_path(target_path)
    
    if not validated_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    if not validated_path.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")
    
    return FileResponse(validated_path, media_type=get_mime_type(validated_path))


# ---------------------------------------------------------------------------
# Archive Image Compression
# ---------------------------------------------------------------------------

class CompressImagesRequest(BaseModel):
    archive_path: str
    output_path: str | None = None
    max_width: int | None = None
    max_height: int | None = None
    quality: int | None = None
    min_size: int | None = None


class CompressImagesResponse(BaseModel):
    success: bool
    original_path: str
    output_path: str
    original_size: int
    compressed_size: int
    compression_ratio: float
    processed_images: int
    skipped_images: int
    validation_passed: bool
    error_message: str = ""


# 接口说明：压缩压缩包内图片并重新打包。
@router.post("/archive/compress-images", response_model=CompressImagesResponse)
async def compress_archive_images_endpoint(
    background_tasks: BackgroundTasks,
    request: CompressImagesRequest,
) -> CompressImagesResponse:
    """压缩压缩包内的大图片并重新打包。
    
    功能：
    - 扫描 zip 内所有图片
    - 压缩大于阈值的图片（默认 1MB，分辨率 > 2000x2000）
    - 转换为 JPEG 格式，质量 85
    - 保持原始目录结构
    - 验证压缩包完整性
    - 验证失败时输出文件添加 .error 后缀
    """
    from app.file_processing.archive_compressor import compress_archive_images
    
    archive = _validate_path(Path(request.archive_path))
    
    if not archive.exists():
        raise HTTPException(status_code=404, detail="Archive not found")
    
    if not archive.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")
    
    file_type = detect_file_type(archive)
    if file_type != "archive":
        raise HTTPException(status_code=400, detail="File is not an archive")
    
    try:
        # 在后台执行压缩（可能耗时较长）
        result = await asyncio.to_thread(
            compress_archive_images,
            archive,
            output_path=Path(request.output_path) if request.output_path else None,
            max_width=request.max_width,
            max_height=request.max_height,
            quality=request.quality,
            min_size=request.min_size,
        )
        
        _log_activity("minify_zip_images", f"Minified archive images: {archive.name}", result.output_path)
        return CompressImagesResponse(
            success=result.success,
            original_path=result.original_path,
            output_path=result.output_path,
            original_size=result.original_size,
            compressed_size=result.compressed_size,
            compression_ratio=result.compression_ratio,
            processed_images=result.processed_images,
            skipped_images=result.skipped_images,
            validation_passed=result.validation_passed,
            error_message=result.error_message,
        )
    except Exception as e:
        logger.error(f"压缩失败: {archive}, 错误: {e}")
        raise HTTPException(status_code=500, detail=f"Compression failed: {e}")
