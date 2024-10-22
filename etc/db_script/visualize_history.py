import sqlite3
import pandas as pd
import matplotlib.pyplot as plt
import os

# 连接数据库
script_dir = os.path.dirname(os.path.realpath(__file__))
db_path = os.path.join(script_dir, '../../workspace/shigureader_internal_db.sqlite')
conn = sqlite3.connect(db_path)
query = """
    -- 使用 WITH 子句定义一个名为 unique_visits 的临时视图
    -- 此视图包含每个文件每天的唯一访问记录
    WITH unique_visits AS (
        -- 选择 distinct 条目以确保每个文件在每一天只被统计一次
        SELECT DISTINCT 
            filePath,  -- 文件路径
            date(time/1000, 'unixepoch') AS day  -- 将时间戳（假设以毫秒为单位）转换为日期格式
        FROM history_table  -- 从历史记录表中提取数据
    )
    -- 从临时视图 unique_visits 中选择数据来计算每周的访问次数
    SELECT 
        -- 使用 strftime 将日期转换为 '年-周' 格式，并且基于 Unix 时间戳转换日期
        strftime('%Y-%W', datetime(strftime('%s', day), 'unixepoch')) AS week,
        COUNT(*) AS visits  -- 计算每周的访问次数
    FROM unique_visits  -- 从 unique_visits 视图中获取数据
    GROUP BY week  -- 按周分组
    ORDER BY week;  -- 按周排序
"""

# 执行查询并读取数据
df = pd.read_sql_query(query, conn)
conn.close()

# 将数据转换为 pandas DataFrame 并进行处理
df['week'] = pd.to_datetime(df['week'] + '-1', format='%Y-%W-%w')

# 绘制折线图
plt.figure(figsize=(10, 6))
plt.plot(df['week'], df['visits'], marker='o')
plt.title('Weekly Visits')
plt.xlabel('Week')
plt.ylabel('Number of Visits')
plt.grid(True)
plt.xticks(rotation=45)
plt.tight_layout()
plt.show()
