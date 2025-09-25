# 写一个python小脚本，把任意文件从
# 	packages/frontend/src/name-parser
# 	packages/frontend/src/common
# dist

# 复制到
# 	packages/backend/src/name-parser
# 	packages/backend/src/common

# 步骤是先把目标文件夹的所有内容都删了。再把源文件夹的文件全部复制过去
# 每个文件，print出来给我看见。
# 只能使用python原生的library。
# 改一下写法，先一个loop去删除文件。再一个loop去复制

import os
import shutil
import subprocess
from pathlib import Path

script_dir = Path(__file__).resolve().parent
backend_path = script_dir.parent.resolve()
frontend_path = backend_path.parent / "frontend"


SYNC_DIRS = [
    (frontend_path / "src" / "name-parser", backend_path / "src" / "name-parser"),
    (frontend_path / "src" / "common", backend_path / "src" / "common"),
    (frontend_path / "dist", backend_path / "dist"),
]


#--------------------- build
subprocess.run("npm run build", shell=True, cwd=frontend_path, check=True)


# ------------------ 先删除目标目录下的所有文件和子目录
for _, target_dir in SYNC_DIRS:
    target_dir.mkdir(parents=True, exist_ok=True)
    for root, dirs, files in os.walk(target_dir, topdown=False):
        for filename in files:
            file_path = Path(root) / filename
            print("Deleting file:", file_path)
            file_path.unlink()
        for dirname in dirs:
            dir_path = Path(root) / dirname
            print("Deleting directory:", dir_path)
            dir_path.rmdir()

# 分别复制源目录和目标目录中的所有文件
for source_dir, target_dir in SYNC_DIRS:
    if not source_dir.exists():
        raise FileNotFoundError(f"源目录不存在: {source_dir}")

    for root, dirs, files in os.walk(source_dir):
        root_path = Path(root)
        for filename in files:
            source_path = root_path / filename
            rel_path = source_path.relative_to(source_dir)
            target_path = target_dir / rel_path

            # 打印该文件的路径
            print("Copying file:", source_path)

            # 如果目标文件夹不存在，则创建之
            target_folder = target_path.parent
            target_folder.mkdir(parents=True, exist_ok=True)

            # 复制文件并覆盖已存在的文件
            shutil.copy2(source_path, target_path)
