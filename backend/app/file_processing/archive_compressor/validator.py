"""压缩包验证模块。

用于比较原始压缩包和压缩后的压缩包，确保内容完整性。
"""

from __future__ import annotations

import tempfile
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image

from app.constants import IMAGE_SUFFIXES
from app.file_processing._archive_backend import extract_all, list_entries


@dataclass
class ArchiveComparisonResult:
    """压缩包比较结果。

    Attributes:
        is_valid: 验证是否通过
        file_count_match: 文件数量是否一致
        structure_match: 目录结构是否一致
        non_image_files_match: 非图片文件内容是否一致
        corrupted_images: 损坏的图片文件列表
        differences: 差异详情列表
    """

    is_valid: bool
    file_count_match: bool = True
    structure_match: bool = True
    non_image_files_match: bool = True
    corrupted_images: list[str] = field(default_factory=list)
    differences: list[str] = field(default_factory=list)


def _is_image_file(filename: str) -> bool:
    """判断文件是否为图片。"""
    return Path(filename).suffix.lower() in IMAGE_SUFFIXES


def compare_archive_structure(
    original_archive: Path,
    compressed_archive: Path,
) -> ArchiveComparisonResult:
    """比较两个压缩包的结构和内容。

    验证项：
    1. 文件数量是否一致
    2. 目录结构（文件名列表）是否一致
    3. 非图片文件内容是否完全相同（字节级比较）
    4. 图片文件是否可正常打开（验证未损坏）

    Args:
        original_archive: 原始压缩包路径
        compressed_archive: 压缩后的压缩包路径

    Returns:
        ArchiveComparisonResult: 比较结果
    """
    result = ArchiveComparisonResult(is_valid=True)

    try:
        # 1. 列出所有文件
        original_entries = sorted(list_entries(original_archive))
        compressed_entries = sorted(list_entries(compressed_archive))

        # 2. 比较文件数量
        if len(original_entries) != len(compressed_entries):
            result.is_valid = False
            result.file_count_match = False
            result.differences.append(
                f"文件数量不一致: 原始={len(original_entries)}, 压缩后={len(compressed_entries)}"
            )

        # 3. 比较文件名列表（目录结构）
        original_set = set(original_entries)
        compressed_set = set(compressed_entries)

        if original_set != compressed_set:
            result.is_valid = False
            result.structure_match = False

            missing = original_set - compressed_set
            extra = compressed_set - original_set

            if missing:
                result.differences.append(f"缺失文件: {', '.join(sorted(missing))}")
            if extra:
                result.differences.append(f"多余文件: {', '.join(sorted(extra))}")

            # 如果结构不一致，无需继续比较内容
            return result

        # 4. 解压到临时目录进行内容比较
        with tempfile.TemporaryDirectory(prefix="validator-orig-") as tmp1, tempfile.TemporaryDirectory(
            prefix="validator-comp-"
        ) as tmp2:
            extract_all(original_archive, Path(tmp1))
            extract_all(compressed_archive, Path(tmp2))

            # 5. 逐文件比较
            for entry in original_entries:
                file1 = Path(tmp1) / entry
                file2 = Path(tmp2) / entry

                # 确保文件存在
                if not file1.exists() or not file2.exists():
                    result.is_valid = False
                    result.differences.append(f"文件不存在: {entry}")
                    continue

                # 非图片文件：字节级比较
                if not _is_image_file(entry):
                    try:
                        content1 = file1.read_bytes()
                        content2 = file2.read_bytes()

                        if content1 != content2:
                            result.is_valid = False
                            result.non_image_files_match = False
                            result.differences.append(
                                f"非图片文件内容不同: {entry} "
                                f"(原始={len(content1)}字节, 压缩后={len(content2)}字节)"
                            )
                    except Exception as e:
                        result.is_valid = False
                        result.differences.append(f"读取文件失败: {entry}, 错误: {e}")

                # 图片文件：验证可打开（未损坏）
                else:
                    try:
                        with Image.open(file2) as img:
                            img.verify()
                        # 重新打开以确保完整性（verify 后图片对象不可用）
                        with Image.open(file2) as img:
                            img.load()
                    except Exception as e:
                        result.is_valid = False
                        result.corrupted_images.append(entry)
                        result.differences.append(f"图片损坏: {entry}, 错误: {e}")

    except Exception as e:
        result.is_valid = False
        result.differences.append(f"验证过程出错: {e}")

    return result
