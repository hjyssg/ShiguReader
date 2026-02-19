from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy.exc import OperationalError
from sqlmodel import func, select

from app.index_db.bootstrap import ensure_index_db_initialized
from app.index_db.db import get_index_session
from app.index_db.models import Artist, FileArtist

from ._entity_thumb import (
    build_thumbnail_url,
    find_existing_thumbnail,
    query_artist_thumb_candidates,
)

router = APIRouter(prefix="/cosers", tags=["cosers"])


class CoserListItem(BaseModel):
    name: str
    thumbnail: str | None = None
    file_count: int


class CosersResponse(BaseModel):
    items: list[CoserListItem]
    page: int
    page_size: int
    total: int


@router.get("", response_model=CosersResponse)
async def read_cosers(
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    sort_by: Literal["count", "name"] = Query("count"),
    sort_order: Literal["asc", "desc"] = Query("desc"),
) -> CosersResponse:
    offset = (page - 1) * page_size

    def _query_once() -> tuple[int, list, dict[str, list[str]]]:
        with get_index_session() as session:
            total_stmt = (
                select(func.count())
                .select_from(Artist)
                .join(FileArtist, FileArtist.artist_name == Artist.artist_name)
                .where(FileArtist.role == "coser")
            )
            total = session.exec(total_stmt).one()

            count_stmt = (
                select(
                    Artist.artist_name,
                    func.count(FileArtist.filepath).label("file_count"),
                )
                .select_from(Artist)
                .join(FileArtist, FileArtist.artist_name == Artist.artist_name)
                .where(FileArtist.role == "coser")
                .group_by(Artist.artist_name)
            )

            if sort_by == "name":
                count_stmt = count_stmt.order_by(
                    Artist.artist_name.asc() if sort_order == "asc" else Artist.artist_name.desc()
                )
            else:
                count_stmt = count_stmt.order_by(
                    func.count(FileArtist.filepath).asc() if sort_order == "asc" else func.count(FileArtist.filepath).desc(),
                    Artist.artist_name.asc(),
                )

            page_rows = session.exec(count_stmt.offset(offset).limit(page_size)).all()
            coser_names = [name for name, _ in page_rows]
            candidates = query_artist_thumb_candidates(session, coser_names, role="coser")

        return total, page_rows, candidates

    try:
        total, page_rows, candidates = _query_once()
    except OperationalError:
        ensure_index_db_initialized()
        try:
            total, page_rows, candidates = _query_once()
        except OperationalError:
            return CosersResponse(items=[], page=page, page_size=page_size, total=0)

    cache: dict[str, bool] = {}
    items = []
    for coser_name, file_count in page_rows:
        filepath = find_existing_thumbnail(candidates.get(coser_name, []), cache)
        items.append(
            CoserListItem(
                name=coser_name,
                thumbnail=build_thumbnail_url(filepath) if filepath else None,
                file_count=file_count,
            )
        )

    return CosersResponse(items=items, page=page, page_size=page_size, total=total)
