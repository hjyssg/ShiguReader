# 写一个python小脚本，把任意文件从
# 	packages/frontend/dist

# 复制到
# 	packages/backend/dist



import os
import shutil
import subprocess
from pathlib import Path

script_dir = Path(__file__).resolve().parent
backend_path = script_dir.parent.resolve()
frontend_path = backend_path.parent / "frontend"


SYNC_DIRS = [
    (frontend_path / "dist", backend_path / "dist"),
]


#---------------------step1: build
subprocess.run("npm run build", shell=True, cwd=frontend_path, check=True)


# ------------------ step2: 先删除目标目录下的所有文件和子目录
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

#-------------------step3: 分别复制源目录和目标目录中的所有文件
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
