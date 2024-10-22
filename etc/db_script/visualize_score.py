import sqlite3
import pandas as pd
import matplotlib.pyplot as plt
import os

# 连接数据库
script_dir = os.path.dirname(os.path.realpath(__file__))
db_path = os.path.join(script_dir, '../../workspace/shigureader_internal_db.sqlite')
conn = sqlite3.connect(db_path)

# 查询 type = 'author' 的 score 数据
query = "SELECT score FROM tag_table WHERE type = 'author'"
df = pd.read_sql_query(query, conn)

# 关闭数据库连接
conn.close()

# 绘制直方图
plt.figure(figsize=(10, 6))
plt.hist(df['score'], bins=30, edgecolor='k', alpha=0.7)
plt.title('Score Distribution for Authors')
plt.xlabel('Score')
plt.ylabel('Frequency')
plt.grid(True)
plt.show()
