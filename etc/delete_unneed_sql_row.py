import sqlite3
import os

script_dir = os.path.dirname(os.path.realpath(__file__))
db_path = os.path.join(script_dir, '../workspace/shigureader_internal_db.sqlite')

# 连接到SQLite数据库
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # 从thumbnail_table表中查询所有行
    cursor.execute('SELECT rowid, filePath FROM thumbnail_table')
    rows = cursor.fetchall()

    for row in rows:
        rowid, file_path = row
        # 检查filePath指定的文件是否存在
        if not os.path.exists(file_path):
            # 如果文件不存在，删除这一行
            cursor.execute('DELETE FROM thumbnail_table WHERE rowid = ?', (rowid,))
            print(f'Deleted row with rowid {rowid} as file {file_path} does not exist.')

            # 提交更改
            conn.commit()
finally:
    # 关闭数据库连接
    conn.close()

print('Finished checking and deleting rows with non-existent filePaths.')
