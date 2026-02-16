# Name Parser - Coser名单数据库

用于coser图片name parsing和人名标准化的数据库模块。

## 功能特性

- 🗄️ SQLite数据库存储coser主名字和别名
- 🔍 高效的名字查找和别名匹配
- 🛠️ CLI工具用于维护和查询
- 🔗 自动集成到文件名解析器
- 🔒 使用`.idx`扩展名保护隐私

## 文件说明

| 文件 | 说明 |
|------|------|
| `coser_db.py` | 数据库操作核心模块 |
| `build_coser_db.py` | CLI构建和维护工具 |
| `coser_names.idx` | SQLite数据库文件（不提交到git） |
| `parser.py` | 文件名解析器（已集成coser查找） |

## 快速开始

### 1. 构建数据库

首次使用需要从整理好的coser文件夹构建数据库：

```bash
cd backend/app/file_processing/name_parser
python build_coser_db.py --rebuild
```

这会扫描`E:\_Happy_Picture\_Sorted_Picture`目录，将所有文件夹名作为coser主名字导入。

### 2. 查询coser

```bash
# 查询单个名字
python build_coser_db.py --query "夏美酱"

# 列出所有coser
python build_coser_db.py --list
```

### 3. 维护数据库

```bash
# 增量更新（扫描新增的文件夹）
python build_coser_db.py --update

# 手动添加别名
python build_coser_db.py --add-alias "夏美酱" "Natsumi"
python build_coser_db.py --add-alias "夏美酱" "なつみ"
```

## 编程使用

### 基本查询

```python
from app.file_processing.name_parser.coser_db import lookup_coser, get_aliases

# 通过主名字或别名查找标准名称
main_name = lookup_coser("Natsumi")  # 返回 "夏美酱"
main_name = lookup_coser("夏美酱")    # 返回 "夏美酱"

# 获取某个coser的所有别名
aliases = get_aliases("夏美酱")  # 返回 ["Natsumi", "なつみ"]
```

### 模糊匹配

```python
from app.file_processing.name_parser.coser_db import fuzzy_match

# 部分名字匹配
results = fuzzy_match("夏美")  # 返回包含"夏美"的所有coser
```

### 批量文本匹配（高效）

如果安装了`pyahocorasick`库，可以使用Aho-Corasick算法进行高效的批量匹配：

```python
from app.file_processing.name_parser.coser_db import find_cosers_in_text

# 从文件名中查找所有匹配的coser
filename = "[夏美酱] Some Title (Natsumi) - Character Name.zip"
cosers = find_cosers_in_text(filename)  # 返回 ["夏美酱"]（自动去重）

# 这比多次调用lookup_coser()要快得多
```

**安装ahocorasick（可选，用于性能优化）：**
```bash
pip install pyahocorasick
```

### 使用数据库对象

```python
from app.file_processing.name_parser.coser_db import CoserDatabase

# 使用上下文管理器
with CoserDatabase() as db:
    result = db.lookup_coser("test")
    aliases = db.get_aliases("夏美酱")
    all_cosers = db.get_all_cosers()
```

## 自动集成

当使用后端API扫描包含coser图片的目录时，`parser.py`的`_parse_cosplay`函数会自动：

1. 从文件名提取coser名字
2. 通过`lookup_coser()`查找标准名称
3. 将标准化的名字存入数据库

这样即使文件名中使用了别名，也会统一为主名字，方便分类和统计。

## 数据库结构

```sql
-- coser表：存储主名字
CREATE TABLE coser (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

-- alias表：存储别名（多对一）
CREATE TABLE alias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coser_id INTEGER NOT NULL,
    alias TEXT NOT NULL,
    FOREIGN KEY (coser_id) REFERENCES coser(id),
    UNIQUE (coser_id, alias)
);
```

## CLI命令参考

```bash
# 重建数据库（删除旧数据）
python build_coser_db.py --rebuild

# 增量更新
python build_coser_db.py --update

# 添加别名
python build_coser_db.py --add-alias <主名字> <别名>

# 查询名字
python build_coser_db.py --query <名字>

# 列出所有coser
python build_coser_db.py --list

# 自定义数据库路径
python build_coser_db.py --db-path /path/to/db.idx --rebuild

# 自定义扫描目录
python build_coser_db.py --sorted-dir /path/to/sorted --rebuild
```

## 隐私保护

- 数据库文件使用`.idx`扩展名（实际是SQLite格式）
- 已添加到`.gitignore`，不会提交到仓库
- 建议定期备份数据库文件到安全位置

## 性能优化

- 数据库查询使用索引优化
- 支持大小写不敏感的快速查找
- 模块级缓存避免重复连接

## 测试

运行单元测试：

```bash
pytest backend/tests/file_processing/name_parser/test_coser_db.py -v
```

## 故障排除

**Q: 数据库文件丢失怎么办？**  
A: 重新运行`python build_coser_db.py --rebuild`即可重建。

**Q: 如何备份数据库？**  
A: 直接复制`coser_names.idx`文件到安全位置。

**Q: 查询返回None？**  
A: 确认数据库文件存在，且名字已导入。使用`--list`查看所有coser。

**Q: 如何批量导入别名？**  
A: 可以直接使用SQLite工具编辑数据库，或编写脚本调用`add_alias`函数。
