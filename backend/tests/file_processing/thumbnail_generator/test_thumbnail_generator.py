from __future__ import annotations

import time
from pathlib import Path

import pytest
from PIL import Image

from app.file_processing.thumbnail_generator import generate_first_image_thumbnail


def test_generate_first_image_thumbnail(file_processing_data: dict[str, object], tmp_path: Path) -> None:
    archive = file_processing_data["archives"]["zip"]
    output = tmp_path / "thumb.jpg"

    result = generate_first_image_thumbnail(archive, output)
    assert result.source_entry.endswith("001-cover.jpg")
    assert output.exists()

    with Image.open(output) as img:
        assert img.height == 350
        assert img.width > 0


def test_generate_thumbnail_for_tar(file_processing_data: dict[str, object], tmp_path: Path) -> None:
    archive = file_processing_data["archives"]["tar_bz2"]
    output = tmp_path / "thumb-tar.jpg"

    result = generate_first_image_thumbnail(archive, output)
    assert "nested/images/001-cover.jpg" == result.source_entry


def test_generate_thumbnail_7z_if_available(
    file_processing_data: dict[str, object],
    tmp_path: Path,
) -> None:
    archive = file_processing_data["archives"].get("7z")
    if archive is None:
        pytest.skip("7z archive not generated")

    output = tmp_path / "thumb-7z.jpg"
    result = generate_first_image_thumbnail(archive, output)
    assert result.output_path == output


def test_generate_thumbnail_no_image_raises(tmp_path: Path) -> None:
    import zipfile

    archive = tmp_path / "no-image.zip"
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("readme.txt", "hello")

    with pytest.raises(FileNotFoundError):
        generate_first_image_thumbnail(archive, tmp_path / "out.jpg")


def test_generate_thumbnail_under_time_limit(
    file_processing_data: dict[str, object],
    tmp_path: Path,
) -> None:
    archive = file_processing_data["archives"]["zip"]
    output = tmp_path / "perf-thumb.jpg"

    start = time.perf_counter()
    generate_first_image_thumbnail(archive, output)
    elapsed = time.perf_counter() - start

    assert elapsed < 2.0


def test_generate_thumbnail_benchmark(
    benchmark: pytest.BenchmarkFixture,
    file_processing_data: dict[str, object],
    tmp_path: Path,
) -> None:
    archive = file_processing_data["archives"]["tar_gz"]

    def _run() -> int:
        output = tmp_path / f"bench-thumb-{time.time_ns()}.jpg"
        result = generate_first_image_thumbnail(archive, output)
        return output.stat().st_size + len(result.source_entry)

    value = benchmark(_run)
    assert value > 0
