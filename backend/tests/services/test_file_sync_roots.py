from __future__ import annotations

from pathlib import Path, PureWindowsPath

import pytest

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


def test_derive_minimal_scan_roots_windows_multi_drive_large_dataset(monkeypatch: pytest.MonkeyPatch) -> None:
    """Windows 场景：覆盖 C/D/E 多盘、多层级、100+ 文件路径，确保不会导出非法根。"""
    class _TestWindowsPath(PureWindowsPath):
        def resolve(self) -> "_TestWindowsPath":
            return self

    monkeypatch.setattr(file_sync_roots, "Path", _TestWindowsPath)

    filepaths: list[str] = []
    # 3 个盘符 * 40 条 = 120 条，覆盖不同层级
    for drive in ("C", "D", "E"):
        for idx in range(40):
            depth = (idx % 5) + 1
            parts = [f"lvl{n}_{idx % 7}" for n in range(depth)]
            filename = f"file_{idx}.jpg"
            filepaths.append(str(PureWindowsPath(f"{drive}:/").joinpath(*parts, filename)))

    # 补充几类边界样本：盘符根文件、允许目录深层文件、明显越界路径
    filepaths.extend(
        [
            r"C:\root_level.mp4",
            r"D:\root_level.mp4",
            r"E:\root_level.mp4",
            r"C:\media\books\sub\ok_1.zip",
            r"D:\library\novels\sub\ok_2.zip",
            r"E:\outside\forbidden\x.zip",
        ]
    )

    roots = file_sync_roots.derive_minimal_scan_roots(
        filepaths,
        allowed_roots=[
            file_sync_roots.Path(r"C:\media"),
            file_sync_roots.Path(r"D:\library"),
        ],
    )

    # 所有结果都应在 allowlist 内
    allowed = [file_sync_roots.Path(r"C:\media"), file_sync_roots.Path(r"D:\library")]
    assert roots
    assert all(any(root == ar or root.is_relative_to(ar) for ar in allowed) for root in roots)

    # 不应出现盘符根目录，避免误扫整盘
    forbidden_roots = {PureWindowsPath("C:/"), PureWindowsPath("D:/"), PureWindowsPath("E:/")}
    assert all(root not in forbidden_roots for root in roots)

    # 不应出现 E 盘路径（不在 allowlist）
    assert all(str(root).startswith(("C:\\", "D:\\")) for root in roots)
    assert all(not str(root).startswith("E:\\") for root in roots)
