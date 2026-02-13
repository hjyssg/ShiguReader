from __future__ import annotations

from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy.exc import OperationalError
from sqlmodel import func, select

from app.core.config import settings
from app.index_db.bootstrap import ensure_index_db_initialized
from app.index_db.db import get_index_session
from app.index_db.models import File, FileTag, Tag

router = APIRouter(prefix="/tags", tags=["tags"])


class TagListItem(BaseModel):
    name: str
    thumbnail: str | None = None
    file_count: int


class TagsResponse(BaseModel):
    items: list[TagListItem]
    page: int
    page_size: int
    total: int


@router.get("", response_model=TagsResponse)
async def read_tags(
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    sort_by: Literal["count", "name"] = Query("count"),
    sort_order: Literal["asc", "desc"] = Query("desc"),
) -> TagsResponse:
    offset = (page - 1) * page_size

    def _query_once() -> tuple[int, list[tuple[str, int]], dict[str, str]]:
        with get_index_session() as session:
            total_stmt = select(func.count()).select_from(Tag)
            total = session.exec(total_stmt).one()

            count_stmt = (
                select(
                    Tag.tag_name,
                    func.count(FileTag.filepath).label("file_count"),
                )
                .select_from(Tag)
                .join(FileTag, FileTag.tag_name == Tag.tag_name, isouter=True)
                .group_by(Tag.tag_name)
            )

            if sort_by == "name":
                count_stmt = count_stmt.order_by(
                    Tag.tag_name.asc() if sort_order == "asc" else Tag.tag_name.desc()
                )
            else:
                count_stmt = count_stmt.order_by(
                    func.count(FileTag.filepath).asc()
                    if sort_order == "asc"
                    else func.count(FileTag.filepath).desc(),
                    Tag.tag_name.asc(),
                )

            page_rows = session.exec(count_stmt.offset(offset).limit(page_size)).all()

            latest_by_tag: dict[str, str] = {}
            for tag_name, _ in page_rows:
                latest_stmt = (
                    select(File.filepath)
                    .join(FileTag, FileTag.filepath == File.filepath)
                    .where(FileTag.tag_name == tag_name)
                    .order_by(File.mtime.desc())
                    .limit(1)
                )
                latest_filepath = session.exec(latest_stmt).first()
                if latest_filepath:
                    latest_by_tag[tag_name] = latest_filepath

        return total, page_rows, latest_by_tag

    try:
        total, page_rows, latest_by_tag = _query_once()
    except OperationalError:
        ensure_index_db_initialized()
        try:
            total, page_rows, latest_by_tag = _query_once()
        except OperationalError:
            return TagsResponse(items=[], page=page, page_size=page_size, total=0)

    items = []
    for tag_name, file_count in page_rows:
        filepath = latest_by_tag.get(tag_name)
        thumbnail = (
            f"{settings.API_V1_STR}/fs/thumb?path={quote(filepath, safe='')}"
            if filepath
            else None
        )
        items.append(
            TagListItem(
                name=tag_name,
                thumbnail=thumbnail,
                file_count=file_count,
            )
        )

    return TagsResponse(items=items, page=page, page_size=page_size, total=total)
