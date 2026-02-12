from __future__ import annotations

import time
from pathlib import Path

import pytest

from app.file_processing.archive_lister import list_archive_entries


def _assert_common_entries(entries: list[str]) -> None:
    assert "nested/images/001-cover.jpg" in entries
    assert "nested/images/002-sample.png" in entries
    assert "nested/docs/readme.txt" in entries
    assert "notes.md" in entries


def test_list_zip_entries(file_processing_data: dict[str, object]) -> None:
    archive = file_processing_data["archives"]["zip"]
    entries = list_archive_entries(archive)
    _assert_common_entries(entries)


def test_list_tar_entries(file_processing_data: dict[str, object]) -> None:
    archive = file_processing_data["archives"]["tar"]
    entries = list_archive_entries(archive)
    _assert_common_entries(entries)


def test_list_tar_gz_entries(file_processing_data: dict[str, object]) -> None:
    archive = file_processing_data["archives"]["tar_gz"]
    entries = list_archive_entries(archive)
    _assert_common_entries(entries)


def test_list_tar_bz2_entries(file_processing_data: dict[str, object]) -> None:
    archive = file_processing_data["archives"]["tar_bz2"]
    entries = list_archive_entries(archive)
    _assert_common_entries(entries)


def test_list_7z_entries_if_available(file_processing_data: dict[str, object]) -> None:
    archive = file_processing_data["archives"].get("7z")
    if archive is None:
        pytest.skip("7z archive not generated, py7zr dependency may be missing")
    entries = list_archive_entries(archive)
    _assert_common_entries(entries)


def test_list_rar_entries_if_available(file_processing_data: dict[str, object]) -> None:
    archive = file_processing_data["archives"].get("rar")
    if archive is None:
        pytest.skip("rar archive not generated, rar tool may be unavailable")
    entries = list_archive_entries(archive)
    _assert_common_entries(entries)


def test_list_archive_invalid_suffix(tmp_path: Path) -> None:
    bad_file = tmp_path / "bad.bin"
    bad_file.write_bytes(b"not-archive")
    with pytest.raises(ValueError):
        list_archive_entries(bad_file)


def test_list_archive_under_time_limit(file_processing_data: dict[str, object]) -> None:
    archive = file_processing_data["archives"]["zip"]
    start = time.perf_counter()
    entries = list_archive_entries(archive)
    elapsed = time.perf_counter() - start
    assert len(entries) >= 4
    assert elapsed < 1.0


def test_list_archive_benchmark(
    benchmark: pytest.BenchmarkFixture,
    file_processing_data: dict[str, object],
) -> None:
    archive = file_processing_data["archives"]["tar_gz"]
    result = benchmark(list_archive_entries, archive)
    assert len(result) >= 4
