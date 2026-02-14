"""压缩包图片压缩服务。

提供压缩包内大图片压缩和再打包的核心功能。
"""

from __future__ import annotations

import logging
import shutil
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps

from app.constants import IMAGE_SUFFIXES
from app.core.config import settings
from app.file_processing._archive_backend import extract_all, list_entries
from app.file_processing.archive_compressor.validator import compare_archive_structure

logger = logging.getLogger(__name__)


@dataclass
class CompressResult:
    """压缩结果。

    Attributes:
        success: 是否成功
        original_path: 原始压缩包路径
        output_path: 输出压缩包路径
        original_size: 原始大小（字节）
        compressed_size: 压缩后大小（字节）
        compression_ratio: 压缩比例
        processed_images: 处理的图片数量
        skipped_images: 跳过的图片数量
        validation_passed: 验证是否通过
        error_message: 错误信息（如果失败）
    """

    success: bool
    original_path: str
    output_path: str
    original_size: int = 0
    compressed_size: int = 0
    compression_ratio: float = 0.0
    processed_images: int = 0
    skipped_images: int = 0
    validation_passed: bool = False
    error_message: str = ""


def _is_image_file(filename: str) -> bool:
    """判断文件是否为图片。"""
    return Path(filename).suffix.lower() in IMAGE_SUFFIXES


def _should_compress_image(file_path: Path, min_size: int) -> bool:
    """判断图片是否需要压缩。

    Args:
        file_path: 图片文件路径
        min_size: 最小文件大小阈值（字节）

    Returns:
        是否需要压缩
    """
    try:
        # 检查文件大小
        if file_path.stat().st_size < min_size:
            return False

        # 检查图片分辨率
        with Image.open(file_path) as img:
            width, height = img.size
            max_width = settings.IMAGE_COMPRESS_MAX_WIDTH
            max_height = settings.IMAGE_COMPRESS_MAX_HEIGHT

            if width > max_width or height > max_height:
                return True

        return False
    except Exception as e:
        logger.warning(f"检查图片失败: {file_path}, 错误: {e}")
        return False


def _compress_image(
    input_path: Path,
    output_path: Path,
    max_width: int,
    max_height: int,
    quality: int,
) -> None:
    """压缩单个图片。

    Args:
        input_path: 输入图片路径
        output_path: 输出图片路径
        max_width: 最大宽度
        max_height: 最大高度
        quality: JPEG 质量（1-100）
    """
    with Image.open(input_path) as img:
        # 处理 EXIF 旋转
        img = ImageOps.exif_transpose(img)

        # 转换为 RGB（JPEG 不支持透明度）
        if img.mode in ("RGBA", "LA", "P"):
            rgb_img = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            if img.mode in ("RGBA", "LA"):
                rgb_img.paste(img, mask=img.split()[-1])
            else:
                rgb_img.paste(img)
            img = rgb_img
        elif img.mode != "RGB":
            img = img.convert("RGB")

        # 缩放（保持宽高比）
        if img.width > max_width or img.height > max_height:
            img.thumbnail((max_width, max_height), Image.Resampling.BILINEAR)

        # 保存为 JPEG
        output_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(output_path, "JPEG", quality=quality, optimize=True)


