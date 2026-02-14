"""压缩包验证模块测试。"""

from __future__ import annotations

import zipfile
from pathlib import Path

import pytest
from PIL import Image

from app.file_processing.archive_compressor.validator import compare_archive_structure


def test_compare_identical_archives(tmp_path: Path) -> None:
    """测试相同压缩包的比较结果。"""
    # 创建测试图片
    img_path = tmp_path / "test.jpg"
    img = Image.new("RGB", (100, 100), color="red")
    img.save(img_path, "JPEG")

    # 创建测试压缩包
    archive1 = tmp_path / "test1.zip"
    archive2 = tmp_path / "test2.zip"

    # 创建相同内容的两个压缩包
    for archive in [archive1, archive2]:
        with zipfile.ZipFile(archive, "w") as zf:
            zf.write(img_path, "folder/image.jpg")
            zf.writestr("readme.txt", b"hello world")

    # 比较
    result = compare_archive_structure(archive1, archive2)

    # 验证
    assert result.is_valid
    assert result.file_count_match
    assert result.structure_match
    assert result.non_image_files_match
    assert len(result.corrupted_images) == 0
    assert len(result.differences) == 0


def test_compare_missing_file(tmp_path: Path) -> None:
    """测试文件缺失的情况。"""
    archive1 = tmp_path / "original.zip"
    archive2 = tmp_path / "missing.zip"

    # 原始压缩包有 3 个文件
    with zipfile.ZipFile(archive1, "w") as zf:
        zf.writestr("file1.txt", b"content1")
        zf.writestr("file2.txt", b"content2")
        zf.writestr("file3.txt", b"content3")

    # 压缩后的压缩包缺少一个文件
    with zipfile.ZipFile(archive2, "w") as zf:
        zf.writestr("file1.txt", b"content1")
        zf.writestr("file2.txt", b"content2")

    # 比较
    result = compare_archive_structure(archive1, archive2)

    # 验证
    assert not result.is_valid
    assert not result.file_count_match
    assert not result.structure_match
    assert "file3.txt" in str(result.differences)
    assert "缺失文件" in str(result.differences)


def test_compare_different_content(tmp_path: Path) -> None:
    """测试非图片文件内容不同的情况。"""
    archive1 = tmp_path / "original.zip"
    archive2 = tmp_path / "modified.zip"

    # 原始压缩包
    with zipfile.ZipFile(archive1, "w") as zf:
        zf.writestr("data.txt", b"original content")
        zf.writestr("config.json", b'{"key": "value1"}')

    # 修改后的压缩包（内容不同）
    with zipfile.ZipFile(archive2, "w") as zf:
        zf.writestr("data.txt", b"modified content")
        zf.writestr("config.json", b'{"key": "value2"}')

    # 比较
    result = compare_archive_structure(archive1, archive2)

    # 验证
    assert not result.is_valid
    assert not result.non_image_files_match
    assert "data.txt" in str(result.differences)
    assert "config.json" in str(result.differences)
    assert "非图片文件内容不同" in str(result.differences)


def test_compare_corrupted_image(tmp_path: Path) -> None:
    """测试损坏图片的检测。"""
    archive1 = tmp_path / "original.zip"
    archive2 = tmp_path / "corrupted.zip"

    # 创建一个真实的图片
    img_path = tmp_path / "test.jpg"
    img = Image.new("RGB", (100, 100), color="red")
    img.save(img_path, "JPEG")

    # 原始压缩包（正常图片）
    with zipfile.ZipFile(archive1, "w") as zf:
        zf.write(img_path, "image.jpg")
        zf.writestr("readme.txt", b"test")

    # 压缩后的压缩包（损坏的图片）
    with zipfile.ZipFile(archive2, "w") as zf:
        zf.writestr("image.jpg", b"corrupted image data")
        zf.writestr("readme.txt", b"test")

    # 比较
    result = compare_archive_structure(archive1, archive2)

    # 验证
    assert not result.is_valid
    assert "image.jpg" in result.corrupted_images
    assert "图片损坏" in str(result.differences)


def test_compare_different_structure(tmp_path: Path) -> None:
    """测试目录结构不同的情况。"""
    archive1 = tmp_path / "original.zip"
    archive2 = tmp_path / "different.zip"

    # 原始压缩包
    with zipfile.ZipFile(archive1, "w") as zf:
        zf.writestr("folder1/file.txt", b"content")
        zf.writestr("folder2/file.txt", b"content")

    # 不同结构的压缩包
    with zipfile.ZipFile(archive2, "w") as zf:
        zf.writestr("folder1/file.txt", b"content")
        zf.writestr("folder3/file.txt", b"content")  # 不同的文件夹

    # 比较
    result = compare_archive_structure(archive1, archive2)

    # 验证
    assert not result.is_valid
    assert not result.structure_match
    assert "folder2/file.txt" in str(result.differences)
    assert "folder3/file.txt" in str(result.differences)


def test_compare_with_real_images(tmp_path: Path) -> None:
    """测试包含真实图片的压缩包比较。"""
    archive1 = tmp_path / "original.zip"
    archive2 = tmp_path / "compressed.zip"

    # 创建测试图片
    img1_path = tmp_path / "large.jpg"
    img2_path = tmp_path / "small.jpg"

    # 大图片
    large_img = Image.new("RGB", (2000, 2000), color="blue")
    large_img.save(img1_path, "JPEG", quality=95)

    # 小图片
    small_img = Image.new("RGB", (500, 500), color="green")
    small_img.save(img2_path, "JPEG", quality=85)

    # 原始压缩包
    with zipfile.ZipFile(archive1, "w") as zf:
        zf.write(img1_path, "images/large.jpg")
        zf.write(img2_path, "images/small.jpg")
        zf.writestr("readme.txt", b"test images")

    # 模拟压缩后的压缩包（图片被压缩，但仍然有效）
    compressed_img_path = tmp_path / "compressed.jpg"
    compressed_img = Image.new("RGB", (1000, 1000), color="blue")
    compressed_img.save(compressed_img_path, "JPEG", quality=70)

    with zipfile.ZipFile(archive2, "w") as zf:
        zf.write(compressed_img_path, "images/large.jpg")  # 压缩后的大图
        zf.write(img2_path, "images/small.jpg")  # 小图保持不变
        zf.writestr("readme.txt", b"test images")  # 非图片文件保持不变

    # 比较
    result = compare_archive_structure(archive1, archive2)

    # 验证：图片可以被压缩（内容不同），但必须可以正常打开
    assert result.is_valid
    assert result.file_count_match
    assert result.structure_match
    assert result.non_image_files_match  # 非图片文件内容相同
    assert len(result.corrupted_images) == 0  # 图片未损坏
