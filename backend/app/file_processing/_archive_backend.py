from __future__ import annotations

import subprocess
import shutil
import tarfile
import tempfile
import zipfile
from pathlib import Path

from app.file_processing.ignore import should_ignore_archive_entry

try:
    import py7zr
except Exception:  # pragma: no cover
    py7zr = None  # type: ignore[assignment]

try:
    import rarfile
except Exception:  # pragma: no cover
    rarfile = None  # type: ignore[assignment]


def _resolve_7z_executable() -> Path | None:
    backend_dir = Path(__file__).resolve().parents[2]
    candidate = backend_dir / "tools" / "7zip-lite" / "7z.exe"
    if candidate.exists():
        return candidate
    return None


def _run_7z_command(command_args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command_args,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
        encoding="utf-8",
        errors="replace",
    )


def _extract_entries_via_7z(archive_path: Path, destination: Path, entries: list[str]) -> None:
    seven_zip = _resolve_7z_executable()
    if seven_zip is None:
        raise RuntimeError("7z.exe not found at backend/tools/7zip-lite/7z.exe")

    destination.mkdir(parents=True, exist_ok=True)

    with tempfile.NamedTemporaryFile("w", suffix=".lst", encoding="utf-8", delete=False) as lf:
        list_file = Path(lf.name)
        for entry in entries:
            lf.write(entry)
            lf.write("\n")

    try:
        cmd = [
            str(seven_zip),
            "x",
            str(archive_path),
            f"-o{destination}",
            "-y",
            "-bb0",
            "-scsUTF-8",
            f"@{list_file}",
        ]
        result = _run_7z_command(cmd)
    finally:
        list_file.unlink(missing_ok=True)

    if result.returncode != 0:
        raise RuntimeError(
            f"7z extract failed (code={result.returncode}): {result.stderr.strip() or result.stdout.strip()}"
        )


def _list_entries_via_7z(archive_path: Path) -> list[str]:
    with tempfile.TemporaryDirectory(prefix="fp-list-7z-") as tmp_dir:
        tmp_path = Path(tmp_dir)
        _extract_entries_via_7z(archive_path, tmp_path, ["*"])
        return [
            p.relative_to(tmp_path).as_posix()
            for p in tmp_path.rglob("*")
            if p.is_file() and not should_ignore_archive_entry(p.relative_to(tmp_path).as_posix())
        ]


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
    try:
        if kind == "zip":
            with zipfile.ZipFile(archive_path, "r") as zf:
                raw = [name for name in zf.namelist() if not name.endswith("/")]

        elif kind == "tar":
            with tarfile.open(archive_path, "r:*") as tf:
                raw = [m.name for m in tf.getmembers() if m.isfile()]

        elif kind == "7z":
            if py7zr is None:
                raise RuntimeError("py7zr is required for .7z files")
            with py7zr.SevenZipFile(archive_path, "r") as szf:
                raw = [n for n in szf.getnames() if not n.endswith("/")]

        else:
            if rarfile is None:
                raise RuntimeError("rarfile is required for .rar files")
            with rarfile.RarFile(archive_path) as rf:
                raw = [i.filename for i in rf.infolist() if not i.isdir()]

        return [e for e in raw if not should_ignore_archive_entry(e)]
    except Exception as primary_error:
        if kind == "tar":
            raise
        try:
            return _list_entries_via_7z(archive_path)
        except Exception as fallback_error:
            raise RuntimeError(
                f"Failed to list archive entries via primary backend ({primary_error}) and 7z fallback ({fallback_error})"
            ) from fallback_error


def extract_entries(archive_path: Path, destination: Path, entries: list[str]) -> None:
    kind = archive_kind(archive_path)
    destination.mkdir(parents=True, exist_ok=True)
    try:
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
    except Exception as primary_error:
        if kind == "tar":
            raise
        try:
            _extract_entries_via_7z(archive_path, destination, entries)
            return
        except Exception as fallback_error:
            raise RuntimeError(
                f"Failed to extract archive entries via primary backend ({primary_error}) and 7z fallback ({fallback_error})"
            ) from fallback_error


def extract_all(archive_path: Path, destination: Path) -> None:
    extract_entries(archive_path, destination, list_entries(archive_path))


def extract_single_to_temp_file(archive_path: Path, entry: str) -> Path:
    temp_dir = Path(tempfile.mkdtemp(prefix="fp-thumb-"))
    suffix = Path(entry).suffix or ".bin"
    output_path = temp_dir / f"entry{suffix}"

    kind = archive_kind(archive_path)
    try:
        if kind == "zip":
            with zipfile.ZipFile(archive_path, "r") as zf:
                with zf.open(entry, "r") as source, output_path.open("wb") as target:
                    shutil.copyfileobj(source, target)
            return output_path

        if kind == "tar":
            with tarfile.open(archive_path, "r:*") as tf:
                member = tf.getmember(entry)
                source = tf.extractfile(member)
                if source is None:
                    raise FileNotFoundError(f"Entry not found in tar archive: {entry}")
                with source, output_path.open("wb") as target:
                    shutil.copyfileobj(source, target)
            return output_path

        if kind == "7z" and py7zr is not None:
            with py7zr.SevenZipFile(archive_path, "r") as szf:
                extracted = szf.read(targets=[entry])
                if entry not in extracted or not extracted[entry]:
                    raise FileNotFoundError(f"Entry not found in 7z archive: {entry}")
                with extracted[entry][0] as source, output_path.open("wb") as target:
                    shutil.copyfileobj(source, target)
            return output_path

        if kind == "rar" and rarfile is not None:
            with rarfile.RarFile(archive_path) as rf:
                source = rf.open(entry)
                with source, output_path.open("wb") as target:
                    shutil.copyfileobj(source, target)
            return output_path
    except Exception:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise

    extract_entries(archive_path, temp_dir, [entry])
    extracted_files = [p for p in temp_dir.rglob("*") if p.is_file()]
    if not extracted_files:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise FileNotFoundError(f"Entry not extracted: {entry}")
    return extracted_files[0]


def replace_dir_atomic(src_dir: Path, dest_dir: Path) -> None:
    if dest_dir.exists():
        shutil.rmtree(dest_dir)
    dest_dir.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src_dir), str(dest_dir))
