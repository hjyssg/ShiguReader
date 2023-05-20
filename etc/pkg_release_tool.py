# create a small python script for me.
# In my one of project folder.
# Delete anything under folders "thumbnails" and "workspace" and "cache".
# Then compress this folder into a zip.
# Only use library come with python. Not external dependency.

import os
import shutil
import zipfile


# The path to the parent directory that will be compressed
parent_dir = "X:\\git\\ShiguReader_pkg"
zip_file_path = os.path.join("X:\\git", "ShiguReader_pkg.zip")

# The relative paths of the directories to be emptied
dirs_to_empty = ["thumbnails", "workspace", "cache"]

# Empty the specified directories
for dir_name in dirs_to_empty:
    dir_path = os.path.join(parent_dir, dir_name)
    if os.path.exists(dir_path):
        shutil.rmtree(dir_path)
    os.mkdir(dir_path)

# Compress the parent directory into a zip file
with zipfile.ZipFile(zip_file_path, "w") as zipf:
    for root, _, files in os.walk(parent_dir):
        for file in files:
            abs_path = os.path.join(root, file)
            rel_path = os.path.relpath(abs_path, parent_dir)
            zipf.write(abs_path, arcname=rel_path)

print("Done!")