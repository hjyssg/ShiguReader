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


class AuthorsResponse(BaseModel):
    items: list[AuthorListItem]
    page: int
    page_size: int
    total: int


@router.get("", response_model=AuthorsResponse)
async def read_authors(
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    sort_by: Literal["count", "name"] = Query("count"),
    sort_order: Literal["asc", "desc"] = Query("desc"),
) -> AuthorsResponse:
    offset = (page - 1) * page_size

    def _query_once() -> tuple[int, list[tuple[str, int]], dict[str, str]]:
        with get_index_session() as session:
            total_stmt = select(func.count()).select_from(Artist)
            total = session.exec(total_stmt).one()

            count_stmt = (
                select(
                    Artist.artist_name,
                    func.count(FileArtist.filepath).label("file_count"),
                )
                .select_from(Artist)
                .join(FileArtist, FileArtist.artist_name == Artist.artist_name, isouter=True)
                .group_by(Artist.artist_name)
            )

            if sort_by == "name":
                count_stmt = count_stmt.order_by(
                    Artist.artist_name.asc()
                    if sort_order == "asc"
                    else Artist.artist_name.desc()
                )
            else:
                count_stmt = count_stmt.order_by(
                    func.count(FileArtist.filepath).asc()
                    if sort_order == "asc"
                    else func.count(FileArtist.filepath).desc(),
                    Artist.artist_name.asc(),
                )

            page_rows = session.exec(count_stmt.offset(offset).limit(page_size)).all()

            latest_by_author: dict[str, str] = {}
            for author_name, _ in page_rows:
                latest_stmt = (
                    select(File.filepath)
                    .join(FileArtist, FileArtist.filepath == File.filepath)
                    .where(FileArtist.artist_name == author_name)
                    .order_by(File.mtime.desc())
                    .limit(1)
                )
                latest_filepath = session.exec(latest_stmt).first()
                if latest_filepath:
                    latest_by_author[author_name] = latest_filepath

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
    for author_name, file_count in page_rows:
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
            )
        )

    return AuthorsResponse(items=items, page=page, page_size=page_size, total=total)
