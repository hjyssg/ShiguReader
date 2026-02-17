"""API routes for filename parsing."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.file_processing.name_parser import ParseResult, parse
from app.index_db.db import get_index_session
from app.index_db.repository import IndexRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/parse", tags=["parse"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class ParseResponse(BaseModel):
    title: str
    authors: list[str]
    cosers: list[str] = []
    group: str | None = None
    raw_tags: list[str]
    event: str | None = None
    date_tag: str | None = None
    type: str
    pack_kind: str = "manga"


class BatchParseRequest(BaseModel):
    filepaths: list[str]


class BatchParseItem(BaseModel):
    filepath: str
    result: ParseResponse | None = None


class BatchParseResponse(BaseModel):
    items: list[BatchParseItem]
    parsed_count: int
    total_count: int


class StoredParseResponse(BaseModel):
    filepath: str
    title: str | None = None
    authors: list[str] = []
    cosers: list[str] = []
    group_name: str | None = None
    raw_tags: list[str] = []
    event: str | None = None
    date_tag: str | None = None
    media_type: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _to_response(r: ParseResult) -> ParseResponse:
    return ParseResponse(
        title=r.title,
        authors=r.authors,
        cosers=r.cosers,
        group=r.group,
        raw_tags=r.raw_tags,
        event=r.event,
        date_tag=r.date_tag,
        type=r.type,
        pack_kind=r.pack_kind,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


# 接口说明：批量解析文件名并写入解析结果。
@router.post("/batch", response_model=BatchParseResponse)
async def batch_parse(body: BatchParseRequest) -> BatchParseResponse:
    """Parse a list of filenames and persist results to the index DB."""
    items: list[BatchParseItem] = []
    db_results: list[dict] = []

    for fp in body.filepaths:
        # Use only the filename portion for parsing
        from pathlib import PurePosixPath, PureWindowsPath

        try:
            filename = PureWindowsPath(fp).name
        except Exception:
            filename = PurePosixPath(fp).name

        result = parse(filename)
        if result is not None:
            items.append(BatchParseItem(filepath=fp, result=_to_response(result)))
            db_results.append(
                {
                    "filepath": fp,
                    "title": result.title,
                    "authors": result.authors,
                    "cosers": result.cosers,
                    "group_name": result.group,
                    "raw_tags": result.raw_tags,
                    "event": result.event,
                    "date_tag": result.date_tag,
                    "media_type": result.type,
                }
            )
        else:
            items.append(BatchParseItem(filepath=fp, result=None))

    # Persist to DB
    if db_results:
        try:
            with get_index_session() as session:
                repo = IndexRepository(session)
                repo.batch_save_parse_results(db_results)
        except Exception as e:
            logger.error(f"Failed to persist parse results: {e}")

    parsed_count = sum(1 for i in items if i.result is not None)
    return BatchParseResponse(
        items=items,
        parsed_count=parsed_count,
        total_count=len(items),
    )


# 接口说明：根据文件路径查询已保存的解析结果。
@router.get("", response_model=StoredParseResponse)
async def get_parse_result(
    filepath: str = Query(..., description="File path to look up"),
) -> StoredParseResponse:
    """Retrieve stored parse result for a single file."""
    with get_index_session() as session:
        repo = IndexRepository(session)
        meta = repo.get_parsed_metadata(filepath)
        if meta is None:
            raise HTTPException(status_code=404, detail="No parse result found")

        authors = repo.get_file_artists(filepath)
        cosers = repo.get_file_cosers(filepath)
        tags = repo.get_file_tags(filepath)

    return StoredParseResponse(
        filepath=filepath,
        title=meta.title,
        authors=authors,
        cosers=cosers,
        group_name=meta.group_name,
        raw_tags=tags,
        event=meta.event,
        date_tag=meta.date_tag,
        media_type=meta.media_type,
    )
