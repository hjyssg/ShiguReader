# 写一个python小脚本，把任意文件从
# 	X:\git\ShiguReader_Frontend\src\name-parser
# 	X:\git\ShiguReader_Frontend\src\common

# 复制到
# 	X:\git\Shigureader_Backend\src\name-parser
# 	X:\git\Shigureader_Backend\src\common

# 步骤是先把目标文件夹的所有内容都删了。再把源文件夹的文件全部复制过去
# 每个文件，print出来给我看见。
# 只能使用python原生的library。
# 改一下写法，先一个loop去删除文件。再一个loop去复制

import os
import shutil

source_dirs = [
    r"X:\git\ShiguReader_Frontend\src\name-parser",
    r"X:\git\ShiguReader_Frontend\src\common"
]
target_dirs = [
    r"X:\git\Shigureader_Backend\src\name-parser",
    r"X:\git\Shigureader_Backend\src\common"
]

# 先删除目标目录下的所有文件和子目录
for target_dir in target_dirs:
    for root, dirs, files in os.walk(target_dir, topdown=False):
        for filename in files:
            file_path = os.path.join(root, filename)
            print("Deleting file:", file_path)
            os.remove(file_path)
        for dirname in dirs:
            dir_path = os.path.join(root, dirname)
            print("Deleting directory:", dir_path)
            os.rmdir(dir_path)

# 分别复制源目录和目标目录中的所有文件
for i, source_dir in enumerate(source_dirs):
    target_dir = target_dirs[i]

    for root, dirs, files in os.walk(source_dir):
        for filename in files:
            # 构造源文件和目标文件的绝对路径
            source_path = os.path.join(root, filename)
            rel_path = os.path.relpath(source_path, source_dir)
            target_path = os.path.join(target_dir, rel_path)

            # 打印该文件的路径
            print("Copying file:", source_path)

            # 如果目标文件夹不存在，则创建之
            target_folder = os.path.dirname(target_path)
            if not os.path.exists(target_folder):
                os.makedirs(target_folder)

            # 复制文件并覆盖已存在的文件
            shutil.copy2(source_path, target_path)
