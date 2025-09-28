import sqlite3
import pandas as pd
import matplotlib.pyplot as plt
import os

# 连接数据库
script_dir = os.path.dirname(os.path.realpath(__file__))
db_path = os.path.join(script_dir, '../../workspace/shigureader_internal_db.sqlite')
conn = sqlite3.connect(db_path)
query = """
    WITH unique_visits AS (
        SELECT DISTINCT 
            filePath,  
            date(time/1000, 'unixepoch') AS day
        FROM history_table
    )
    SELECT 
        strftime('%Y', day) AS year,
        COUNT(*) AS visits
    FROM unique_visits
    GROUP BY year
    ORDER BY year;
"""

# 执行查询并读取数据
df = pd.read_sql_query(query, conn)
conn.close()

# 转换 year 为字符串（bar chart 横轴更直观）
df['year'] = df['year'].astype(str)

# 绘制柱状图
plt.figure(figsize=(8, 5))
plt.bar(df['year'], df['visits'])
plt.title('Yearly Visits')
plt.xlabel('Year')
plt.ylabel('Number of Visits')
plt.grid(axis='y')  # 只画水平网格线
plt.tight_layout()
plt.show()
