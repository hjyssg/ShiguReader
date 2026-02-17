from __future__ import annotations

import re
from functools import lru_cache
from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.api.routes.fs import FileSystemItem
from app.core.config import settings
from app.file_processing.name_parser import ParseResult, parse
from app.index_db.confidence import compute_confidence
from app.index_db.db import get_index_session
from app.index_db.models import File
from app.index_db.repository import IndexRepository

router = APIRouter(prefix="/search", tags=["search"])


class SearchRequest(BaseModel):
    q: str = Field(default="")
    scopes: list[Literal["file", "author", "coser", "tag"]] = Field(
        default_factory=lambda: ["file", "author", "coser", "tag"]
    )
    mode: Literal["exact", "hybrid"] = "hybrid"
    presence_filter: Literal["all", "watched", "scanned_recent"] = "all"


class SearchResponse(BaseModel):
    items: list[FileSystemItem]
    total: int


class QuickMatchBatchRequest(BaseModel):
    queries: list[str] = Field(default_factory=list)
    limit: int = Field(default=5, ge=1, le=20)
    chunk_size: int = Field(default=20, ge=1, le=50)
    presence_filter: Literal["all", "watched", "scanned_recent"] = "all"


class QuickMatchHit(BaseModel):
    name: str
    path: str
    match_level: Literal["downloaded", "likely", "same_author", "different"]
    confidence: float
    reason: str


class QuickMatchResult(BaseModel):
    q: str
    query_core: str
    match_level: Literal["downloaded", "likely", "same_author", "different"]
    confidence: float
    reason: str
    hits: list[QuickMatchHit]
    search_url: str


class QuickMatchBatchResponse(BaseModel):
    results: list[QuickMatchResult]


_BRACKET_BLOCK_RE = re.compile(r"\[[^\]]*\]|\([^\)]*\)")
_NON_WORD_SPLIT_RE = re.compile(r"[^\w\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+", re.UNICODE)
_DIGIT_RE = re.compile(r"\d+")


def _normalize_text(value: str) -> str:
    """Normalize text for matching by trimming spaces and lowercasing."""
    normalized = " ".join((value or "").strip().lower().split())
    return normalized


def _extract_digit_tokens(value: str) -> list[str]:
    """Extract all digit chunks from a string in original order."""
    return _DIGIT_RE.findall(value or "")


def _compare_internal_digits(lhs: str, rhs: str) -> bool:
    """Return True only when two strings have identical internal digit sequences."""
    return _extract_digit_tokens(lhs) == _extract_digit_tokens(rhs)


def _levenshtein_distance(lhs: str, rhs: str) -> int:
    """Compute Levenshtein edit distance between two strings."""
    if lhs == rhs:
        return 0
    if not lhs:
        return len(rhs)
    if not rhs:
        return len(lhs)

    if len(lhs) < len(rhs):
        lhs, rhs = rhs, lhs

    previous = list(range(len(rhs) + 1))
    for i, c1 in enumerate(lhs, start=1):
        current = [i]
        for j, c2 in enumerate(rhs, start=1):
            ins = current[j - 1] + 1
            delete = previous[j] + 1
            replace = previous[j - 1] + (c1 != c2)
            current.append(min(ins, delete, replace))
        previous = current
    return previous[-1]


def _is_highly_similar_title(lhs: str, rhs: str) -> bool:
    """Judge whether two titles are highly similar with digit-guarded fuzzy matching."""
    a = _normalize_text(lhs)
    b = _normalize_text(rhs)
    if not a and not b:
        return True
    if not a or not b:
        return False
    if not _compare_internal_digits(a, b):
        return False
    if a == b:
        return True
    distance = _levenshtein_distance(a, b)
    avg_len = (len(a) + len(b)) / 2
    ratio = distance / max(1, int(avg_len + 0.9999))
    return ratio <= 0.2


def _extract_core_query(raw_title: str) -> str:
    """Extract a compact core phrase from a long title for fast candidate recall."""
    title = (raw_title or "").strip()
    if not title:
        return ""

    stripped = _BRACKET_BLOCK_RE.sub(" ", title)
    stripped = _normalize_text(stripped)
    if not stripped:
        return _normalize_text(title)

    tokens = [t for t in _NON_WORD_SPLIT_RE.split(stripped) if t]
    if not tokens:
        return stripped

    if len(tokens) <= 6:
        return " ".join(tokens)
    return " ".join(tokens[:6])


def _author_set(parsed: ParseResult | None) -> set[str]:
    """Build a normalized author/group set from parsed metadata."""
    if parsed is None:
        return set()
    out = {_normalize_text(a) for a in parsed.authors if _normalize_text(a)}
    if parsed.group:
        group = _normalize_text(parsed.group)
        if group:
            out.add(group)
    return out


def _parsed_title(parsed: ParseResult | None, fallback: str) -> str:
    """Return parsed title when available, otherwise fallback to raw text."""
    if parsed and parsed.title:
        return parsed.title
    return fallback


