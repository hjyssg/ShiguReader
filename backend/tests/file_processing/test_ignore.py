"""Tests for the unified ignore filter."""

from __future__ import annotations

import pytest

from app.file_processing.ignore import should_ignore, should_ignore_archive_entry


# ---------------------------------------------------------------------------
# should_ignore — single name
# ---------------------------------------------------------------------------

class TestShouldIgnore:
    """Test should_ignore with single path component names."""

    @pytest.mark.parametrize(
        "name",
        [
            "desktop.ini",
            "Desktop.ini",
            "DESKTOP.INI",
            "Thumbs.db",
            "THUMBS.DB",
            "$RECYCLE.BIN",
            "$Recycle.Bin",
            "System Volume Information",
            "pagefile.sys",
            "hiberfil.sys",
            "DumpStack.log",
            ".git",
            ".Git",
            ".DS_Store",
            ".ds_store",
            "__MACOSX",
            "__macosx",
            ".Spotlight-V100",
            ".Trashes",
            ".fseventsd",
            "node_modules",
            "NODE_MODULES",
            "__pycache__",
            ".venv",
            ".idea",
            ".vscode",
        ],
    )
    def test_ignored_names(self, name: str) -> None:
        assert should_ignore(name) is True

    @pytest.mark.parametrize(
        "name",
        [
            "image.jpg",
            "readme.md",
            ".env",
            ".bashrc",
            ".profile",
            ".gitignore",
            ".dockerignore",
            "my_folder",
            "data",
            "src",
            "package.json",
        ],
    )
    def test_normal_names_not_ignored(self, name: str) -> None:
        """Normal files and dot-files NOT in the list must pass through."""
        assert should_ignore(name) is False

    def test_dot_files_not_blanket_ignored(self) -> None:
        """Ensure we don't use a blanket 'starts with .' rule."""
        assert should_ignore(".env") is False
        assert should_ignore(".bashrc") is False
        assert should_ignore(".gitignore") is False
        assert should_ignore(".npmrc") is False


# ---------------------------------------------------------------------------
# should_ignore_archive_entry — multi-component paths
# ---------------------------------------------------------------------------

class TestShouldIgnoreArchiveEntry:
    """Test should_ignore_archive_entry with archive-style paths."""

    @pytest.mark.parametrize(
        "entry",
        [
            "__MACOSX/folder/image.png",
            "folder/__MACOSX/image.png",
            ".DS_Store",
            "subdir/.DS_Store",
            "Thumbs.db",
            ".git/config",
            "some/deep/__pycache__/module.pyc",
        ],
    )
    def test_ignored_archive_entries(self, entry: str) -> None:
        assert should_ignore_archive_entry(entry) is True

    @pytest.mark.parametrize(
        "entry",
        [
            "folder/image.jpg",
            "chapter01/page001.png",
            "music/track.mp3",
            ".env",
            "src/.gitignore",
        ],
    )
    def test_normal_archive_entries(self, entry: str) -> None:
        assert should_ignore_archive_entry(entry) is False
