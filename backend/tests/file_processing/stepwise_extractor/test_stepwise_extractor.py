from __future__ import annotations

import time
from pathlib import Path

import pytest

from app.file_processing.stepwise_extractor import stepwise_extract


def test_stepwise_extract_targets_then_remaining(
    file_processing_data: dict[str, object],
    tmp_path: Path,
) -> None:
    """向后兼容测试：旧的两阶段 API（prioritized_entries）仍然正常工作。"""
    archive = file_processing_data["archives"]["zip"]
    output_dir = tmp_path / "output"

    result = stepwise_extract(
        archive,
        output_dir,
        prioritized_entries=["nested/images/001-cover.jpg", "notes.md"],
    )

    # 旧 API 的 prioritized_entries 会被当作阶段 1
    first_stage = set(result.first_stage_extracted)
    third_stage = set(result.third_stage_extracted)
    assert "nested/images/001-cover.jpg" in first_stage
    assert "notes.md" in first_stage
    assert "nested/images/002-sample.png" in third_stage
    assert "nested/docs/readme.txt" in third_stage

    # 所有文件都应该被解压
    assert (output_dir / "nested/images/001-cover.jpg").exists()
    assert (output_dir / "nested/images/002-sample.png").exists()
    assert (output_dir / "nested/docs/readme.txt").exists()
    assert (output_dir / "notes.md").exists()


def test_stepwise_extract_three_stages(
    file_processing_data: dict[str, object],
    tmp_path: Path,
) -> None:
    """三阶段解压测试：验证当前页、前后页、剩余文件的分阶段解压。"""
    archive = file_processing_data["archives"]["zip"]
    output_dir = tmp_path / "output-3stage"

    result = stepwise_extract(
        archive,
        output_dir,
        current_page_entries=["nested/images/001-cover.jpg"],
        secondary_entries=["notes.md", "nested/images/002-sample.png"],
    )

    # 验证阶段 1：当前页（只有 1 个文件）
    assert "nested/images/001-cover.jpg" in result.first_stage_extracted
    assert len(result.first_stage_extracted) == 1

    # 验证阶段 2：前后页（次优先级）
    assert "notes.md" in result.second_stage_extracted
    assert "nested/images/002-sample.png" in result.second_stage_extracted

    # 验证阶段 3：剩余文件
    assert "nested/docs/readme.txt" in result.third_stage_extracted

    # 所有文件都应该存在
    assert (output_dir / "nested/images/001-cover.jpg").exists()
    assert (output_dir / "notes.md").exists()
    assert (output_dir / "nested/images/002-sample.png").exists()
    assert (output_dir / "nested/docs/readme.txt").exists()


def test_stepwise_extract_with_rule(
    file_processing_data: dict[str, object],
    tmp_path: Path,
) -> None:
    """规则过滤测试：通过 prioritized_rule 函数筛选优先解压的文件。"""
    archive = file_processing_data["archives"]["tar_gz"]
    output_dir = tmp_path / "output-rule"

    result = stepwise_extract(
        archive,
        output_dir,
        prioritized_rule=lambda name: name.endswith(".jpg"),
    )

    # .jpg 文件应该在阶段 1
    assert "nested/images/001-cover.jpg" in result.first_stage_extracted
    # .png 文件应该在阶段 3（剩余文件）
    assert "nested/images/002-sample.png" in result.third_stage_extracted


def test_stepwise_extract_atomic_on_failure(
    file_processing_data: dict[str, object],
    tmp_path: Path,
) -> None:
    """阶段 1 失败后的原子性测试：阶段 1 已解压的文件应保留，阶段 2/3 不存在。"""
    archive = file_processing_data["archives"]["zip"]
    output_dir = tmp_path / "broken-output"

    with pytest.raises(RuntimeError):
        stepwise_extract(
            archive,
            output_dir,
            prioritized_entries=["nested/images/001-cover.jpg"],
            fail_after_prioritized=True,
        )

    # 阶段 1 的文件应该保留（渐进式解压的核心保证）
    assert output_dir.exists()
    assert (output_dir / "nested/images/001-cover.jpg").exists()
    # 阶段 2/3 的文件不应该存在
    assert not (output_dir / "nested/images/002-sample.png").exists()


def test_stepwise_extract_secondary_failure_preserves_first_stage(
    file_processing_data: dict[str, object],
    tmp_path: Path,
) -> None:
    """阶段 2 失败后的原子性测试：阶段 1 文件保留，阶段 2 部分保留，阶段 3 不存在。

    这模拟了解压前后页时出错的场景。用户当前阅读的页面（阶段 1）不受影响。
    """
    archive = file_processing_data["archives"]["zip"]
    output_dir = tmp_path / "secondary-broken"

    with pytest.raises(RuntimeError, match="模拟失败：阶段 2"):
        stepwise_extract(
            archive,
            output_dir,
            current_page_entries=["nested/images/001-cover.jpg"],
            secondary_entries=["notes.md"],
            fail_after_secondary=True,
        )

    # 阶段 1 的文件必须保留（当前页不受影响）
    assert (output_dir / "nested/images/001-cover.jpg").exists()
    # 阶段 2 的文件也应该保留（已经直接写入 output_dir）
    assert (output_dir / "notes.md").exists()
    # 阶段 3 的文件不应该存在（还没开始解压就失败了）
    assert not (output_dir / "nested/images/002-sample.png").exists()
    assert not (output_dir / "nested/docs/readme.txt").exists()


def test_stepwise_extract_third_stage_image_priority(
    file_processing_data: dict[str, object],
    tmp_path: Path,
) -> None:
    """第三阶段图片优先排序测试：剩余文件中图片应排在非图片文件前面。"""
    archive = file_processing_data["archives"]["zip"]
    output_dir = tmp_path / "output-priority"

    result = stepwise_extract(
        archive,
        output_dir,
        # 只把一个文件放在阶段 1，其余全部进入阶段 3
        current_page_entries=["notes.md"],
    )

    # 阶段 3 中，图片文件应该排在 .txt 文件前面
    third = result.third_stage_extracted
    image_indices = [i for i, e in enumerate(third) if e.endswith((".jpg", ".png"))]
    txt_indices = [i for i, e in enumerate(third) if e.endswith(".txt")]

    if image_indices and txt_indices:
        # 所有图片的索引都应该小于所有 txt 的索引
        assert max(image_indices) < min(txt_indices), (
            f"图片应排在 txt 前面，但实际顺序: {third}"
        )


def test_stepwise_extract_under_time_limit(
    file_processing_data: dict[str, object],
    tmp_path: Path,
) -> None:
    """性能测试：解压应在 2 秒内完成。"""
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
    """基准测试：衡量解压性能。"""
    archive = file_processing_data["archives"]["zip"]

    def _run() -> int:
        output_dir = tmp_path / f"bench-{time.time_ns()}"
        result = stepwise_extract(
            archive,
            output_dir,
            prioritized_entries=["notes.md"],
        )
        # 旧 API 下 prioritized_entries 全部进入阶段 1，阶段 2 为空
        return len(result.first_stage_extracted) + len(result.third_stage_extracted)

    total = benchmark(_run)
    assert total >= 4
