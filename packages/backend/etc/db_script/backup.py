import sqlite3
import os
from datetime import datetime
from pathlib import Path



# 替换为你的数据库文件路径
script_dir = os.path.dirname(os.path.realpath(__file__))
db_path = os.path.join(script_dir, '../../workspace/shigureader_internal_db.sqlite')
db_path = Path(db_path).resolve()

# Dropbox 备份目录
backup_dir = Path(r"F:\Program Files\Dropbox\db_backup")
backup_dir.mkdir(parents=True, exist_ok=True)

# 创建备份文件的路径，文件名中包含日期
current_date = datetime.now().strftime("%Y%m%d_%H%M%S")
backup_db_path = backup_dir / f'shigureader_internal_db_backup_{current_date}.sqlite'

# 使用 SQLite 在线备份 API，避免直接复制运行中的数据库文件造成备份不完整
with sqlite3.connect(db_path) as source_conn:
    with sqlite3.connect(backup_db_path) as backup_conn:
        source_conn.backup(backup_conn)

print(f"Backup completed: {backup_db_path}")
