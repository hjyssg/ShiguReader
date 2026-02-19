from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy.exc import OperationalError
from sqlmodel import func, select

from app.index_db.bootstrap import ensure_index_db_initialized
from app.index_db.db import get_index_session
from app.index_db.models import File, FileTag, Tag

from ._entity_thumb import (
    build_thumbnail_url,
    find_existing_thumbnail,
    query_tag_thumb_candidates,
)

router = APIRouter(prefix="/tags", tags=["tags"])


class TagListItem(BaseModel):
    name: str
    thumbnail: str | None = None
    file_count: int
    avg_rec_score: float = 0.0


class TagsResponse(BaseModel):
    items: list[TagListItem]
    page: int
    page_size: int
    total: int


@router.get("", response_model=TagsResponse)
async def read_tags(
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    sort_by: Literal["count", "name", "recommendation"] = Query("count"),
    sort_order: Literal["asc", "desc"] = Query("desc"),
) -> TagsResponse:
    offset = (page - 1) * page_size

    def _query_once() -> tuple[int, list, dict[str, list[str]]]:
        with get_index_session() as session:
            total_stmt = select(func.count()).select_from(Tag)
            total = session.exec(total_stmt).one()

            count_stmt = (
                select(
                    Tag.tag_name,
                    func.count(FileTag.filepath).label("file_count"),
                    func.avg(File.rec_score).label("avg_rec_score"),
                )
                .select_from(Tag)
                .join(FileTag, FileTag.tag_name == Tag.tag_name, isouter=True)
                .join(File, File.filepath == FileTag.filepath, isouter=True)
                .group_by(Tag.tag_name)
            )

            if sort_by == "name":
                count_stmt = count_stmt.order_by(
                    Tag.tag_name.asc() if sort_order == "asc" else Tag.tag_name.desc()
                )
            elif sort_by == "recommendation":
                count_stmt = count_stmt.order_by(
                    func.avg(File.rec_score).asc() if sort_order == "asc" else func.avg(File.rec_score).desc(),
                    Tag.tag_name.asc(),
                )
            else:
                count_stmt = count_stmt.order_by(
                    func.count(FileTag.filepath).asc() if sort_order == "asc" else func.count(FileTag.filepath).desc(),
                    Tag.tag_name.asc(),
                )

            page_rows = session.exec(count_stmt.offset(offset).limit(page_size)).all()
            tag_names = [name for name, _, _ in page_rows]
            candidates = query_tag_thumb_candidates(session, tag_names)

        return total, page_rows, candidates

    try:
        total, page_rows, candidates = _query_once()
    except OperationalError:
        ensure_index_db_initialized()
        try:
            total, page_rows, candidates = _query_once()
        except OperationalError:
            return TagsResponse(items=[], page=page, page_size=page_size, total=0)

    cache: dict[str, bool] = {}
    items = []
    for tag_name, file_count, avg_rec in page_rows:
        filepath = find_existing_thumbnail(candidates.get(tag_name, []), cache)
        items.append(
            TagListItem(
                name=tag_name,
                thumbnail=build_thumbnail_url(filepath) if filepath else None,
                file_count=file_count,
                avg_rec_score=float(avg_rec or 0.0),
            )
        )

    return TagsResponse(items=items, page=page, page_size=page_size, total=total)
