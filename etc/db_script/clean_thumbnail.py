import os
import sqlite3
from pathlib import Path

script_dir = os.path.dirname(os.path.realpath(__file__))
db_path = os.path.join(script_dir, '../../workspace/shigureader_internal_db.sqlite')
db_path = Path(db_path).resolve()


# 连接到数据库
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 查询所有记录
cursor.execute("SELECT filePath, thumbnailFileName FROM thumbnail_table")
rows = cursor.fetchall()

counter = 0

# 循环遍历所有记录
for filePath, thumbnailFileName in rows:
    full_path = os.path.join(r'D:\\Git\ShiguReader_Backend\\thumbnails', thumbnailFileName)
    
    # 检查文件是否存在，且大小是否小于1KB
    if not os.path.isfile(full_path) or os.path.getsize(full_path) < 1024:
        # 删除对应的行
        cursor.execute("DELETE FROM thumbnail_table WHERE filePath = ? AND thumbnailFileName = ?", (filePath, thumbnailFileName))

        counter += 1


# 提交更改并关闭连接
conn.commit()
conn.close()
print(str(counter) + " rows deleted")
