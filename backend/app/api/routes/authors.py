from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy.exc import OperationalError
from sqlmodel import func, select

from app.index_db.bootstrap import ensure_index_db_initialized
from app.index_db.db import get_index_session
from app.index_db.models import Artist, File, FileArtist

from ._entity_thumb import (
    build_thumbnail_url,
    find_existing_thumbnail,
    query_artist_thumb_candidates,
)

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


@router.get("", response_model=AuthorsResponse)
async def read_authors(
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    sort_by: Literal["count", "name", "recommendation"] = Query("count"),
    sort_order: Literal["asc", "desc"] = Query("desc"),
) -> AuthorsResponse:
    offset = (page - 1) * page_size

    def _query_once() -> tuple[int, list, dict[str, list[str]]]:
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
                    Artist.artist_name.asc() if sort_order == "asc" else Artist.artist_name.desc()
                )
            elif sort_by == "recommendation":
                count_stmt = count_stmt.order_by(
                    func.avg(File.rec_score).asc() if sort_order == "asc" else func.avg(File.rec_score).desc(),
                    Artist.artist_name.asc(),
                )
            else:
                count_stmt = count_stmt.order_by(
                    func.count(FileArtist.filepath).asc() if sort_order == "asc" else func.count(FileArtist.filepath).desc(),
                    Artist.artist_name.asc(),
                )

            page_rows = session.exec(count_stmt.offset(offset).limit(page_size)).all()
            author_names = [name for name, _, _ in page_rows]
            candidates = query_artist_thumb_candidates(session, author_names, role="")

        return total, page_rows, candidates

    try:
        total, page_rows, candidates = _query_once()
    except OperationalError:
        ensure_index_db_initialized()
        try:
            total, page_rows, candidates = _query_once()
        except OperationalError:
            return AuthorsResponse(items=[], page=page, page_size=page_size, total=0)

    cache: dict[str, bool] = {}
    items = []
    for author_name, file_count, avg_rec in page_rows:
        filepath = find_existing_thumbnail(candidates.get(author_name, []), cache)
        items.append(
            AuthorListItem(
                name=author_name,
                thumbnail=build_thumbnail_url(filepath) if filepath else None,
                file_count=file_count,
                avg_rec_score=float(avg_rec or 0.0),
            )
        )

    return AuthorsResponse(items=items, page=page, page_size=page_size, total=total)
