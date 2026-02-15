"""Build exe and package dist folder into a distributable zip."""

from __future__ import annotations

import shutil
import subprocess
import sys
import time
import tempfile
from datetime import datetime
from pathlib import Path


PROJECT_ROOT = Path(__file__).parent.parent
DIST_DIR = PROJECT_ROOT / "dist"
RELEASE_DIR = PROJECT_ROOT / "release"


def _stop_running_exe() -> None:
    """Stop running ShiguReader.exe to avoid PyInstaller overwrite PermissionError."""
    print("Checking running ShiguReader.exe processes...")
    result = subprocess.run(
        ["cmd", "/c", "tasklist /FI \"IMAGENAME eq ShiguReader.exe\""],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore",
    )
    output = result.stdout or ""
    if "ShiguReader.exe" not in output:
        print("No running ShiguReader.exe detected.")
        return

    print("Detected running ShiguReader.exe, stopping it for rebuild...")
    subprocess.run(["cmd", "/c", "taskkill /IM ShiguReader.exe /F /T"], check=False)
    time.sleep(1.0)


def run_build_exe() -> None:
    print("=" * 60)
    print("Step 1/2: Build EXE")
    print("=" * 60)
    _stop_running_exe()
    subprocess.run([sys.executable, "build_tools/build_exe.py"], cwd=PROJECT_ROOT, check=True)


def package_dist_zip() -> Path:
    print("\n" + "=" * 60)
    print("Step 2/2: Package dist as ZIP")
    print("=" * 60)

    if not (DIST_DIR / "ShiguReader.exe").exists():
        raise FileNotFoundError("dist/ShiguReader.exe not found, build may have failed")

    RELEASE_DIR.mkdir(parents=True, exist_ok=True)

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    archive_base = RELEASE_DIR / f"ShiguReader-dist-{stamp}"

    # 安全分发：不打包 dist/data，避免本地测试数据泄露
    with tempfile.TemporaryDirectory(prefix="shigureader_dist_") as tmp:
        staging_dist = Path(tmp) / "dist"
        shutil.copytree(DIST_DIR, staging_dist)

        staged_data = staging_dist / "data"
        if staged_data.exists():
            shutil.rmtree(staged_data)

        # 保留空数据目录结构，供首次运行自动写入
        (staging_dist / "data" / "thumb_cache").mkdir(parents=True, exist_ok=True)
        (staging_dist / "data" / "extract_cache").mkdir(parents=True, exist_ok=True)
        (staging_dist / "data" / ".gitkeep").write_text("", encoding="utf-8")

        archive_path = shutil.make_archive(str(archive_base), "zip", root_dir=tmp, base_dir="dist")

    zip_path = Path(archive_path)
    print(f"✓ ZIP created: {zip_path}")
    print("✓ dist/data content excluded from ZIP for privacy")
    return zip_path


def main() -> None:
    run_build_exe()
    zip_path = package_dist_zip()

    print("\n" + "=" * 60)
    print("Package Complete")
    print("=" * 60)
    print(f"ZIP: {zip_path}")
    print("\nYou can send this ZIP directly to others.")


if __name__ == "__main__":
    main()
