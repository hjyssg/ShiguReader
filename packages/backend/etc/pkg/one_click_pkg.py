#!/usr/bin/env python3
"""Utility script to build ShiguReader backend executable with pkg.

Steps:
1. Synchronize the frontend build output to the backend `dist` directory.
2. Run `pkg` with the documented arguments to produce the executable.
"""

from __future__ import annotations

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


def run_sync() -> None:
    """Run the frontend asset synchronization script."""
    if not SYNC_SCRIPT.is_file():
        raise FileNotFoundError(f"找不到同步脚本: {SYNC_SCRIPT}")

    print("[1/2] 同步前端资源到后端……")
    subprocess.run(
        [sys.executable, str(SYNC_SCRIPT)],
        cwd=BACKEND_DIR,
        check=True,
    )


def run_pkg() -> None:
    """Execute pkg to build the backend executable."""
    pkg_cmd = shutil.which("pkg")
    if pkg_cmd is None:
        raise FileNotFoundError(
            "未找到 `pkg` 命令，请先按 README 说明安装 (npm install -g pkg)。"
        )

    print("[2/2] 运行 pkg 打包后端……")
    subprocess.run(
        [pkg_cmd, ".", "--compress", "GZip"],
        cwd=BACKEND_DIR,
        check=True,
    )


def copy_release_assets() -> None:
    """复制 dist 与 resource 到打包目录。"""

    dist_dir = BACKEND_DIR / "dist"
    resource_dir = BACKEND_DIR / "resource"

    RELEASE_DIR.mkdir(parents=True, exist_ok=True)

    for folder in (dist_dir, resource_dir):
        if not folder.exists():
            raise FileNotFoundError(f"缺少必须的目录: {folder}")

        target = RELEASE_DIR / folder.name
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(folder, target)
        print(f"已复制 {folder} -> {target}")


def clear_release_workspace() -> None:
    """清空打包目录中的 workspace。"""

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

    today = datetime.now().strftime("%Y-%m-%d")
    zip_path = REPO_ROOT / f"ShiguReader_{today}.zip"

    if zip_path.exists():
        zip_path.unlink()

    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in RELEASE_DIR.rglob("*"):
            if path.is_dir():
                continue
            archive.write(path, path.relative_to(RELEASE_DIR))

    print(f"已生成压缩包: {zip_path}")
    return zip_path


def main() -> None:
    run_sync()
    run_pkg()
    copy_release_assets()
    clear_release_workspace()
    zip_release()
    print("✅ 打包流程完成。")


if __name__ == "__main__":
    main()
