from __future__ import annotations

import time
from pathlib import Path

import pytest

from app.file_processing.stepwise_extractor import stepwise_extract


def test_stepwise_extract_targets_then_remaining(
    file_processing_data: dict[str, object],
    tmp_path: Path,
) -> None:
    archive = file_processing_data["archives"]["zip"]
    output_dir = tmp_path / "output"

    result = stepwise_extract(
        archive,
        output_dir,
        prioritized_entries=["nested/images/001-cover.jpg", "notes.md"],
    )

    first_stage = set(result.first_stage_extracted)
    second_stage = set(result.second_stage_extracted)
    assert "nested/images/001-cover.jpg" in first_stage
    assert "notes.md" in first_stage
    assert "nested/images/002-sample.png" in second_stage
    assert "nested/docs/readme.txt" in second_stage

    assert (output_dir / "nested/images/001-cover.jpg").exists()
    assert (output_dir / "nested/images/002-sample.png").exists()
    assert (output_dir / "nested/docs/readme.txt").exists()
    assert (output_dir / "notes.md").exists()


def test_stepwise_extract_with_rule(
    file_processing_data: dict[str, object],
    tmp_path: Path,
) -> None:
    archive = file_processing_data["archives"]["tar_gz"]
    output_dir = tmp_path / "output-rule"

    result = stepwise_extract(
        archive,
        output_dir,
        prioritized_rule=lambda name: name.endswith(".jpg"),
    )

    assert "nested/images/001-cover.jpg" in result.first_stage_extracted
    assert "nested/images/002-sample.png" in result.second_stage_extracted


def test_stepwise_extract_atomic_on_failure(
    file_processing_data: dict[str, object],
    tmp_path: Path,
) -> None:
    """Test that first stage files are preserved even if second stage fails."""
    archive = file_processing_data["archives"]["zip"]
    output_dir = tmp_path / "broken-output"

    with pytest.raises(RuntimeError):
        stepwise_extract(
            archive,
            output_dir,
            prioritized_entries=["nested/images/001-cover.jpg"],
            fail_after_prioritized=True,
        )

    # With progressive extraction, first stage files should still exist
    assert output_dir.exists()
    assert (output_dir / "nested/images/001-cover.jpg").exists()
    # But second stage files should not exist
    assert not (output_dir / "nested/images/002-sample.png").exists()


def test_stepwise_extract_under_time_limit(
    file_processing_data: dict[str, object],
    tmp_path: Path,
) -> None:
    archive = file_processing_data["archives"]["tar"]
    output_dir = tmp_path / "perf-output"

    start = time.perf_counter()
    result = stepwise_extract(
        archive,
        output_dir,
        prioritized_entries=["notes.md"],
    )
    elapsed = time.perf_counter() - start

    assert len(result.first_stage_extracted) >= 1
    assert elapsed < 2.0


def test_stepwise_extract_benchmark(
    benchmark: pytest.BenchmarkFixture,
    file_processing_data: dict[str, object],
    tmp_path: Path,
) -> None:
    archive = file_processing_data["archives"]["zip"]

    def _run() -> int:
        output_dir = tmp_path / f"bench-{time.time_ns()}"
        result = stepwise_extract(
            archive,
            output_dir,
            prioritized_entries=["notes.md"],
        )
        return len(result.first_stage_extracted) + len(result.second_stage_extracted)

    total = benchmark(_run)
    assert total >= 4
