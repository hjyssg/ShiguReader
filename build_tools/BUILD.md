# 打包说明

## 打包成 EXE

### 前提条件

1. Python 3.10+
2. Node.js 18+
3. 已安装项目依赖

### 打包步骤

```bash
# 在项目根目录执行
python build_tools/build_exe.py
```

打包脚本会自动：
- 构建前端（React/Vite）
- 使用 PyInstaller 打包 EXE 启动器
- 将后端代码 + 前端静态文件打包进 exe
- 生成单个可执行文件
- 若 `frontend` 存在历史 TS 报错，会使用 `build:exe`（仅 vite build）避免阻断打包

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
1. 启动后端服务器（默认端口 `127.0.0.1:8000`）
2. 后端同时托管前端静态文件
3. 自动打开浏览器访问 `http://127.0.0.1:8000`

### 注意事项

#### Windows Defender 误报说明

为降低被 Defender 误报为病毒的概率，打包脚本已默认关闭 PyInstaller 的 `upx` 压缩。

如需进一步降低误报，建议：
- 使用代码签名证书对 `ShiguReader.exe` 进行签名
- 避免频繁修改 exe 文件名和版本号
- 通过稳定渠道分发同一签名版本

#### 数据库

项目使用 SQLite 数据库，无需安装额外的数据库服务。打包后的 exe 完全独立运行。

#### 数据目录

打包后的应用会在以下位置创建数据：
- `dist/data/index.db` - SQLite 索引数据库
- `dist/data/user.db` - 用户数据库
- `dist/data/thumb_cache/` - 缩略图缓存
- `dist/data/extract_cache/` - 压缩包解压缓存

现在默认配置即为“所有运行数据放在 `dist/data`”。

#### 配置文件

可选在 exe 同目录下创建 `.env` 文件覆盖默认配置（打包脚本会自动生成一份 EXE 专用模板）：
```env
# 文件系统根目录（逗号分隔）
FS_ROOTS=D:/_TEMP_DOWNLOADS/_,E:/_Happy_Picture

# 收藏目录
FAVORITE_DIR=E:\_Happy_Lesson\_Going_to_sort

# 可选用户配置（默认已内置）
FIRST_SUPERUSER=admin@example.com
FIRST_SUPERUSER_PASSWORD=changethis

# SQLite（全部放在 dist/data）
INDEX_SQLITE_URL=sqlite:///./data/index.db
USER_SQLITE_URL=sqlite:///./data/user.db
THUMB_CACHE_DIR=./data/thumb_cache

# PostgreSQL 配置（已禁用，项目使用 SQLite）
# POSTGRES_SERVER=localhost
# POSTGRES_PORT=5432
# POSTGRES_DB=app
# POSTGRES_USER=postgres
# POSTGRES_PASSWORD=your_password
```

说明：
- `dist/` 是最终交付目录（`ShiguReader.exe` 所在目录）。
- 打包后会自动生成 `dist/.env`（来源：`build_tools/.env.exe`）。
- 若不放 `.env`，应用会使用内置默认值启动。

## 数据库说明

项目已从 PostgreSQL 迁移到 SQLite，使用两个 SQLite 数据库：
- `data/user.db` - 用户认证数据
- `data/index.db` - 索引数据

打包后的 exe 完全独立，无需安装额外的数据库服务。

## VS Code 中运行

- 任务：
  - `Build EXE`
  - `Run EXE`
  - `Package Dist ZIP`
- 调试配置：
  - `Build Tools: Build EXE`
  - `Build Tools: Run EXE`
  - `Build Tools: Package Dist ZIP`

## 一键打包分发 ZIP

如果你想一次命令直接产出“可发给别人”的压缩包：

```bash
python build_tools/package_dist.py
```

此脚本会：
1. 先执行 `python build_tools/build_exe.py`
2. 再把整个 `dist/` 打包为 `release/ShiguReader-dist-<时间戳>.zip`
3. 打包时自动排除 `dist/data` 下已有真实数据，仅保留空目录结构（防止隐私泄露）

对外分发建议：
- 把 `release/` 下最新 zip 发给使用者
- 使用者解压后双击 `ShiguReader.exe` 即可运行

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
