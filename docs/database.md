# ShiguReader 数据库说明

本文档介绍项目当前使用的数据库拆分、各库职责、核心表结构以及迁移方式，方便开发者快速定位数据问题。

## 1. 数据库总体架构

ShiguReader 目前采用 **双 SQLite 库**：

- **用户库（user.db）**：保存账号与鉴权相关数据。
- **索引库（index.db）**：保存本地文件索引、元信息、标签、作者、进度与活动数据。

配置项在 `backend/app/core/config.py`：

- `USER_SQLITE_URL`：默认 `sqlite:///../data/user.db`
- `INDEX_SQLITE_URL`：默认 `sqlite:///../data/index.db`
- `SQLALCHEMY_DATABASE_URI`：当前返回 `USER_SQLITE_URL`

## 2. 用户库（user.db）

### 2.1 作用

用户库由 `backend/app/core/db.py` 初始化连接，核心用于账号系统（登录、注册、超级管理员初始化）。

> 当前项目实际上**还没有启用完整的用户功能链路**，`user.db` 主要是从 FastAPI 模版继承下来的基础能力（例如 `User` 模型与初始化逻辑）。现阶段它属于“保留未启用”状态，先保留以降低后续接回用户系统的改造成本。

### 2.2 当前状态（未启用）

`backend/app/models.py` 中确实定义了 `user` 表（含 `id/email/hashed_password/is_active/is_superuser/full_name/created_at` 等字段），但**当前业务流程并未实际使用这套用户数据**。

可以把它理解为：

- 模板带入的预留结构；
- 目前未接入真实用户功能；
- 暂时保留，后续若要上线账号体系可复用。

### 2.3 迁移位置

用户库 Alembic 迁移位于：`backend/app/alembic/versions/`。

## 3. 索引库（index.db）

### 3.1 作用

索引库用于本地媒体检索与展示，不和用户鉴权数据混在一起。代码位于 `backend/app/index_db/`，连接和会话管理在 `backend/app/index_db/db.py`。

该模块对 SQLite 做了专门优化：

- 自动创建数据库父目录
- 开启 `foreign_keys=ON`
- 使用 `WAL` + `busy_timeout` 降低锁冲突
- 写入时通过 `index_write_guard()` 串行化，提升稳定性

### 3.2 核心表分层

主要模型定义在 `backend/app/index_db/models.py`：

1. **文件系统索引层**
   - `folders`：目录记录（路径、状态、扫描时间）
   - `files`：文件主表（类型、大小、mtime、指纹、缩略图、推荐分数等）

2. **媒体元信息层**
   - `archive_meta`：压缩包统计（条目数、图/视/音数量）
   - `video_meta`：视频技术参数（时长、分辨率、codec、音轨等）
   - `parsed_metadata`：从文件名解析出的标题/社团/活动等结构化信息

3. **组织与标注层**
   - `tags` / `file_tags`
   - `artists` / `file_artists`

4. **行为与历史层**
   - `progress`：阅读/播放进度与最近打开信息
   - `folder_open_history`：目录打开次数和最近访问时间
   - `activity_logs`：首页活动日志

### 3.3 表关系要点

- `files.folderpath -> folders.filepath`
- `archive_meta/video_meta/parsed_metadata.filepath -> files.filepath`
- `file_tags.filepath -> files.filepath`，`file_tags.tag_name -> tags.tag_name`
- `file_artists.filepath -> files.filepath`，`file_artists.artist_name -> artists.artist_name`

多数明细表以 `filepath` 对 `files` 建外键，便于级联删除和数据收敛。

### 3.4 迁移演进（索引库）

索引库 Alembic 位于：`backend/app/index_db/alembic/versions/`。

当前迁移链路（按时间）大致为：

1. `20260213_0001_init_index_schema.py`：初始化基础表（folders/files/meta/progress/tag/artist）
2. `20260213_0002_add_parsed_metadata.py`：新增 `parsed_metadata`
3. `20260213_0002_progress_history_retention.py`（revision `20260213_0003`）：调整 `progress` 为历史保留友好结构
4. `20260215_0001_add_rec_score_to_files.py`：为 `files` 增加 `rec_score`
5. `20260215_0002_add_performance_indexes.py`：新增性能索引
6. `20260217_0001_add_home_activity_tables.py`：新增 `folder_open_history` 与 `activity_logs`

## 4. 初始化与迁移建议

- 应用启动会自动确保索引库迁移到最新版本（见 backend README 的 Index DB 说明）。
- 如果你改了索引模型，建议同步新增 Alembic migration，避免环境间 schema 漂移。
- 本地排查问题时，先确认 `.env` 中两个 SQLite URL 指向位置，防止“连错库”。

## 5. 快速排查清单

- 看不到文件：先查 `files.scan_state/watch_state` 与 `folders` 对应状态。
- 标签/作者丢失：检查 `file_tags` / `file_artists` 外键目标是否仍存在。
- 进度异常：核对 `progress` 中 `last_opened_at/updated_at/position_sec/page_current`。
- 性能抖动：确认 SQLite PRAGMA（WAL、busy_timeout）是否生效，以及索引迁移是否执行到最新。

## 6. 当 Tag / Author / Coser 算法变更后，如何全量重建

如果你改了文件名解析算法，希望历史数据按新规则重算，建议按下面流程做“清空 + 重扫”：

1. 停掉后端服务（避免扫描过程中同时写库）。
2. 清空解析与关联数据（保留 `files/folders` 索引主数据）。
3. 启动后端后，对需要的根目录执行 `/api/v1/fs/scan` 全量扫描。

示例（默认库路径 `../data/index.db`）：

```bash
sqlite3 ../data/index.db <<'SQL'
PRAGMA foreign_keys=ON;
BEGIN;
DELETE FROM file_tags;
DELETE FROM file_artists;
DELETE FROM parsed_metadata;
DELETE FROM tags;
DELETE FROM artists;
COMMIT;
SQL
```

然后逐个目录触发重扫（示例）：

```bash
curl -X POST http://127.0.0.1:8000/api/v1/fs/scan \
  -H 'Content-Type: application/json' \
  -d '{"path":"/你的媒体根目录","recursive":true}'
```

说明：

- 之所以需要先清空，是因为当前批量写入逻辑会“增量补齐”，不会自动删除旧算法留下的多余 tag/artist 关联。
- 如果你有多个 FS root，就对每个 root 都触发一次 `scan`。
