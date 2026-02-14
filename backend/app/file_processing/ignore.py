"""Unified filter for system junk files and hidden directories.

All filesystem-traversal logic MUST call ``should_ignore`` instead of
duplicating ignore rules.  The check is **case-insensitive** and works
on Windows / macOS / Linux.

To extend the list, simply add entries to ``_IGNORED_NAMES``.
"""

from __future__ import annotations

from pathlib import PurePosixPath

# ---- names to ignore (stored lower-cased) --------------------------------
_IGNORED_NAMES: frozenset[str] = frozenset({
    # Windows
    "desktop.ini",
    "thumbs.db",
    "$recycle.bin",
    "system volume information",
    "pagefile.sys",
    "hiberfil.sys",
    "dumpstack.log",

    # macOS
    ".ds_store",
    "__macosx",
    ".spotlight-v100",
    ".trashes",
    ".fseventsd",

    # VCS
    ".git",
    ".svn",
    ".hg",

    # Node / Frontend
    "node_modules",
    ".pnpm-store",
    ".yarn",
    ".yarn-cache",
    ".turbo",
    ".next",
    ".nuxt",
    "dist",
    "build",
    "coverage",

    # Python
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".tox",
    ".venv",
    "venv",
    "env",

    # IDE
    ".idea",
    ".vscode",

    # Generic caches
    ".cache",
    ".temp",
    "tmp",
})


def should_ignore(name: str) -> bool:
    """Return ``True`` if *name* (a single path component) should be skipped.

    The comparison is case-insensitive.  Only the **basename** should be
    passed — do NOT pass a full path.
    """
    return name.lower() in _IGNORED_NAMES


def should_ignore_archive_entry(entry_path: str) -> bool:
    """Return ``True`` if any path component of an archive entry should be ignored.

    Archive entries use ``/`` as separator (even on Windows).
    Example: ``__MACOSX/folder/image.png`` → True
    """
    for part in PurePosixPath(entry_path).parts:
        if should_ignore(part):
            return True
    return False
