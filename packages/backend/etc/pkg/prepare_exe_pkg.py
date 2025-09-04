import os
import shutil

script_dir = os.path.dirname(os.path.realpath(__file__))
root_folder = os.path.normpath(os.path.join(script_dir, '..\\..\\..'))
print("root_folder", root_folder)

pkg_folder = os.path.join(root_folder, "SGR_pkg")
os.makedirs(pkg_folder, exist_ok=True)  # 确保目标文件夹存在

# 要复制的文件夹
folders_to_copy = ["resource", "dist"]
# 要复制的文件
files_to_copy = ["config-etc.ini", "config-path.ini"]

# 覆盖复制文件夹
for folder in folders_to_copy:
    src = os.path.join(root_folder, folder)
    dst = os.path.join(pkg_folder, folder)
    if os.path.exists(dst):
        shutil.rmtree(dst)  # 删除已有目录，保证覆盖
    if os.path.exists(src):
        shutil.copytree(src, dst)
        print(f"Copied folder {src} -> {dst}")
    else:
        print(f"Warning: {src} does not exist")

# 覆盖复制文件
for file in files_to_copy:
    src = os.path.join(root_folder, file)
    dst = os.path.join(pkg_folder, file)
    if os.path.exists(src):
        shutil.copy2(src, dst)
        print(f"Copied file {src} -> {dst}")
    else:
        print(f"Warning: {src} does not exist")
