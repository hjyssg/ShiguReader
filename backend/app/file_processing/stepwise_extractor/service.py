from __future__ import annotations

import shutil
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from app.file_processing._archive_backend import extract_entries, list_entries
from app.file_processing.ignore import should_ignore


# ---------------------------------------------------------------------------
# 文件类型优先级（数字越小越优先）
# 用于第三阶段解压时，确保图片最先被解压，视频/音频次之
# ---------------------------------------------------------------------------
_IMAGE_SUFFIXES = frozenset((".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".heic"))
_VIDEO_SUFFIXES = frozenset((".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv"))
_AUDIO_SUFFIXES = frozenset((".mp3", ".flac", ".wav", ".aac", ".ogg", ".m4a"))


def _media_priority(entry: str) -> int:
    """返回文件的解压优先级，数字越小越优先。

    优先级：图片(0) > 视频(1) > 音频(2) > 其他(3)
    """
    suffix = Path(entry).suffix.lower()
    if suffix in _IMAGE_SUFFIXES:
        return 0
    if suffix in _VIDEO_SUFFIXES:
        return 1
    if suffix in _AUDIO_SUFFIXES:
        return 2
    return 3


@dataclass(slots=True)
class StepwiseExtractResult:
    """三阶段解压的结果。

    Attributes:
        first_stage_extracted:  第一阶段解压的文件（当前页，最高优先级）
        second_stage_extracted: 第二阶段解压的文件（前后 ±5 页，次优先级）
        third_stage_extracted:  第三阶段解压的文件（剩余所有文件，低优先级）
        output_dir:             解压输出目录
    """
    first_stage_extracted: list[str] = field(default_factory=list)
    second_stage_extracted: list[str] = field(default_factory=list)
    third_stage_extracted: list[str] = field(default_factory=list)
    output_dir: Path = field(default_factory=Path)


def stepwise_extract(
    archive_path: str | Path,
    output_dir: str | Path,
    *,
    current_page_entries: list[str] | None = None,
    secondary_entries: list[str] | None = None,
    prioritized_entries: list[str] | None = None,  # 向后兼容旧的两阶段 API
    prioritized_rule: Callable[[str], bool] | None = None,
    fail_after_prioritized: bool = False,
    fail_after_secondary: bool = False,
) -> StepwiseExtractResult:
    """三阶段渐进式解压，确保用户当前阅读的页面最快可用。

    阶段 1（最高优先级）：当前页 — 直接解压到 output_dir，立即可读。
    阶段 2（次优先级）：  前后 ±5 页 — 直接解压到 output_dir，翻页时快速可用。
    阶段 3（低优先级）：  剩余文件 — 解压到临时目录后合并，按图片>视频>音频>其他排序。

    设计要点：
    - 阶段 1 和 2 直接写入 output_dir，无需等待全部解压完成
    - 阶段 3 使用临时目录，失败时不影响已解压的阶段 1/2 文件
    - 第三阶段内部按文件类型排序，图片优先解压

    Args:
        archive_path:          压缩包路径
        output_dir:            解压输出目录
        current_page_entries:  第一阶段文件列表（当前页）
        secondary_entries:     第二阶段文件列表（前后 ±5 页）
        prioritized_entries:   已废弃 — 兼容旧的两阶段 API
        prioritized_rule:      可选的过滤规则函数
        fail_after_prioritized: 测试用 — 阶段 1 后模拟失败
        fail_after_secondary:   测试用 — 阶段 2 后模拟失败
    """
    archive = Path(archive_path)
    out_dir = Path(output_dir)
    all_entries = list_entries(archive)

    # ---- 向后兼容：旧的两阶段 API 把 prioritized_entries 当作阶段 1 ----
    if prioritized_entries and not current_page_entries and not secondary_entries:
        current_page_entries = prioritized_entries
        secondary_entries = []

    # ---- 构建阶段 1：当前页（最高优先级） ----
    current_set = set(current_page_entries or [])
    first_stage: list[str] = []
    for entry in all_entries:
        if entry in current_set or (prioritized_rule and prioritized_rule(entry)):
            first_stage.append(entry)
    # 去重但保持顺序
    first_stage = list(dict.fromkeys(first_stage))

    # ---- 构建阶段 2：前后 ±5 页（次优先级，排除阶段 1） ----
    secondary_set = set(secondary_entries or [])
    second_stage: list[str] = []
    for entry in all_entries:
        if entry in secondary_set and entry not in current_set:
            second_stage.append(entry)
    second_stage = list(dict.fromkeys(second_stage))

    # ---- 构建阶段 3：剩余文件，按图片>视频>音频>其他排序 ----
    extracted_set = set(first_stage) | set(second_stage)
    third_stage = [entry for entry in all_entries if entry not in extracted_set]
    third_stage.sort(key=_media_priority)

    # ---- 创建输出目录 ----
    out_dir.mkdir(parents=True, exist_ok=True)

    # ---- 阶段 1：解压当前页，直接写入 output_dir（立即可用） ----
    if first_stage:
        extract_entries(archive, out_dir, first_stage)

        if fail_after_prioritized:
            raise RuntimeError("模拟失败：阶段 1（当前页）完成后")

    # ---- 阶段 2：解压前后 ±5 页，直接写入 output_dir（快速可用） ----
    if second_stage:
        extract_entries(archive, out_dir, second_stage)

        if fail_after_secondary:
            raise RuntimeError("模拟失败：阶段 2（前后页）完成后")

    # ---- 阶段 3：解压剩余文件到临时目录，再合并到 output_dir ----
    if third_stage:
        work_dir = Path(tempfile.mkdtemp(prefix="stepwise-"))
        try:
            extract_entries(archive, work_dir, third_stage)

            # 将临时目录中的文件逐个移动到 output_dir（跳过系统垃圾文件）
            for file_path in work_dir.rglob("*"):
                if file_path.is_file() and not any(
                    should_ignore(part) for part in file_path.relative_to(work_dir).parts
                ):
                    relative_path = file_path.relative_to(work_dir)
                    dest_path = out_dir / relative_path
                    dest_path.parent.mkdir(parents=True, exist_ok=True)
                    shutil.move(str(file_path), str(dest_path))
        except Exception:
            # 出错时清理临时目录，但保留阶段 1/2 已解压的文件
            shutil.rmtree(work_dir, ignore_errors=True)
            raise
        finally:
            if work_dir.exists():
                shutil.rmtree(work_dir, ignore_errors=True)

    return StepwiseExtractResult(
        first_stage_extracted=first_stage,
        second_stage_extracted=second_stage,
        third_stage_extracted=third_stage,
        output_dir=out_dir,
    )
