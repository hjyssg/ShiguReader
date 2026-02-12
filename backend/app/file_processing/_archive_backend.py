from __future__ import annotations

import shutil
import tarfile
import tempfile
import zipfile
from pathlib import Path

try:
    import py7zr
except Exception:  # pragma: no cover
    py7zr = None  # type: ignore[assignment]

try:
    import rarfile
except Exception:  # pragma: no cover
    rarfile = None  # type: ignore[assignment]


def archive_kind(archive_path: Path) -> str:
    name = archive_path.name.lower()
    if name.endswith(".zip"):
        return "zip"
    if name.endswith(".7z"):
        return "7z"
    if name.endswith(".rar"):
        return "rar"
    if any(name.endswith(suffix) for suffix in (".tar", ".tar.gz", ".tgz", ".tar.bz2", ".tbz2")):
        return "tar"
    raise ValueError(f"Unsupported archive format: {archive_path}")


def list_entries(archive_path: Path) -> list[str]:
    kind = archive_kind(archive_path)
    if kind == "zip":
        with zipfile.ZipFile(archive_path, "r") as zf:
            return [name for name in zf.namelist() if not name.endswith("/")]

    if kind == "tar":
        with tarfile.open(archive_path, "r:*") as tf:
            return [m.name for m in tf.getmembers() if m.isfile()]

    if kind == "7z":
        if py7zr is None:
            raise RuntimeError("py7zr is required for .7z files")
        with py7zr.SevenZipFile(archive_path, "r") as szf:
            return [n for n in szf.getnames() if not n.endswith("/")]

    if rarfile is None:
        raise RuntimeError("rarfile is required for .rar files")
    with rarfile.RarFile(archive_path) as rf:
        return [i.filename for i in rf.infolist() if not i.isdir()]


def extract_entries(archive_path: Path, destination: Path, entries: list[str]) -> None:
    kind = archive_kind(archive_path)
    destination.mkdir(parents=True, exist_ok=True)

    if kind == "zip":
        with zipfile.ZipFile(archive_path, "r") as zf:
            for entry in entries:
                zf.extract(entry, path=destination)
        return

    if kind == "tar":
        with tarfile.open(archive_path, "r:*") as tf:
            for entry in entries:
                tf.extract(entry, path=destination, filter="data")
        return

    if kind == "7z":
        if py7zr is None:
            raise RuntimeError("py7zr is required for .7z files")
        with py7zr.SevenZipFile(archive_path, "r") as szf:
            szf.extract(path=destination, targets=entries)
        return

    if rarfile is None:
        raise RuntimeError("rarfile is required for .rar files")
    with rarfile.RarFile(archive_path) as rf:
        for entry in entries:
            rf.extract(entry, path=destination)


def extract_all(archive_path: Path, destination: Path) -> None:
    extract_entries(archive_path, destination, list_entries(archive_path))


def extract_single_to_temp_file(archive_path: Path, entry: str) -> Path:
    temp_dir = Path(tempfile.mkdtemp(prefix="fp-thumb-"))
    extract_entries(archive_path, temp_dir, [entry])
    return temp_dir / entry


def replace_dir_atomic(src_dir: Path, dest_dir: Path) -> None:
    if dest_dir.exists():
        shutil.rmtree(dest_dir)
    dest_dir.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src_dir), str(dest_dir))
