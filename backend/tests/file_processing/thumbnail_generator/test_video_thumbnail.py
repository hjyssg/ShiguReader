from __future__ import annotations

import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from app.file_processing.thumbnail_generator import (
    generate_svg_placeholder,
    generate_video_thumbnail,
)


def test_generate_video_thumbnail_success(tmp_path: Path) -> None:
    """Test successful video thumbnail generation."""
    video_file = tmp_path / "test.mp4"
    video_file.write_text("fake video")
    output_file = tmp_path / "thumb.webp"

    mock_result = MagicMock()
    mock_result.stderr = ""

    with patch("subprocess.run", return_value=mock_result) as mock_run:
        # Simulate successful ffmpeg execution by creating output file
        def side_effect(*args, **kwargs):
            output_file.write_bytes(b"fake thumbnail")
            return mock_result

        mock_run.side_effect = side_effect

        generate_video_thumbnail(video_file, output_file, timeout=10)

        assert output_file.exists()
        assert output_file.stat().st_size > 0
        assert mock_run.called


def test_generate_video_thumbnail_ffmpeg_not_found(tmp_path: Path) -> None:
    """Test video thumbnail generation when ffmpeg is not found."""
    video_file = tmp_path / "test.mp4"
    video_file.write_text("fake video")
    output_file = tmp_path / "thumb.webp"

    with patch("subprocess.run", side_effect=FileNotFoundError("ffmpeg not found")):
        with pytest.raises(FileNotFoundError, match="ffmpeg not found"):
            generate_video_thumbnail(video_file, output_file, timeout=10)


def test_generate_video_thumbnail_timeout(tmp_path: Path) -> None:
    """Test video thumbnail generation timeout."""
    video_file = tmp_path / "test.mp4"
    video_file.write_text("fake video")
    output_file = tmp_path / "thumb.webp"

    with patch("subprocess.run", side_effect=subprocess.TimeoutExpired("ffmpeg", 10)):
        with pytest.raises(subprocess.TimeoutExpired):
            generate_video_thumbnail(video_file, output_file, timeout=10)


def test_generate_video_thumbnail_all_strategies_fail(tmp_path: Path) -> None:
    """Test video thumbnail generation when all ffmpeg strategies fail."""
    video_file = tmp_path / "test.mp4"
    video_file.write_text("fake video")
    output_file = tmp_path / "thumb.webp"

    mock_result = MagicMock()
    mock_result.stderr = "ffmpeg error: invalid codec"

    with patch("subprocess.run", return_value=mock_result):
        with pytest.raises(RuntimeError, match="All ffmpeg strategies failed"):
            generate_video_thumbnail(video_file, output_file, timeout=10)


def test_generate_svg_placeholder(tmp_path: Path) -> None:
    """Test SVG placeholder generation."""
    output_file = tmp_path / "subdir" / "placeholder.webp"

    generate_svg_placeholder(output_file)

    assert output_file.exists()
    content = output_file.read_text(encoding="utf-8")
    assert content.startswith("<svg")
    assert "Video" in content
    assert "polygon" in content  # Play button
    assert output_file.parent.exists()


def test_generate_svg_placeholder_creates_parent_dirs(tmp_path: Path) -> None:
    """Test that SVG placeholder generation creates parent directories."""
    output_file = tmp_path / "a" / "b" / "c" / "placeholder.webp"

    generate_svg_placeholder(output_file)

    assert output_file.exists()
    assert output_file.parent.exists()
