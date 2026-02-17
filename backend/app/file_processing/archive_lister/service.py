from __future__ import annotations

from pathlib import Path

from app.file_processing._archive_backend import list_entries


def _normalize_archive_path(archive_path: str | Path) -> Path:
    """Normalize input into ``Path`` for backend adapters.

    Keep this conversion in one place so callers can pass either ``str`` or
    ``Path`` without each call site duplicating the same coercion logic.
    """
    return Path(archive_path)


def list_archive_entries(archive_path: str | Path) -> list[str]:
    normalized_path = _normalize_archive_path(archive_path)

    # Keep deterministic ordering for stable UI rendering and easier caching.
    return sorted(list_entries(normalized_path))