def _score_match(
    query: str,
    query_parsed: ParseResult | None,
    candidate: File,
    candidate_parsed: ParseResult | None,
    candidate_authors: list[str],
) -> tuple[Literal["downloaded", "likely", "same_author", "different"], float, str]:
    """Score one candidate against one query and return level, confidence, and reason."""
    query_title = _parsed_title(query_parsed, query)
    candidate_title = _parsed_title(candidate_parsed, candidate.filename)

    title_similar = _is_highly_similar_title(query_title, candidate_title)
    digits_same = _compare_internal_digits(_normalize_text(query_title), _normalize_text(candidate_title))

    query_author_set = _author_set(query_parsed)
    candidate_author_set = {_normalize_text(a) for a in candidate_authors if _normalize_text(a)}
    candidate_author_set.update(_author_set(candidate_parsed))

    same_author = bool(query_author_set and candidate_author_set and (query_author_set & candidate_author_set))

    if title_similar and same_author:
        return ("downloaded", 0.97, "title_similar+same_author")
    if title_similar and digits_same:
        return ("likely", 0.78, "title_similar")
    if same_author:
        return ("same_author", 0.45, "same_author_only")
    if not digits_same:
        return ("different", 0.05, "digit_mismatch")
    return ("different", 0.1, "no_strong_signal")


def _best_level_rank(level: str) -> int:
    """Map match level to a sortable rank where higher means stronger match."""
    return {
        "downloaded": 4,
        "likely": 3,
        "same_author": 2,
        "different": 1,
    }.get(level, 0)


@lru_cache(maxsize=2048)
def _parse_cached(value: str) -> ParseResult | None:
    """Parse title text with LRU cache to reduce repeated parser overhead."""
    return parse(value)


def _to_item(file: File) -> FileSystemItem:
    """Convert an index File row into API FileSystemItem payload."""
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


# 接口说明：按范围执行综合搜索。
@router.post("", response_model=SearchResponse)
def search_files(body: SearchRequest) -> SearchResponse:
    """Run unified search across selected scopes and return deduplicated items."""
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

        if "coser" in body.scopes:
            for f in repo.search_by_coser(q, body.mode, body.presence_filter):
                by_filepath[f.filepath] = f

        if "tag" in body.scopes:
            for f in repo.search_by_tag(q, body.mode, body.presence_filter):
                by_filepath[f.filepath] = f

    items = [_to_item(f) for f in by_filepath.values()]
    items.sort(key=lambda x: x.name.lower())
    return SearchResponse(items=items, total=len(items))


# 接口说明：批量快速匹配“是否已下载”。
@router.post("/quick-match-batch", response_model=QuickMatchBatchResponse)
def quick_match_batch(body: QuickMatchBatchRequest) -> QuickMatchBatchResponse:
    """Batch-evaluate queries for fast downloaded/not-downloaded matching."""
    queries = [(q or "").strip() for q in body.queries]
    queries = [q for q in queries if q]
    if not queries:
        return QuickMatchBatchResponse(results=[])

    with get_index_session() as session:
        repo = IndexRepository(session)
        results: list[QuickMatchResult] = []

        for i in range(0, len(queries), body.chunk_size):
            chunk = queries[i : i + body.chunk_size]

            for raw_q in chunk:
                query_core = _extract_core_query(raw_q)
                query_parsed = _parse_cached(raw_q)

                candidates_by_path: dict[str, File] = {}
                for f in repo.search_files(query_core or raw_q, mode="hybrid", presence_filter=body.presence_filter):
                    candidates_by_path[f.filepath] = f

                if query_parsed:
                    author_candidates = query_parsed.authors[:]
                    if query_parsed.group:
                        author_candidates.append(query_parsed.group)
                    for token in author_candidates:
                        for f in repo.search_by_author(token, mode="hybrid", presence_filter=body.presence_filter):
                            candidates_by_path[f.filepath] = f

                candidates = list(candidates_by_path.values())
                filepaths = [c.filepath for c in candidates]
                authors_by_path = repo.get_artists_by_filepaths(filepaths)
                parsed_by_path = repo.get_parsed_metadata_by_filepaths(filepaths)

                scored_hits: list[QuickMatchHit] = []
                for candidate in candidates:
                    parsed_meta = parsed_by_path.get(candidate.filepath)
                    candidate_parse = None
                    if parsed_meta and parsed_meta.title:
                        candidate_parse = ParseResult(
                            title=parsed_meta.title,
                            authors=authors_by_path.get(candidate.filepath, []),
                            group=parsed_meta.group_name,
                        )

                    level, confidence, reason = _score_match(
                        raw_q,
                        query_parsed,
                        candidate,
                        candidate_parse,
                        authors_by_path.get(candidate.filepath, []),
                    )
                    scored_hits.append(
                        QuickMatchHit(
                            name=candidate.filename,
                            path=candidate.filepath,
                            match_level=level,
                            confidence=round(confidence, 3),
                            reason=reason,
                        )
                    )

                scored_hits.sort(
                    key=lambda h: (-_best_level_rank(h.match_level), -h.confidence, h.name.lower())
                )
                top_hits = scored_hits[: body.limit]

                if top_hits:
                    best = top_hits[0]
                    level = best.match_level
                    confidence = best.confidence
                    reason = best.reason
                else:
                    level = "different"
                    confidence = 0.0
                    reason = "no_candidates"

                results.append(
                    QuickMatchResult(
                        q=raw_q,
                        query_core=query_core,
                        match_level=level,
                        confidence=confidence,
                        reason=reason,
                        hits=top_hits,
                        search_url=f"/search?q={quote(raw_q)}",
                    )
                )

    return QuickMatchBatchResponse(results=results)
