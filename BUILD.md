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

#### PostgreSQL 依赖

当前项目依赖 PostgreSQL 数据库。打包后的 exe 仍需要：
1. 本机安装 PostgreSQL
2. 配置 `.env` 文件中的数据库连接信息

如果希望完全独立运行（不依赖外部数据库），需要：
1. 将用户认证模块改为使用 SQLite
2. 或者完全移除用户认证功能

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

# 数据库配置
POSTGRES_SERVER=localhost
POSTGRES_PORT=5432
POSTGRES_DB=app
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password

# 其他配置
FIRST_SUPERUSER=admin@example.com
FIRST_SUPERUSER_PASSWORD=changethis
```

## 简化打包（移除 PostgreSQL 依赖）

如果想要完全独立的 exe（不依赖 PostgreSQL），需要修改代码：

### 方案 1：移除用户认证

1. 删除 `backend/app/models.py` 中的用户相关模型
2. 删除 `backend/app/api/routes/` 中的用户相关路由
3. 修改 `backend/app/core/config.py`，移除 PostgreSQL 配置
4. 修改 `backend/app/main.py`，移除数据库初始化

### 方案 2：用户认证改用 SQLite

1. 修改 `backend/app/core/config.py`，将 PostgreSQL 连接改为 SQLite
2. 更新 Alembic 迁移脚本
3. 重新生成数据库

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
