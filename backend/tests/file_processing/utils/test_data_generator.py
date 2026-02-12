from __future__ import annotations

import io
import shutil
import tarfile
import zipfile
from pathlib import Path
from typing import Any

import requests
from PIL import Image

try:
    import py7zr
except Exception:  # pragma: no cover - optional dependency during collection
    py7zr = None  # type: ignore[assignment]


class TestDataGenerator:
    """Generate fixture data for archive and image processing tests."""

    __test__ = False

    def __init__(self, base_dir: Path) -> None:
        self.base_dir = base_dir
        self.source_dir = self.base_dir / "source"
        self.archives_dir = self.base_dir / "archives"
        self.source_dir.mkdir(parents=True, exist_ok=True)
        self.archives_dir.mkdir(parents=True, exist_ok=True)

    def prepare_all(self) -> dict[str, Any]:
        files = self._create_source_files()
        archives = self._create_archives(files)
        return {
            "base_dir": self.base_dir,
            "source_dir": self.source_dir,
            "archives_dir": self.archives_dir,
            "files": files,
            "archives": archives,
        }

    def _create_source_files(self) -> dict[str, Path]:
        nested = self.source_dir / "nested"
        images = nested / "images"
        docs = nested / "docs"
        images.mkdir(parents=True, exist_ok=True)
        docs.mkdir(parents=True, exist_ok=True)

        img1 = images / "001-cover.jpg"
        img2 = images / "002-sample.png"
        txt = docs / "readme.txt"
        md = self.source_dir / "notes.md"

        self._download_or_generate_image(
            img1,
            url="https://picsum.photos/640/480",
            size=(640, 480),
            color=(35, 100, 210),
            fmt="JPEG",
        )
        self._download_or_generate_image(
            img2,
            url="https://picsum.photos/700/500",
            size=(700, 500),
            color=(170, 50, 90),
            fmt="PNG",
        )

        txt.write_text("hello archive test\n", encoding="utf-8")
        md.write_text("# fixture\n", encoding="utf-8")

        return {
            "cover": img1,
            "sample": img2,
            "readme": txt,
            "notes": md,
        }

    def _download_or_generate_image(
        self,
        output_path: Path,
        *,
        url: str,
        size: tuple[int, int],
        color: tuple[int, int, int],
        fmt: str,
    ) -> None:
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            image = Image.open(io.BytesIO(response.content))
            image.save(output_path, format=fmt)
            return
        except Exception:
            image = Image.new("RGB", size=size, color=color)
            image.save(output_path, format=fmt)

    def _create_archives(self, files: dict[str, Path]) -> dict[str, Path]:
        relative_paths = [
            files["cover"].relative_to(self.source_dir),
            files["sample"].relative_to(self.source_dir),
            files["readme"].relative_to(self.source_dir),
            files["notes"].relative_to(self.source_dir),
        ]

        archives: dict[str, Path] = {}
        archives["zip"] = self._create_zip(relative_paths)
        archives["tar"] = self._create_tar(relative_paths, mode="w", suffix=".tar")
        archives["tar_gz"] = self._create_tar(relative_paths, mode="w:gz", suffix=".tar.gz")
        archives["tar_bz2"] = self._create_tar(
            relative_paths,
            mode="w:bz2",
            suffix=".tar.bz2",
        )

        seven = self._create_7z(relative_paths)
        if seven:
            archives["7z"] = seven

        rar = self._create_rar(relative_paths)
        if rar:
            archives["rar"] = rar

        return archives

    def _create_zip(self, relative_paths: list[Path]) -> Path:
        archive = self.archives_dir / "sample.zip"
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for rel in relative_paths:
                zf.write(self.source_dir / rel, arcname=rel.as_posix())
        return archive

    def _create_tar(self, relative_paths: list[Path], *, mode: str, suffix: str) -> Path:
        archive = self.archives_dir / f"sample{suffix}"
        with tarfile.open(archive, mode) as tf:
            for rel in relative_paths:
                tf.add(self.source_dir / rel, arcname=rel.as_posix())
        return archive

    def _create_7z(self, relative_paths: list[Path]) -> Path | None:
        if py7zr is None:
            return None
        archive = self.archives_dir / "sample.7z"
        with py7zr.SevenZipFile(archive, "w") as sz:
            for rel in relative_paths:
                sz.write(self.source_dir / rel, arcname=rel.as_posix())
        return archive

    def _create_rar(self, relative_paths: list[Path]) -> Path | None:
        rar_exe = shutil.which("rar")
        if rar_exe is None:
            return None
        archive = self.archives_dir / "sample.rar"
        import subprocess

        cmd = [rar_exe, "a", "-ep1", str(archive)]
        cmd.extend(str(self.source_dir / rel) for rel in relative_paths)
        proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if proc.returncode != 0:
            return None
        return archive
