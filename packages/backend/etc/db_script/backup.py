import sqlite3
import os
import shutil
from datetime import datetime
from pathlib import Path



# 替换为你的数据库文件路径
script_dir = os.path.dirname(os.path.realpath(__file__))
db_path = os.path.join(script_dir, '../../workspace/shigureader_internal_db.sqlite')
db_path = Path(db_path).resolve()

# 获取当前日期
current_date = datetime.now().strftime("%Y%m%d")

# 创建备份文件的路径，文件名中包含日期
backup_db_path = os.path.join("D:\\", f'shigureader_internal_db_backup_{current_date}.sqlite')

# 执行备份操作
shutil.copy(db_path, backup_db_path)

print(f"Backup completed: {backup_db_path}")