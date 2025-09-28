#!/usr/bin/env python3
"""Utility script to build the ShiguReader backend executable with pkg.

Steps:
1. Synchronize the frontend build output to the backend ``dist`` directory.
2. Run ``npm run pkg`` (which delegates to ``pkg . --compress GZip``).
3. Copy the assets listed in ``pkg_readme.md`` into ``ShiguReaderExeRelease``.
4. Copy the backend configuration files needed by the executable.
5. Remove leftover ``workspace`` contents to avoid bloating the archive.
6. Produce a dated ``ShiguReader_YYYY-MM-DD.zip`` release package.
"""



from __future__ import annotations

import os
import shutil
import subprocess
import sys
import zipfile
from datetime import datetime
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent.parent
PACKAGES_DIR = BACKEND_DIR.parent
REPO_ROOT = PACKAGES_DIR.parent
RELEASE_DIR = PACKAGES_DIR / "ShiguReaderExeRelease"
SYNC_SCRIPT = BACKEND_DIR / "etc" / "sync_frontend_assets_to_backend.py"
ASSET_FOLDERS = ("dist", "resource")
ADDITIONAL_FILES = ("config-etc.ini", "config-path.ini")
ZIP_EXCLUDE_DIRS = {"workspace", "thumbnails", "cache", ".git"}


def run_sync() -> None:
    """Run the frontend asset synchronization script."""
    if not SYNC_SCRIPT.is_file():
        raise FileNotFoundError(f"找不到同步脚本: {SYNC_SCRIPT}")

    print("[1/6] 同步前端资源到后端……")
    subprocess.run(
        [sys.executable, str(SYNC_SCRIPT)],
        cwd=BACKEND_DIR,
        check=True,
    )


def run_pkg() -> None:
    """Execute the npm pkg script to build the backend executable."""
    npm_cmd = shutil.which("npm")
    if npm_cmd is None:
        raise FileNotFoundError("未找到 `npm`，请先安装 Node.js 并确保 npm 在 PATH 中。")

    print("[2/6] 运行 npm run pkg 打包后端……")
    command = [npm_cmd, "run", "pkg"]
    if npm_cmd.lower().endswith((".cmd", ".bat")):
        command = [os.environ.get("COMSPEC", "cmd"), "/c", npm_cmd, "run", "pkg"]

    subprocess.run(
        command,
        cwd=BACKEND_DIR,
        check=True,
    )


def copy_release_folders() -> None:
    """Copy dist/resource into the release directory as documented."""

    print("[3/6] 复制 dist/resource 到 ShiguReaderExeRelease……")
    RELEASE_DIR.mkdir(parents=True, exist_ok=True)

    for folder_name in ASSET_FOLDERS:
        folder = BACKEND_DIR / folder_name
        if not folder.exists():
            raise FileNotFoundError(f"缺少必须的目录: {folder}")

        target = RELEASE_DIR / folder_name
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(folder, target)
        print(f"已复制 {folder} -> {target}")


def copy_release_files() -> None:
    """Copy additional config files into the release directory."""

    print("[4/6] 复制配置文件到 ShiguReaderExeRelease……")
    for file_name in ADDITIONAL_FILES:
        src = BACKEND_DIR / file_name
        if not src.is_file():
            raise FileNotFoundError(f"缺少必须的文件: {src}")

        dst = RELEASE_DIR / file_name
        shutil.copy2(src, dst)
        print(f"已复制 {src} -> {dst}")


def clear_release_workspace() -> None:
    """清空打包目录中的 workspace。"""

    print("[5/6] 清理 workspace……")
    workspace_dir = RELEASE_DIR / "workspace"
    workspace_dir.mkdir(parents=True, exist_ok=True)

    for child in list(workspace_dir.iterdir()):
        if child.is_dir():
            shutil.rmtree(child)
        else:
            child.unlink()

    print(f"已清空 {workspace_dir}")


def zip_release() -> Path:
    """将打包目录压缩成带日期后缀的 zip。"""

    print("[6/6] 生成压缩包……")
    today = datetime.now().strftime("%Y-%m-%d")
    zip_path = REPO_ROOT / f"ShiguReader_{today}.zip"

    if zip_path.exists():
        zip_path.unlink()

    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in RELEASE_DIR.rglob("*"):
            if path.is_dir():
                continue

            rel = path.relative_to(RELEASE_DIR)
            if any(part in ZIP_EXCLUDE_DIRS for part in rel.parts):
                continue

            archive.write(path, rel)

    print(f"已生成压缩包: {zip_path}")
    return zip_path


def main() -> None:
    run_sync()
    run_pkg()
    copy_release_folders()
    copy_release_files()
    clear_release_workspace()
    zip_release()
    print("✅ 打包流程完成。")


if __name__ == "__main__":
    main()
