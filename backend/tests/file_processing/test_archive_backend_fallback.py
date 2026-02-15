from __future__ import annotations

import tarfile
import zipfile
from pathlib import Path

import pytest

from app.file_processing import _archive_backend as backend


def test_list_entries_zip_fallback_to_7z(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    archive = tmp_path / "broken.zip"
    archive.write_bytes(b"not-a-real-zip")

    class _BrokenZipFile:
        def __init__(self, *_args, **_kwargs) -> None:
            pass

        def __enter__(self):
            raise zipfile.BadZipFile("broken zip")

        def __exit__(self, *_args) -> None:
            return None

    monkeypatch.setattr(backend.zipfile, "ZipFile", _BrokenZipFile)
    monkeypatch.setattr(
        backend,
        "_list_entries_via_7z",
        lambda _archive_path: ["nested/images/001-cover.jpg", "notes.md"],
    )

    entries = backend.list_entries(archive)
    assert entries == ["nested/images/001-cover.jpg", "notes.md"]


def test_extract_entries_zip_fallback_to_7z(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    archive = tmp_path / "broken.zip"
    archive.write_bytes(b"not-a-real-zip")
    out = tmp_path / "out"

    class _BrokenZipFile:
        def __init__(self, *_args, **_kwargs) -> None:
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_args) -> None:
            return None

        def extract(self, *_args, **_kwargs) -> None:
            raise RuntimeError("zip extract failed")

    called = {"used": False}

    def _fake_extract_via_7z(_archive_path: Path, _destination: Path, _entries: list[str]) -> None:
        called["used"] = True

    monkeypatch.setattr(backend.zipfile, "ZipFile", _BrokenZipFile)
    monkeypatch.setattr(backend, "_extract_entries_via_7z", _fake_extract_via_7z)

    backend.extract_entries(archive, out, ["nested/images/001-cover.jpg"])
    assert called["used"] is True


def test_list_entries_tar_failure_does_not_fallback(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    archive = tmp_path / "broken.tar"
    archive.write_bytes(b"not-a-real-tar")

    def _broken_tar_open(*_args, **_kwargs):
        raise tarfile.ReadError("broken tar")

    called = {"used": False}

    def _fake_list_via_7z(_archive_path: Path) -> list[str]:
        called["used"] = True
        return []

    monkeypatch.setattr(backend.tarfile, "open", _broken_tar_open)
    monkeypatch.setattr(backend, "_list_entries_via_7z", _fake_list_via_7z)

    with pytest.raises(tarfile.ReadError):
        backend.list_entries(archive)

    assert called["used"] is False


def test_extract_entries_error_contains_primary_and_fallback(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    archive = tmp_path / "broken.zip"
    archive.write_bytes(b"not-a-real-zip")

    class _BrokenZipFile:
        def __init__(self, *_args, **_kwargs) -> None:
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_args) -> None:
            return None

        def extract(self, *_args, **_kwargs) -> None:
            raise RuntimeError("primary failed")

    def _broken_7z(*_args, **_kwargs) -> None:
        raise RuntimeError("fallback failed")

    monkeypatch.setattr(backend.zipfile, "ZipFile", _BrokenZipFile)
    monkeypatch.setattr(backend, "_extract_entries_via_7z", _broken_7z)

    with pytest.raises(RuntimeError, match="primary failed") as exc_info:
        backend.extract_entries(archive, tmp_path / "out", ["a.jpg"])

    assert "fallback failed" in str(exc_info.value)
