"""Shared thumbnail utilities for entity list endpoints (authors, cosers, tags)."""
from __future__ import annotations

from pathlib import Path
from urllib.parse import quote

from sqlalchemy import text

from app.core.config import settings

THUMB_CANDIDATE_LIMIT = 3


def build_thumbnail_url(filepath: str) -> str:
    return f"{settings.API_V1_STR}/fs/thumb?path={quote(filepath, safe='')}"


def find_existing_thumbnail(
    candidates: list[str],
    cache: dict[str, bool],
) -> str | None:
    for candidate in candidates:
        if candidate not in cache:
            cache[candidate] = Path(candidate).exists()
        if cache[candidate]:
            return candidate
    return None


def query_artist_thumb_candidates(
    session,
    names: list[str],
    role: str,
    limit: int = THUMB_CANDIDATE_LIMIT,
) -> dict[str, list[str]]:
    """Window-function query: get up to `limit` latest existing files per artist."""
    if not names:
        return {}
    placeholders = ", ".join([f":name_{i}" for i in range(len(names))])
    sql = text(f"""
        SELECT artist_name, filepath
        FROM (
            SELECT fa.artist_name, f.filepath, f.mtime,
                   ROW_NUMBER() OVER (PARTITION BY fa.artist_name ORDER BY f.mtime DESC) as rn
            FROM file_artists fa
            JOIN files f ON f.filepath = fa.filepath
            WHERE fa.role = :role
              AND fa.artist_name IN ({placeholders})
              AND f.scan_state = 1
        )
        WHERE rn <= :limit
        ORDER BY artist_name, rn
    """)
    params: dict = {f"name_{i}": n for i, n in enumerate(names)}
    params["role"] = role
    params["limit"] = limit
    result = session.execute(sql, params)
    candidates: dict[str, list[str]] = {}
    for row in result:
        candidates.setdefault(row[0], []).append(row[1])
    return candidates


def query_tag_thumb_candidates(
    session,
    names: list[str],
    limit: int = THUMB_CANDIDATE_LIMIT,
) -> dict[str, list[str]]:
    """Window-function query: get up to `limit` latest existing files per tag."""
    if not names:
        return {}
    placeholders = ", ".join([f":name_{i}" for i in range(len(names))])
    sql = text(f"""
        SELECT tag_name, filepath
        FROM (
            SELECT ft.tag_name, f.filepath, f.mtime,
                   ROW_NUMBER() OVER (PARTITION BY ft.tag_name ORDER BY f.mtime DESC) as rn
            FROM file_tags ft
            JOIN files f ON f.filepath = ft.filepath
            WHERE ft.tag_name IN ({placeholders})
              AND f.scan_state = 1
        )
        WHERE rn <= :limit
        ORDER BY tag_name, rn
    """)
    params: dict = {f"name_{i}": n for i, n in enumerate(names)}
    params["limit"] = limit
    result = session.execute(sql, params)
    candidates: dict[str, list[str]] = {}
    for row in result:
        candidates.setdefault(row[0], []).append(row[1])
    return candidates
