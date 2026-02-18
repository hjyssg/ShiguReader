from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path


def is_filesystem_root(path: Path) -> bool:
    """判断路径是否为文件系统根目录（如 Windows 的 C:\\ 或 POSIX 的 /）。"""
    try:
        resolved = path.resolve()
    except Exception:
        resolved = path
    return resolved.parent == resolved


def normalize_allowed_roots(allowed_roots: Iterable[Path]) -> list[Path]:
    """标准化允许扫描根目录，并折叠嵌套目录。"""
    normalized: list[Path] = []
    for candidate in allowed_roots:
        try:
            resolved = candidate.resolve()
        except Exception:
            continue

        if any(resolved == root or resolved.is_relative_to(root) for root in normalized):
            continue
        normalized = [root for root in normalized if not root.is_relative_to(resolved)]
        normalized.append(resolved)

    return normalized


def derive_minimal_scan_roots(
    filepaths: Iterable[str],
    *,
    allowed_roots: Iterable[Path] = (),
) -> list[Path]:
    """从文件路径推导最小扫描根目录集合，并在推导过程中剔除不可扫描目录。"""
    normalized_allowed = normalize_allowed_roots(allowed_roots)

    candidates: set[Path] = set()
    for filepath in filepaths:
        if not filepath:
            continue

        parent = Path(filepath).parent
        try:
            candidate = parent.resolve()
        except Exception:
            candidate = parent

        if is_filesystem_root(candidate):
            continue

        if normalized_allowed and not any(candidate == root or candidate.is_relative_to(root) for root in normalized_allowed):
            continue

        candidates.add(candidate)

    ordered = sorted(candidates, key=lambda p: (len(p.parts), str(p)))
    selected: list[Path] = []
    for candidate in ordered:
        if any(candidate == root or candidate.is_relative_to(root) for root in selected):
            continue
        selected.append(candidate)

    return selected
