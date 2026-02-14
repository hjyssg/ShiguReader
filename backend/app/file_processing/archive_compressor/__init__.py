"""压缩包图片压缩模块。

提供压缩包内大图片压缩和再打包功能。
"""

from .service import compress_archive_images
from .validator import ArchiveComparisonResult, compare_archive_structure

__all__ = [
    "compress_archive_images",
    "compare_archive_structure",
    "ArchiveComparisonResult",
]
