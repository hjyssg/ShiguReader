import os
import shutil
import zipfile
from datetime import date

# 让chatgpt帮我写的打包脚本

# The path to the project directory that will be compressed
import os
import shutil

script_dir = os.path.dirname(os.path.realpath(__file__))
root_folder = os.path.normpath(os.path.join(script_dir, '..\\..\\..'))
print("root_folder", root_folder)
pkg_folder =  os.path.join(root_folder, "SGR_pkg")   

# The relative paths of the directories to be excluded from the compression
dirs_to_exclude = ["thumbnails", "workspace", "cache", ".git"]

today = date.today().strftime("%Y-%m-%d")

# Create a zipfile with the name project_files.zip and add each file and folder to it (excluding specified directories)
zip_file_path = os.path.join(root_folder, f"ShiguReader_{today}.zip")
with zipfile.ZipFile(zip_file_path, "w") as zipf:
    for root, dirs, files in os.walk(pkg_folder):
        # Exclude specified directories from being added to the zipfile
        dirs[:] = [dd for dd in dirs if dd not in dirs_to_exclude]
        
        for file in files:
            abs_path = os.path.join(root, file)
            rel_path = os.path.relpath(abs_path, pkg_folder)
            zipf.write(abs_path, arcname=rel_path)

print("Done!")