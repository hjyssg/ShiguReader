"""Centralized constants for file types and MIME types."""

from __future__ import annotations

# File type suffixes
IMAGE_SUFFIXES = (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".heic")
VIDEO_SUFFIXES = (".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv")
ARCHIVE_SUFFIXES = (".zip", ".cbz", ".rar", ".cbr", ".7z", ".tar", ".tar.gz", ".tgz")
AUDIO_SUFFIXES = (".mp3", ".flac", ".wav", ".aac", ".ogg", ".m4a")

# MIME type mapping
MIME_TYPE_MAP: dict[str, str] = {
    # Images
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".heic": "image/heic",
    # Videos
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
    ".mov": "video/quicktime",
    ".flv": "video/x-flv",
    ".wmv": "video/x-ms-wmv",
    # Audio
    ".mp3": "audio/mpeg",
    ".flac": "audio/flac",
    ".wav": "audio/wav",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
}
