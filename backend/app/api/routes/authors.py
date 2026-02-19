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
from app.index_db.models import Artist, File, FileArtist


router = APIRouter(prefix="/authors", tags=["authors"])


class AuthorListItem(BaseModel):
    name: str
    thumbnail: str | None = None
    file_count: int
    avg_rec_score: float = 0.0


class AuthorsResponse(BaseModel):
    items: list[AuthorListItem]
    page: int
    page_size: int
    total: int


# 接口说明：分页获取作者列表及封面。
@router.get("", response_model=AuthorsResponse)
async def read_authors(
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    sort_by: Literal["count", "name", "recommendation"] = Query("count"),
    sort_order: Literal["asc", "desc"] = Query("desc"),
) -> AuthorsResponse:
    offset = (page - 1) * page_size

    def _query_once() -> tuple[int, list[tuple[str, int]], dict[str, str]]:
        with get_index_session() as session:
            total_stmt = (
                select(func.count(func.distinct(Artist.artist_name)))
                .select_from(Artist)
                .join(FileArtist, FileArtist.artist_name == Artist.artist_name)
                .where(FileArtist.role == "")
            )
            total = session.exec(total_stmt).one()

            count_stmt = (
                select(
                    Artist.artist_name,
                    func.count(FileArtist.filepath).label("file_count"),
                    func.avg(File.rec_score).label("avg_rec_score"),
                )
                .select_from(Artist)
                .join(FileArtist, FileArtist.artist_name == Artist.artist_name, isouter=True)
                .join(File, File.filepath == FileArtist.filepath, isouter=True)
                .where(FileArtist.role == "")
                .group_by(Artist.artist_name)
            )

            if sort_by == "name":
                count_stmt = count_stmt.order_by(
                    Artist.artist_name.asc()
                    if sort_order == "asc"
                    else Artist.artist_name.desc()
                )
            elif sort_by == "recommendation":
                count_stmt = count_stmt.order_by(
                    func.avg(File.rec_score).asc()
                    if sort_order == "asc"
                    else func.avg(File.rec_score).desc(),
                    Artist.artist_name.asc(),
                )
            else:
                count_stmt = count_stmt.order_by(
                    func.count(FileArtist.filepath).asc()
                    if sort_order == "asc"
                    else func.count(FileArtist.filepath).desc(),
                    Artist.artist_name.asc(),
                )

            page_rows = session.exec(count_stmt.offset(offset).limit(page_size)).all()

            # Optimized: Use window function to get latest file per author in single query
            author_names = [author_name for author_name, _, _avg in page_rows]
            latest_by_author: dict[str, str] = {}

            if author_names:
                from sqlalchemy import text

                placeholders = ", ".join([f":author_{i}" for i in range(len(author_names))])
                window_query = text(f"""
                    SELECT artist_name, filepath
                    FROM (
                        SELECT fa.artist_name, f.filepath, f.mtime,
                               ROW_NUMBER() OVER (PARTITION BY fa.artist_name ORDER BY f.mtime DESC) as rn
                        FROM file_artists fa
                        JOIN files f ON f.filepath = fa.filepath
                        WHERE fa.role = ''
                          AND fa.artist_name IN ({placeholders})
                    )
                    WHERE rn = 1
                """)
                params = {f"author_{i}": name for i, name in enumerate(author_names)}
                result = session.execute(window_query, params)
                for row in result:
                    latest_by_author[row[0]] = row[1]

        return total, page_rows, latest_by_author

    try:
        total, page_rows, latest_by_author = _query_once()
    except OperationalError:
        ensure_index_db_initialized()
        try:
            total, page_rows, latest_by_author = _query_once()
        except OperationalError:
            return AuthorsResponse(items=[], page=page, page_size=page_size, total=0)

    items = []
    for author_name, file_count, _avg_rec in page_rows:
        filepath = latest_by_author.get(author_name)
        thumbnail = (
            f"{settings.API_V1_STR}/fs/thumb?path={quote(filepath, safe='')}"
            if filepath
            else None
        )
        items.append(
            AuthorListItem(
                name=author_name,
                thumbnail=thumbnail,
                file_count=file_count,
                avg_rec_score=float(_avg_rec or 0.0),
            )
        )

    return AuthorsResponse(items=items, page=page, page_size=page_size, total=total)
