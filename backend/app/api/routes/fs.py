from __future__ import annotations

import logging
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from app.core.config import settings
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
