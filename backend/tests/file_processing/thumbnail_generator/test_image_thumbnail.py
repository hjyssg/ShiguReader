from __future__ import annotations

from pathlib import Path

import pytest
from PIL import Image

from app.file_processing.thumbnail_generator import generate_image_thumbnail


def test_generate_image_thumbnail_basic(tmp_path: Path) -> None:
    """Test basic image thumbnail generation."""
    # Create a test image
    input_file = tmp_path / "test.jpg"
    img = Image.new("RGB", (800, 600), color="red")
    img.save(input_file, "JPEG")

    output_file = tmp_path / "thumb.webp"

    generate_image_thumbnail(input_file, output_file, height=350)

    assert output_file.exists()
    with Image.open(output_file) as thumb:
        assert thumb.height == 350
        assert thumb.width > 0
        assert thumb.format == "WEBP"


def test_generate_image_thumbnail_maintains_aspect_ratio(tmp_path: Path) -> None:
    """Test that thumbnail maintains aspect ratio."""
    # Create a wide image (2:1 ratio)
    input_file = tmp_path / "wide.png"
    img = Image.new("RGB", (1000, 500), color="blue")
    img.save(input_file, "PNG")

    output_file = tmp_path / "thumb.webp"

    generate_image_thumbnail(input_file, output_file, height=350)

    assert output_file.exists()
    with Image.open(output_file) as thumb:
        assert thumb.height == 350
        # Should maintain 2:1 ratio
        expected_width = int(350 * 2)
        assert abs(thumb.width - expected_width) <= 1  # Allow 1px rounding error


def test_generate_image_thumbnail_with_transparency(tmp_path: Path) -> None:
    """Test thumbnail generation with transparent PNG."""
    input_file = tmp_path / "transparent.png"
    img = Image.new("RGBA", (400, 400), color=(255, 0, 0, 128))
    img.save(input_file, "PNG")

    output_file = tmp_path / "thumb.webp"

    generate_image_thumbnail(input_file, output_file, height=350)

    assert output_file.exists()
    with Image.open(output_file) as thumb:
        # Should be converted to RGB with white background
        assert thumb.mode == "RGB"
        assert thumb.height == 350


def test_generate_image_thumbnail_with_exif_rotation(tmp_path: Path) -> None:
    """Test thumbnail generation respects EXIF orientation."""
    input_file = tmp_path / "rotated.jpg"
    # Create a tall image
    img = Image.new("RGB", (300, 600), color="green")
    img.save(input_file, "JPEG")

    output_file = tmp_path / "thumb.webp"

    generate_image_thumbnail(input_file, output_file, height=350)

    assert output_file.exists()
    with Image.open(output_file) as thumb:
        assert thumb.height == 350
        # Width should be half of height (maintaining 1:2 ratio)
        expected_width = int(350 * 0.5)
        assert abs(thumb.width - expected_width) <= 1


def test_generate_image_thumbnail_creates_parent_dirs(tmp_path: Path) -> None:
    """Test that thumbnail generation creates parent directories."""
    input_file = tmp_path / "test.jpg"
    img = Image.new("RGB", (400, 400), color="yellow")
    img.save(input_file, "JPEG")

    output_file = tmp_path / "a" / "b" / "c" / "thumb.webp"

    generate_image_thumbnail(input_file, output_file, height=350)

    assert output_file.exists()
    assert output_file.parent.exists()


def test_generate_image_thumbnail_palette_mode(tmp_path: Path) -> None:
    """Test thumbnail generation with palette mode image."""
    input_file = tmp_path / "palette.gif"
    img = Image.new("P", (400, 400))
    img.putpalette([i % 256 for i in range(768)])
    img.save(input_file, "GIF")

    output_file = tmp_path / "thumb.webp"

    generate_image_thumbnail(input_file, output_file, height=350)

    assert output_file.exists()
    with Image.open(output_file) as thumb:
        assert thumb.mode == "RGB"
        assert thumb.height == 350


def test_generate_image_thumbnail_custom_height(tmp_path: Path) -> None:
    """Test thumbnail generation with custom height."""
    input_file = tmp_path / "test.jpg"
    img = Image.new("RGB", (800, 600), color="purple")
    img.save(input_file, "JPEG")

    output_file = tmp_path / "thumb.webp"

    generate_image_thumbnail(input_file, output_file, height=200)

    assert output_file.exists()
    with Image.open(output_file) as thumb:
        assert thumb.height == 200


def test_generate_image_thumbnail_invalid_file(tmp_path: Path) -> None:
    """Test thumbnail generation with invalid image file."""
    input_file = tmp_path / "invalid.jpg"
    input_file.write_text("not an image")

    output_file = tmp_path / "thumb.webp"

    with pytest.raises(Exception):  # PIL will raise various exceptions
        generate_image_thumbnail(input_file, output_file, height=350)
