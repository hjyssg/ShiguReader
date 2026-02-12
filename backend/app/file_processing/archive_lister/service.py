from __future__ import annotations

from pathlib import Path

from app.file_processing._archive_backend import list_entries


def list_archive_entries(archive_path: str | Path) -> list[str]:
    return sorted(list_entries(Path(archive_path)))
