"""压缩包图片压缩服务。

提供压缩包内大图片压缩和再打包的核心功能。
"""

from __future__ import annotations

from pathlib import Path


def compress_archive_images(
    archive_path: Path,
    output_path: Path | None = None,
) -> dict:
    """压缩压缩包内的大图片并重新打包。

    TODO: 实现压缩逻辑

    Args:
        archive_path: 原始压缩包路径
        output_path: 输出路径，None 表示原地替换

    Returns:
        压缩结果字典
    """
    raise NotImplementedError("待实现")
