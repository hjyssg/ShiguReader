"""Centralized utility functions."""

from __future__ import annotations

import secrets
from pathlib import Path
from typing import Literal

from app.constants import (
    ARCHIVE_SUFFIXES,
    AUDIO_SUFFIXES,
    IMAGE_SUFFIXES,
    MIME_TYPE_MAP,
    VIDEO_SUFFIXES,
)


def detect_file_type(filepath: Path | str) -> Literal["image", "video", "archive", "audio", "unknown"]:
    """Detect file type based on extension.
    
    Args:
        filepath: Path to file or filename
        
    Returns:
        File type category
    """
    suffix = Path(filepath).suffix.lower()
    
    if suffix in IMAGE_SUFFIXES:
        return "image"
    if suffix in VIDEO_SUFFIXES:
        return "video"
    if suffix in ARCHIVE_SUFFIXES:
        return "archive"
    if suffix in AUDIO_SUFFIXES:
        return "audio"
    
    return "unknown"


def get_mime_type(filepath: Path | str) -> str:
    """Get MIME type for a file based on extension.
    
    Args:
        filepath: Path to file or filename
        
    Returns:
        MIME type string, defaults to "application/octet-stream" if unknown
    """
    suffix = Path(filepath).suffix.lower()
    return MIME_TYPE_MAP.get(suffix, "application/octet-stream")


def generate_password_reset_token(email: str) -> str:
    """Generate a password reset token for the given email.
    
    Args:
        email: User email address
        
    Returns:
        A secure random token string
    """
    # Generate a secure random token
    # In production, this should be a JWT or similar with expiration
    return secrets.token_urlsafe(32)