def compress_archive_images(
    archive_path: Path | str,
    output_path: Path | str | None = None,
    max_width: int | None = None,
    max_height: int | None = None,
    quality: int | None = None,
    min_size: int | None = None,
) -> CompressResult:
    """压缩压缩包内的大图片并重新打包。

    工作流程：
    1. 解压原始压缩包到临时目录
    2. 遍历所有图片文件，判断是否需要压缩
    3. 压缩需要处理的图片（转换为 JPEG）
    4. 重新打包成 zip
    5. 验证压缩包完整性
    6. 如果验证失败，输出文件名添加 .error 后缀

    Args:
        archive_path: 原始压缩包路径
        output_path: 输出路径，None 表示输出到原文件夹（原文件名_compressed.zip）
        max_width: 最大宽度（覆盖配置）
        max_height: 最大高度（覆盖配置）
        quality: JPEG 质量（覆盖配置）
        min_size: 最小文件大小阈值（覆盖配置）

    Returns:
        CompressResult: 压缩结果
    """
    archive = Path(archive_path)
    original_size = archive.stat().st_size

    # 使用配置或参数
    max_w = max_width or settings.IMAGE_COMPRESS_MAX_WIDTH
    max_h = max_height or settings.IMAGE_COMPRESS_MAX_HEIGHT
    qual = quality or settings.IMAGE_COMPRESS_QUALITY
    min_sz = min_size or settings.IMAGE_COMPRESS_MIN_SIZE

    # 确定输出路径
    if output_path:
        output = Path(output_path)
    else:
        output = archive.parent / f"{archive.stem}_compressed.zip"

    # TODO: 进度反馈 - 可在此处添加进度回调
    # progress_callback(stage="start", message="开始压缩")

    try:
        # 1. 解压到临时目录
        with tempfile.TemporaryDirectory(prefix="compress-") as tmp_dir:
            work_dir = Path(tmp_dir)
            extract_all(archive, work_dir)

            logger.info(f"解压完成: {archive} -> {work_dir}")

            # 2. 遍历所有文件，处理图片
            processed_count = 0
            skipped_count = 0

            all_files = list(work_dir.rglob("*"))
            total_files = len([f for f in all_files if f.is_file()])

            # TODO: 进度反馈 - 可在此处添加进度回调
            # progress_callback(stage="processing", total=total_files, current=0)

            for i, file_path in enumerate(all_files):
                if not file_path.is_file():
                    continue

                # 只处理图片文件
                if not _is_image_file(file_path.name):
                    continue

                # 判断是否需要压缩
                if _should_compress_image(file_path, min_sz):
                    try:
                        # 压缩图片，替换原文件
                        # 注意：强制转换为 JPEG，所以扩展名改为 .jpg
                        relative_path = file_path.relative_to(work_dir)
                        new_name = relative_path.stem + ".jpg"
                        new_path = file_path.parent / new_name

                        _compress_image(file_path, new_path, max_w, max_h, qual)

                        # 如果扩展名改变了，删除原文件
                        if new_path != file_path:
                            file_path.unlink()

                        processed_count += 1
                        logger.debug(f"压缩图片: {relative_path} -> {new_name}")

                        # TODO: 进度反馈 - 可在此处添加进度回调
                        # progress_callback(stage="processing", total=total_files, current=i+1, message=f"压缩中: {new_name}")

                    except Exception as e:
                        logger.warning(f"压缩图片失败: {file_path}, 错误: {e}")
                        skipped_count += 1
                else:
                    skipped_count += 1

            # 3. 重新打包成 zip
            logger.info(f"开始打包: {work_dir} -> {output}")

            # TODO: 进度反馈 - 可在此处添加进度回调
            # progress_callback(stage="packing", message="重新打包中")

            output.parent.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                for file_path in work_dir.rglob("*"):
                    if file_path.is_file():
                        arcname = file_path.relative_to(work_dir)
                        zf.write(file_path, arcname)

            compressed_size = output.stat().st_size
            compression_ratio = (
                (1 - compressed_size / original_size) * 100 if original_size > 0 else 0.0
            )

            logger.info(
                f"打包完成: {output}, 原始={original_size}, 压缩后={compressed_size}, 压缩率={compression_ratio:.2f}%"
            )

            # 4. 验证压缩包完整性
            # TODO: 进度反馈 - 可在此处添加进度回调
            # progress_callback(stage="validating", message="验证压缩包完整性")

            validation_result = compare_archive_structure(archive, output)

            if not validation_result.is_valid:
                # 验证失败，添加 .error 后缀
                error_output = output.parent / f"{output.name}.error"
                output.rename(error_output)
                logger.error(
                    f"验证失败，输出文件重命名为: {error_output}, 差异: {validation_result.differences}"
                )

                return CompressResult(
                    success=False,
                    original_path=str(archive),
                    output_path=str(error_output),
                    original_size=original_size,
                    compressed_size=compressed_size,
                    compression_ratio=compression_ratio,
                    processed_images=processed_count,
                    skipped_images=skipped_count,
                    validation_passed=False,
                    error_message=f"验证失败: {', '.join(validation_result.differences[:3])}",
                )

            # 5. 成功
            return CompressResult(
                success=True,
                original_path=str(archive),
                output_path=str(output),
                original_size=original_size,
                compressed_size=compressed_size,
                compression_ratio=compression_ratio,
                processed_images=processed_count,
                skipped_images=skipped_count,
                validation_passed=True,
            )

    except Exception as e:
        logger.error(f"压缩失败: {archive}, 错误: {e}")
        return CompressResult(
            success=False,
            original_path=str(archive),
            output_path=str(output) if output else "",
            error_message=str(e),
        )
