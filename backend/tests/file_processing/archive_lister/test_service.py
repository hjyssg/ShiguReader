from __future__ import annotations

from pathlib import Path

import pytest

from app.file_processing.archive_lister import service


def test_list_archive_entries_normalizes_path_and_returns_sorted(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    archive = tmp_path / "sample.zip"
    archive.write_bytes(b"dummy")

    captured: dict[str, Path] = {}

    def _fake_list_entries(path: Path) -> list[str]:
        captured["path"] = path
        return ["b/002.png", "a/001.png"]

    monkeypatch.setattr(service, "list_entries", _fake_list_entries)

    result = service.list_archive_entries(str(archive))

    assert captured["path"] == archive
    assert result == ["a/001.png", "b/002.png"]


def test_list_archive_entries_rejects_none_input() -> None:
    with pytest.raises(TypeError):
        service.list_archive_entries(None)  # type: ignore[arg-type]


def test_list_archive_entries_propagates_backend_errors(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    archive = tmp_path / "broken.zip"
    archive.write_bytes(b"broken")

    def _raise_backend_error(_path: Path) -> list[str]:
        raise RuntimeError("backend failed")

    monkeypatch.setattr(service, "list_entries", _raise_backend_error)

    with pytest.raises(RuntimeError, match="backend failed"):
        service.list_archive_entries(archive)