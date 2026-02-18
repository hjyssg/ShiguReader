from __future__ import annotations

from pathlib import Path

from app.services import file_sync_roots


def test_derive_minimal_scan_roots_removes_nested_dirs() -> None:
    roots = file_sync_roots.derive_minimal_scan_roots(
        [
            "/data/library/a/1.jpg",
            "/data/library/a/sub/2.jpg",
            "/data/library/b/3.jpg",
        ]
    )

    assert roots == [Path('/data/library/a'), Path('/data/library/b')]


def test_derive_minimal_scan_roots_skips_filesystem_root() -> None:
    roots = file_sync_roots.derive_minimal_scan_roots([
        "/a.jpg",
        "/safe/lib/book.jpg",
    ])

    assert roots == [Path('/safe/lib')]


def test_derive_minimal_scan_roots_applies_allowlist_during_derivation() -> None:
    roots = file_sync_roots.derive_minimal_scan_roots(
        [
            "/safe/library/a.jpg",
            "/outside/data/b.jpg",
            "/safe/library/sub/c.jpg",
        ],
        allowed_roots=[Path('/safe')],
    )

    assert roots == [Path('/safe/library')]


def test_normalize_allowed_roots_collapses_nested_entries() -> None:
    allowlist = file_sync_roots.normalize_allowed_roots(
        [
            Path('/safe/library'),
            Path('/safe'),
            Path('/safe/books'),
        ]
    )

    assert allowlist == [Path('/safe')]
