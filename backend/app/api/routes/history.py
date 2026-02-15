from __future__ import annotations

from pathlib import Path
from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy.exc import OperationalError

from app.constants import ARCHIVE_SUFFIXES, AUDIO_SUFFIXES, IMAGE_SUFFIXES, VIDEO_SUFFIXES
from app.core.config import settings
from app.index_db.bootstrap import ensure_index_db_initialized
from app.index_db.db import get_index_session
from app.index_db.repository import IndexRepository

router = APIRouter(prefix="/history", tags=["history"])


def _build_thumb_url(path: Path | str) -> str:
    encoded_path = quote(str(path), safe="")
    return f"{settings.API_V1_STR}/fs/thumb?path={encoded_path}"


def _detect_file_type(path: Path) -> str:
    ext = path.suffix.lower()
    if ext in IMAGE_SUFFIXES:
        return "image"
    if ext in VIDEO_SUFFIXES:
        return "video"
    if ext in AUDIO_SUFFIXES:
        return "audio"
    if ext in ARCHIVE_SUFFIXES:
        return "archive"
    return "unknown"


class HistoryRecordRequest(BaseModel):
    filepath: str
    page_current: int | None = None
    page_total: int | None = None
    position_sec: float | None = None
    duration_sec: float | None = None


class HistoryRecordResponse(BaseModel):
    status: Literal["ok"]


class HistoryItem(BaseModel):
    filepath: str
    filename: str
    file_type: Literal["image", "video", "archive", "audio", "unknown"]
    filesize: int | None = None
    mtime: int | None = None
    thumbnail_url: str | None = None
    read_at: int
    page_current: int | None = None
    page_total: int | None = None
    file_exists: bool | None = None  # None = unknown, True = exists, False = not exists


class HistoryListResponse(BaseModel):
    items: list[HistoryItem]
    page: int
    page_size: int
    total: int
    total_pages: int


@router.post("/record", response_model=HistoryRecordResponse)
async def record_history(request: HistoryRecordRequest) -> HistoryRecordResponse:
    filepath = request.filepath.strip()
    if not filepath:
        return HistoryRecordResponse(status="ok")

    target = Path(filepath)
    file_exists = target.exists() and target.is_file()

    filename: str | None = None
    file_type: str | None = None
    filesize: int | None = None
    mtime: int | None = None
    thumbnail_url: str | None = None

    if file_exists:
        stat = target.stat()
        filename = target.name
        file_type = _detect_file_type(target)
        filesize = stat.st_size
        mtime = int(stat.st_mtime)
        if file_type in {"image", "video", "archive"}:
            thumbnail_url = _build_thumb_url(target)

    try:
        with get_index_session() as session:
            repo = IndexRepository(session)
            repo.upsert_progress(
                filepath=filepath,
                filename=filename,
                file_type=file_type,
                filesize=filesize,
                mtime=mtime,
                thumbnail_url=thumbnail_url,
                page_current=request.page_current,
                page_total=request.page_total,
                position_sec=request.position_sec,
                duration_sec=request.duration_sec,
            )
    except OperationalError:
        ensure_index_db_initialized()
        with get_index_session() as session:
            repo = IndexRepository(session)
            repo.upsert_progress(
                filepath=filepath,
                filename=filename,
                file_type=file_type,
                filesize=filesize,
                mtime=mtime,
                thumbnail_url=thumbnail_url,
                page_current=request.page_current,
                page_total=request.page_total,
                position_sec=request.position_sec,
                duration_sec=request.duration_sec,
            )

    return HistoryRecordResponse(status="ok")


@router.get("/list", response_model=HistoryListResponse)
async def list_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    sort_order: Literal["asc", "desc"] = Query("desc"),
) -> HistoryListResponse:
    offset = (page - 1) * page_size

    def _query_once() -> tuple[int, list]:
        with get_index_session() as session:
            repo = IndexRepository(session)
            total = repo.count_progress_history()
            rows = repo.list_progress_history(
                offset=offset,
                limit=page_size,
                sort_order=sort_order,
            )
            return total, rows

    try:
        total, rows = _query_once()
    except OperationalError:
        ensure_index_db_initialized()
        total, rows = _query_once()

    items: list[HistoryItem] = []
    for row in rows:
        filepath = row.filepath
        # Use database record for filename and file_type, no filesystem check
        filename = row.filename or Path(filepath).name or filepath
        file_type = row.file_type or "unknown"

        thumbnail_url = row.thumbnail_url
        if not thumbnail_url and file_type in {"image", "video", "archive"}:
            thumbnail_url = _build_thumb_url(filepath)

        items.append(
            HistoryItem(
                filepath=filepath,
                filename=filename,
                file_type=file_type,
                filesize=row.filesize,
                mtime=row.mtime,
                thumbnail_url=thumbnail_url,
                read_at=row.last_opened_at,
                page_current=row.page_current,
                page_total=row.page_total,
                file_exists=None,  # Unknown - frontend can check if needed
            )
        )

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    return HistoryListResponse(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )
