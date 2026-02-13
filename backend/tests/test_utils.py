"""Tests for app/utils.py utility functions."""

from pathlib import Path

import pytest

from app.utils import detect_file_type, generate_password_reset_token, get_mime_type


class TestDetectFileType:
    """Test detect_file_type function."""

    def test_detect_image_types(self) -> None:
        """Test image file type detection."""
        assert detect_file_type("test.jpg") == "image"
        assert detect_file_type("test.jpeg") == "image"
        assert detect_file_type("test.png") == "image"
        assert detect_file_type("test.webp") == "image"
        assert detect_file_type("test.gif") == "image"
        assert detect_file_type("test.bmp") == "image"
        assert detect_file_type("test.heic") == "image"

    def test_detect_video_types(self) -> None:
        """Test video file type detection."""
        assert detect_file_type("test.mp4") == "video"
        assert detect_file_type("test.mkv") == "video"
        assert detect_file_type("test.avi") == "video"
        assert detect_file_type("test.mov") == "video"
        assert detect_file_type("test.webm") == "video"
        assert detect_file_type("test.flv") == "video"
        assert detect_file_type("test.wmv") == "video"

    def test_detect_archive_types(self) -> None:
        """Test archive file type detection."""
        assert detect_file_type("test.zip") == "archive"
        assert detect_file_type("test.cbz") == "archive"
        assert detect_file_type("test.rar") == "archive"
        assert detect_file_type("test.cbr") == "archive"
        assert detect_file_type("test.7z") == "archive"
        # Note: .tar.gz and .tgz are not in ARCHIVE_SUFFIXES, only .tar is
        assert detect_file_type("test.tar") == "archive"

    def test_detect_audio_types(self) -> None:
        """Test audio file type detection."""
        assert detect_file_type("test.mp3") == "audio"
        assert detect_file_type("test.flac") == "audio"
        assert detect_file_type("test.wav") == "audio"
        assert detect_file_type("test.aac") == "audio"
        assert detect_file_type("test.ogg") == "audio"
        assert detect_file_type("test.m4a") == "audio"

    def test_detect_unknown_type(self) -> None:
        """Test unknown file type detection."""
        assert detect_file_type("test.txt") == "unknown"
        assert detect_file_type("test.pdf") == "unknown"
        assert detect_file_type("test.doc") == "unknown"
        assert detect_file_type("test") == "unknown"

    def test_case_insensitive(self) -> None:
        """Test that detection is case-insensitive."""
        assert detect_file_type("test.JPG") == "image"
        assert detect_file_type("test.MP4") == "video"
        assert detect_file_type("test.ZIP") == "archive"
        assert detect_file_type("test.MP3") == "audio"

    def test_with_path_object(self) -> None:
        """Test detection with Path objects."""
        assert detect_file_type(Path("test.jpg")) == "image"
        assert detect_file_type(Path("/path/to/test.mp4")) == "video"


class TestGetMimeType:
    """Test get_mime_type function."""

    def test_image_mime_types(self) -> None:
        """Test image MIME types."""
        assert get_mime_type("test.jpg") == "image/jpeg"
        assert get_mime_type("test.jpeg") == "image/jpeg"
        assert get_mime_type("test.png") == "image/png"
        assert get_mime_type("test.webp") == "image/webp"
        assert get_mime_type("test.gif") == "image/gif"
        assert get_mime_type("test.bmp") == "image/bmp"
        assert get_mime_type("test.heic") == "image/heic"

    def test_video_mime_types(self) -> None:
        """Test video MIME types."""
        assert get_mime_type("test.mp4") == "video/mp4"
        assert get_mime_type("test.webm") == "video/webm"
        assert get_mime_type("test.mkv") == "video/x-matroska"
        assert get_mime_type("test.avi") == "video/x-msvideo"
        assert get_mime_type("test.mov") == "video/quicktime"
        assert get_mime_type("test.flv") == "video/x-flv"
        assert get_mime_type("test.wmv") == "video/x-ms-wmv"

    def test_audio_mime_types(self) -> None:
        """Test audio MIME types."""
        assert get_mime_type("test.mp3") == "audio/mpeg"
        assert get_mime_type("test.flac") == "audio/flac"
        assert get_mime_type("test.wav") == "audio/wav"
        assert get_mime_type("test.aac") == "audio/aac"
        assert get_mime_type("test.ogg") == "audio/ogg"
        assert get_mime_type("test.m4a") == "audio/mp4"

    def test_unknown_mime_type(self) -> None:
        """Test unknown MIME type returns default."""
        assert get_mime_type("test.txt") == "application/octet-stream"
        assert get_mime_type("test.unknown") == "application/octet-stream"
        assert get_mime_type("test") == "application/octet-stream"

    def test_case_insensitive(self) -> None:
        """Test that MIME type detection is case-insensitive."""
        assert get_mime_type("test.JPG") == "image/jpeg"
        assert get_mime_type("test.MP4") == "video/mp4"

    def test_with_path_object(self) -> None:
        """Test MIME type detection with Path objects."""
        assert get_mime_type(Path("test.jpg")) == "image/jpeg"
        assert get_mime_type(Path("/path/to/test.mp4")) == "video/mp4"


class TestGeneratePasswordResetToken:
    """Test generate_password_reset_token function."""

    def test_generates_token(self) -> None:
        """Test that a token is generated."""
        token = generate_password_reset_token("test@example.com")
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0

    def test_generates_different_tokens(self) -> None:
        """Test that different tokens are generated each time."""
        email = "test@example.com"
        token1 = generate_password_reset_token(email)
        token2 = generate_password_reset_token(email)
        assert token1 != token2

    def test_token_is_url_safe(self) -> None:
        """Test that generated token is URL-safe."""
        token = generate_password_reset_token("test@example.com")
        # URL-safe tokens should only contain alphanumeric, -, and _
        assert all(c.isalnum() or c in "-_" for c in token)
