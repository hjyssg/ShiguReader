from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import threading
from time import time
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from app.constants import ARCHIVE_SUFFIXES, AUDIO_SUFFIXES, IMAGE_SUFFIXES, VIDEO_SUFFIXES
from app.core.config import settings
from app.file_processing.archive_lister import list_archive_entries
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
    scan_state: int = 0  # Reserved for DB integration
    watch_state: int = 0  # Reserved for DB integration


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
            for root, _, filenames in os.walk(path):
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


@router.get("/list", response_model=ListResponse)
async def list_directory(
    background_tasks: BackgroundTasks,
    path: str = Query(..., description="Directory path to list"),
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
                        thumbnail_url = f"{settings.API_V1_STR}/fs/thumb?path={entry}"
                    
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
    
    # Sort: folders first, then files, each sorted by name
    items.sort(key=lambda x: (x.item_type != "folder", x.name.lower()))
    
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
        
        # Check if it's SVG (for video placeholders)
        if cache_path.suffix == ".webp" and cache_path.read_text(encoding="utf-8", errors="ignore").startswith("<svg"):
            return Response(
                content=cache_path.read_text(encoding="utf-8"),
                media_type="image/svg+xml",
            )
        
        return FileResponse(
            cache_path,
            media_type="image/webp",
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


@router.post("/archive/extract", response_model=ExtractStatus)
async def extract_archive(
    background_tasks: BackgroundTasks,
    path: str = Query(..., description="Archive file path"),
    page: int = Query(0, description="Current page number for prioritized extraction"),
) -> ExtractStatus:
    """Extract archive with prioritized extraction of current page vicinity."""
    target_path = Path(path)
    validated_path = _validate_path(target_path)
    
    if not validated_path.exists():
        raise HTTPException(status_code=404, detail="Archive not found")
    
    file_type = detect_file_type(validated_path)
    if file_type != "archive":
        raise HTTPException(status_code=400, detail="File is not an archive")
    
    cache_dir = _get_extract_cache_dir(validated_path)
    
    # Check if already extracted
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
            logger.warning(f"Failed to check extraction status: {e}")
    
    # Start extraction in background
    async def extract_task():
        try:
            entries = await asyncio.to_thread(list_archive_entries, validated_path)
            
            # Calculate prioritized entries (current page ± 10 pages)
            start_idx = max(0, page - 10)
            end_idx = min(len(entries), page + 11)
            prioritized = entries[start_idx:end_idx]
            
            logger.info(f"Extracting archive {validated_path}, prioritizing entries {start_idx}-{end_idx}")
            
            await asyncio.to_thread(
                stepwise_extract,
                validated_path,
                cache_dir,
                prioritized_entries=prioritized,
            )
            
            logger.info(f"Archive extraction completed: {validated_path}")
        except Exception as e:
            logger.error(f"Archive extraction failed: {validated_path}, error: {e}")
    
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
