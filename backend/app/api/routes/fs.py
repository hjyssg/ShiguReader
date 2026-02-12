from __future__ import annotations

import asyncio
import hashlib
import logging
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from app.core.config import settings
from app.file_processing.archive_lister import list_archive_entries
from app.file_processing.stepwise_extractor import stepwise_extract
from app.services.thumb_service import (
    ARCHIVE_SUFFIXES,
    IMAGE_DIRECT_SUFFIXES,
    VIDEO_SUFFIXES,
    ThumbService,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/fs", tags=["filesystem"])


def _parse_roots() -> list[Path]:
    """Parse FS_ROOTS from settings."""
    if not settings.FS_ROOTS:
        return []
    return [Path(r.strip()).resolve() for r in settings.FS_ROOTS.split(",") if r.strip()]


def _validate_path_in_roots(path: Path) -> Path:
    """Validate that path is within allowed roots. Raises HTTPException if not."""
    roots = _parse_roots()
    if not roots:
        raise HTTPException(status_code=500, detail="No FS_ROOTS configured")
    
    try:
        resolved = path.resolve()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid path: {e}")
    
    for root in roots:
        try:
            if resolved.is_relative_to(root):
                return resolved
        except ValueError:
            continue
    
    raise HTTPException(status_code=403, detail="Path not in allowed roots")


def _detect_file_type(filepath: Path) -> Literal["image", "video", "archive", "audio", "unknown"]:
    """Detect file type based on extension."""
    suffix = filepath.suffix.lower()
    
    if suffix in IMAGE_DIRECT_SUFFIXES:
        return "image"
    if suffix in VIDEO_SUFFIXES:
        return "video"
    if suffix in ARCHIVE_SUFFIXES:
        return "archive"
    if suffix in (".mp3", ".flac", ".wav", ".aac", ".ogg", ".m4a"):
        return "audio"
    
    return "unknown"


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


@router.get("/roots", response_model=list[RootItem])
async def get_roots() -> list[RootItem]:
    """Get configured root directories."""
    roots = _parse_roots()
    return [
        RootItem(path=str(root), dirname=root.name or str(root))
        for root in roots
    ]


@router.get("/list", response_model=ListResponse)
async def list_directory(path: str = Query(..., description="Directory path to list")) -> ListResponse:
    """List contents of a directory."""
    target_path = Path(path)
    validated_path = _validate_path_in_roots(target_path)
    
    if not validated_path.exists():
        raise HTTPException(status_code=404, detail="Path not found")
    
    if not validated_path.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")
    
    items: list[FileSystemItem] = []
    
    try:
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
                elif entry.is_file():
                    file_type = _detect_file_type(entry)
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
            except Exception as e:
                logger.warning(f"Failed to process entry {entry}: {e}")
                continue
    except Exception as e:
        logger.error(f"Failed to list directory {validated_path}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list directory: {e}")
    
    # Sort: folders first, then files, each sorted by name
    items.sort(key=lambda x: (x.item_type != "folder", x.name.lower()))
    
    return ListResponse(items=items)


@router.get("/thumb", response_model=None)
async def get_thumbnail(path: str = Query(..., description="File path for thumbnail")):
    """Get or generate thumbnail for a file."""
    target_path = Path(path)
    validated_path = _validate_path_in_roots(target_path)
    
    if not validated_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    if not validated_path.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")
    
    file_type = _detect_file_type(validated_path)
    
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


def _detect_entry_file_type(entry_path: str) -> Literal["image", "video", "audio", "unknown"]:
    """Detect file type for archive entry."""
    suffix = Path(entry_path).suffix.lower()
    
    if suffix in IMAGE_DIRECT_SUFFIXES or suffix in (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"):
        return "image"
    if suffix in VIDEO_SUFFIXES:
        return "video"
    if suffix in (".mp3", ".flac", ".wav", ".aac", ".ogg", ".m4a"):
        return "audio"
    
    return "unknown"


@router.get("/archive/list", response_model=ArchiveListResponse)
async def list_archive(path: str = Query(..., description="Archive file path")) -> ArchiveListResponse:
    """List contents of an archive file."""
    target_path = Path(path)
    validated_path = _validate_path_in_roots(target_path)
    
    if not validated_path.exists():
        raise HTTPException(status_code=404, detail="Archive not found")
    
    if not validated_path.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")
    
    file_type = _detect_file_type(validated_path)
    if file_type != "archive":
        raise HTTPException(status_code=400, detail="File is not an archive")
    
    try:
        entries = await asyncio.to_thread(list_archive_entries, validated_path)
        
        # Filter and create archive entries (only image, video, audio)
        archive_entries = []
        image_index = 0
        for entry in entries:
            file_type = _detect_entry_file_type(entry)
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
    validated_path = _validate_path_in_roots(target_path)
    
    if not validated_path.exists():
        raise HTTPException(status_code=404, detail="Archive not found")
    
    file_type = _detect_file_type(validated_path)
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
    validated_path = _validate_path_in_roots(target_path)
    
    if not validated_path.exists():
        raise HTTPException(status_code=404, detail="Archive not found")
    
    cache_dir = _get_extract_cache_dir(validated_path)
    file_path = cache_dir / entry
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not extracted yet")
    
    if not file_path.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")
    
    # Detect media type
    suffix = file_path.suffix.lower()
    media_type = "application/octet-stream"
    
    if suffix in (".jpg", ".jpeg"):
        media_type = "image/jpeg"
    elif suffix in (".png",):
        media_type = "image/png"
    elif suffix in (".webp",):
        media_type = "image/webp"
    elif suffix in (".gif",):
        media_type = "image/gif"
    elif suffix in (".mp4",):
        media_type = "video/mp4"
    elif suffix in (".webm",):
        media_type = "video/webm"
    elif suffix in (".mp3",):
        media_type = "audio/mpeg"
    
    return FileResponse(file_path, media_type=media_type)


@router.get("/file", response_model=None)
async def get_file(path: str = Query(..., description="File path")):
    """Serve a file directly from disk."""
    target_path = Path(path)
    validated_path = _validate_path_in_roots(target_path)
    
    if not validated_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    if not validated_path.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")
    
    # Detect media type
    suffix = validated_path.suffix.lower()
    media_type = "application/octet-stream"
    
    if suffix in (".jpg", ".jpeg"):
        media_type = "image/jpeg"
    elif suffix in (".png",):
        media_type = "image/png"
    elif suffix in (".webp",):
        media_type = "image/webp"
    elif suffix in (".gif",):
        media_type = "image/gif"
    elif suffix in (".mp4",):
        media_type = "video/mp4"
    elif suffix in (".webm",):
        media_type = "video/webm"
    elif suffix in (".mkv",):
        media_type = "video/x-matroska"
    elif suffix in (".mp3",):
        media_type = "audio/mpeg"
    elif suffix in (".flac",):
        media_type = "audio/flac"
    elif suffix in (".wav",):
        media_type = "audio/wav"
    
    return FileResponse(validated_path, media_type=media_type)
