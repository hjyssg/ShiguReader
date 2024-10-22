import sqlite3
import os
from datetime import datetime
from pathlib import Path



# 替换为你的数据库文件路径
script_dir = os.path.dirname(os.path.realpath(__file__))
db_path_1 = os.path.join(script_dir, '../../workspace/shigureader_internal_db.sqlite')
db_path_1 = Path(db_path_1).resolve()




db_path_2 = os.path.join(script_dir, '../../../SGR_pkg/workspace/shigureader_internal_db.sqlite')
db_path_2 = Path(db_path_2).resolve()

print(db_path_1)
print(db_path_2)


# --------------------

def backup_data(source_db_path, target_db_path, batch_size=1000):
    """Back up data from source_db_path to target_db_path in batches."""
    # Connect to the source and target databases
    source_conn = sqlite3.connect(source_db_path)
    target_conn = sqlite3.connect(target_db_path)
    
    # Read data in batches from the source and write to the target
    read_cursor = source_conn.cursor()
    write_cursor = target_conn.cursor()
    
    read_cursor.execute("SELECT filePath, dirPath, fileName, time FROM history_table")
    while True:
        rows = read_cursor.fetchmany(batch_size)
        if not rows:
            break
        write_cursor.executemany("INSERT INTO history_table (filePath, dirPath, fileName, time) VALUES (?, ?, ?, ?)", rows)
        target_conn.commit()
    
    # Close all connections
    source_conn.close()
    target_conn.close()

    print(f"Data backed up from {source_db_path} to {target_db_path}")

# Running the backup
backup_data(db_path_1, db_path_2)