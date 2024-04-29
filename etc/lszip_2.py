import os
import zipfile
import tarfile
# import rarfile

def list_compressed_files(filepath):
    """
    Lists the contents of a compressed file. Supports ZIP, RAR, and TAR formats.
    
    Args:
    filepath (str): The path to the compressed file.
    
    Returns:
    list: A list of filenames contained within the compressed file.
    """
    if not os.path.isfile(filepath):
        return "File does not exist."

    try:
        if filepath.endswith('.zip'):
            with zipfile.ZipFile(filepath, 'r') as file:
                return file.namelist()
        elif filepath.endswith('.rar'):
            with rarfile.RarFile(filepath, 'r') as file:
                return file.namelist()
        elif filepath.endswith('.tar') or filepath.endswith('.tar.gz') or filepath.endswith('.tgz'):
            with tarfile.open(filepath, 'r:*') as file:
                return [member.name for member in file.getmembers()]
        else:
            return "Unsupported file format."
    except Exception as e:
        return str(e)

# Example usage:
zip_file_path = "D:\\_Happy_Lesson\\_Unread_2024\\Henrik N\\New folder\\1.zip"
file_list = list_compressed_files(zip_file_path)
print(file_list)
