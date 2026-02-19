from __future__ import annotations

from pathlib import Path
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

_TAG_THUMB_CANDIDATE_LIMIT = 3


class TagListItem(BaseModel):
    name: str
    thumbnail: str | None = None
    file_count: int


class TagsResponse(BaseModel):
    items: list[TagListItem]
    page: int
    page_size: int
    total: int


# 接口说明：分页获取标签列表及封面。
@router.get("", response_model=TagsResponse)
async def read_tags(
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    sort_by: Literal["count", "name", "recommendation"] = Query("count"),
    sort_order: Literal["asc", "desc"] = Query("desc"),
) -> TagsResponse:
    offset = (page - 1) * page_size

    def _query_once() -> tuple[int, list[tuple[str, int]], dict[str, list[str]]]:
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
                    func.avg(File.rec_score).asc()
                    if sort_order == "asc"
                    else func.avg(File.rec_score).desc(),
                    Tag.tag_name.asc(),
                )
            else:
                count_stmt = count_stmt.order_by(
                    func.count(FileTag.filepath).asc()
                    if sort_order == "asc"
                    else func.count(FileTag.filepath).desc(),
                    Tag.tag_name.asc(),
                )

            page_rows = session.exec(count_stmt.offset(offset).limit(page_size)).all()

            # Optimized: Use window function to get latest file per tag in single query
            tag_names = [tag_name for tag_name, _, _avg in page_rows]
            latest_candidates_by_tag: dict[str, list[str]] = {}

            if tag_names:
                # Use ROW_NUMBER() window function for efficient single query
                # SQLite 3.25+ supports window functions
                from sqlalchemy import text

                # Single query using window function to get latest file per tag
                # Build IN clause placeholders dynamically for SQLite compatibility
                placeholders = ", ".join([f":tag_{i}" for i in range(len(tag_names))])
                window_query = text(f"""
                    SELECT tag_name, filepath
                    FROM (
                        SELECT ft.tag_name, f.filepath, f.mtime,
                               ROW_NUMBER() OVER (PARTITION BY ft.tag_name ORDER BY f.mtime DESC) as rn
                        FROM file_tags ft
                        JOIN files f ON f.filepath = ft.filepath
                        WHERE ft.tag_name IN ({placeholders})
                          AND f.scan_state = 1
                    )
                    WHERE rn <= :candidate_limit
                    ORDER BY tag_name, rn
                """)
                # Build params dict
                params = {f"tag_{i}": tag for i, tag in enumerate(tag_names)}
                params["candidate_limit"] = _TAG_THUMB_CANDIDATE_LIMIT
                result = session.execute(window_query, params)
                for row in result:
                    latest_candidates_by_tag.setdefault(row[0], []).append(row[1])

        return total, page_rows, latest_candidates_by_tag

    try:
        total, page_rows, latest_candidates_by_tag = _query_once()
    except OperationalError:
        ensure_index_db_initialized()
        try:
            total, page_rows, latest_candidates_by_tag = _query_once()
        except OperationalError:
            return TagsResponse(items=[], page=page, page_size=page_size, total=0)

    items = []
    path_exists_cache: dict[str, bool] = {}
    for tag_name, file_count, _avg_rec in page_rows:
        filepath: str | None = None
        for candidate in latest_candidates_by_tag.get(tag_name, []):
            if candidate not in path_exists_cache:
                path_exists_cache[candidate] = Path(candidate).exists()
            if path_exists_cache[candidate]:
                filepath = candidate
                break

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
