import sqlite3
import os

# VACUUM 是一个 SQLite 命令，用来清理数据库文件中的空闲页面，
# 通常在删除了大量数据后使用。执行 VACUUM 可以压缩数据库文件，释放未使用的磁盘空间。

def vacuum_sqlite_db(path_to_db):
    # 连接到 SQLite 数据库
    conn = sqlite3.connect(path_to_db)
    cursor = conn.cursor()

    # 执行 VACUUM 命令
    cursor.execute("VACUUM;")
    print("Database has been vacuumed.")

    # 关闭连接
    cursor.close()
    conn.close()

# 替换为你的数据库文件路径
script_dir = os.path.dirname(os.path.realpath(__file__))
db_path = os.path.join(script_dir, '../workspace/shigureader_internal_db.sqlite')
vacuum_sqlite_db(db_path)