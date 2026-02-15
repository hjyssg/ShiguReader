from __future__ import annotations

from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.api.routes.fs import FileSystemItem
from app.core.config import settings
from app.index_db.confidence import compute_confidence
from app.index_db.db import get_index_session
from app.index_db.models import File
from app.index_db.repository import IndexRepository

router = APIRouter(prefix="/search", tags=["search"])


class SearchRequest(BaseModel):
    q: str = Field(default="")
    scopes: list[Literal["file", "author", "tag"]] = Field(
        default_factory=lambda: ["file", "author", "tag"]
    )
    mode: Literal["exact", "hybrid"] = "hybrid"
    presence_filter: Literal["all", "watched", "scanned_recent"] = "all"


class SearchResponse(BaseModel):
    items: list[FileSystemItem]
    total: int


def _to_item(file: File) -> FileSystemItem:
    thumbnail_url = None
    if file.file_type in ("archive", "video", "image"):
        thumbnail_url = f"{settings.API_V1_STR}/fs/thumb?path={quote(file.filepath, safe='')}"

    confidence_level, confidence_score = compute_confidence(
        scan_state=file.scan_state,
        watch_state=file.watch_state,
        last_seen_at=file.last_seen_at,
    )

    return FileSystemItem(
        name=file.filename,
        path=file.filepath,
        item_type="file",
        file_type=file.file_type,
        filesize=file.filesize,
        mtime=file.mtime,
        thumbnail_url=thumbnail_url,
        scan_state=file.scan_state,
        watch_state=file.watch_state,
        confidence_level=confidence_level,
        confidence_score=confidence_score,
    )


@router.post("", response_model=SearchResponse)
def search_files(body: SearchRequest) -> SearchResponse:
    q = body.q.strip()
    if not q:
        return SearchResponse(items=[], total=0)

    by_filepath: dict[str, File] = {}
    with get_index_session() as session:
        repo = IndexRepository(session)

        if "file" in body.scopes:
            for f in repo.search_files(q, body.mode, body.presence_filter):
                by_filepath[f.filepath] = f

        if "author" in body.scopes:
            for f in repo.search_by_author(q, body.mode, body.presence_filter):
                by_filepath[f.filepath] = f

        if "tag" in body.scopes:
            for f in repo.search_by_tag(q, body.mode, body.presence_filter):
                by_filepath[f.filepath] = f

    items = [_to_item(f) for f in by_filepath.values()]
    items.sort(key=lambda x: x.name.lower())
    return SearchResponse(items=items, total=len(items))
