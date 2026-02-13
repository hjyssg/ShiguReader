# 打包说明

## 打包成 EXE

### 前提条件

1. Python 3.10+
2. Node.js 18+
3. 已安装项目依赖

### 打包步骤

```bash
# 1. 安装 PyInstaller
pip install pyinstaller

# 2. 运行打包脚本
python build_exe.py
```

打包脚本会自动：
- 构建前端（React/Vite）
- 使用 PyInstaller 打包后端
- 将前端静态文件打包进 exe
- 生成单个可执行文件

### 输出

打包完成后，可执行文件位于：
```
dist/ShiguReader.exe
```

### 运行

```bash
# 直接运行
dist/ShiguReader.exe

# 或双击 ShiguReader.exe
```

应用会自动：
1. 启动后端服务器（默认端口 8000）
2. 打开浏览器访问 http://localhost:8000

### 注意事项

#### 数据库

项目使用 SQLite 数据库，无需安装额外的数据库服务。打包后的 exe 完全独立运行。

#### 数据目录

打包后的应用会在以下位置创建数据：
- `data/index.db` - SQLite 索引数据库
- `data/thumb_cache/` - 缩略图缓存
- `data/extract_cache/` - 压缩包解压缓存

建议将 `data/` 目录与 exe 放在同一目录下。

#### 配置文件

需要在 exe 同目录下创建 `.env` 文件，配置：
```env
# 文件系统根目录（逗号分隔）
FS_ROOTS=D:/_TEMP_DOWNLOADS/_,E:/_Happy_Picture

# 收藏目录
FAVORITE_DIR=E:\_Happy_Lesson\_Going_to_sort

# 用户配置
FIRST_SUPERUSER=admin@example.com
FIRST_SUPERUSER_PASSWORD=changethis

# PostgreSQL 配置（已禁用，项目使用 SQLite）
# POSTGRES_SERVER=localhost
# POSTGRES_PORT=5432
# POSTGRES_DB=app
# POSTGRES_USER=postgres
# POSTGRES_PASSWORD=your_password
```

## 数据库说明

项目已从 PostgreSQL 迁移到 SQLite，使用两个 SQLite 数据库：
- `data/user.db` - 用户认证数据
- `data/index.db` - 索引数据

打包后的 exe 完全独立，无需安装额外的数据库服务。

## 开发模式运行

```bash
# 后端
cd backend
uvicorn app.main:app --reload

# 前端
cd frontend
npm run dev
```

## 生产模式运行

```bash
# 构建前端
cd frontend
npm run build

# 运行后端（会自动 serve 前端）
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
