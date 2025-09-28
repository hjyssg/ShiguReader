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
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
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


def main() -> None:
    run_sync()
    run_pkg()
    print("✅ 打包流程完成。")


if __name__ == "__main__":
    main()
