import os
import shutil
from pathlib import Path
import subprocess

script_dir = Path(__file__).resolve().parent
root = script_dir.parent.parent.resolve()

frontend_path = root / 'packages' / 'frontend'
backend_path = root / 'packages' / 'backend'

source_dir = frontend_path / 'dist'
target_dir = backend_path / 'dist'

build_command = "npm run build"
subprocess.run(build_command, shell=True, cwd=str(frontend_path), check=True)

if target_dir.exists():
    for root_dir, dirs, files in os.walk(target_dir, topdown=False):
        for filename in files:
            file_path = Path(root_dir) / filename
            print("Deleting file:", file_path)
            file_path.unlink()
        for dirname in dirs:
            dir_path = Path(root_dir) / dirname
            print("Deleting directory:", dir_path)
            dir_path.rmdir()
else:
    target_dir.mkdir(parents=True, exist_ok=True)

for root_dir, dirs, files in os.walk(source_dir):
    for filename in files:
        source_path = Path(root_dir) / filename
        rel_path = source_path.relative_to(source_dir)
        target_path = target_dir / rel_path

        print("Copying file:", source_path)

        target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_path, target_path)
