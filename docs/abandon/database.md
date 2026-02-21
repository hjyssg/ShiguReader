# ShiguReader 数据库简述

## 1) user.db（当前未使用）

`user.db` 来自 FastAPI 模板，当前项目没有启用完整用户功能链路，所以这部分数据目前不参与实际业务流程。

- 配置项：`USER_SQLITE_URL`
- 代码位置：`backend/app/models.py`、`backend/app/core/db.py`
- 现状：保留未启用，后续如果要接账号体系可复用

---

## 2) index.db 表结构（当前主用）

`index.db` 是当前实际在用的业务库，主要在 `backend/app/index_db/models.py`。

### 核心表

- 资源主表
  - `folders`：目录索引
  - `files`：文件索引（类型、大小、mtime、指纹、缩略图、推荐分）

- 元数据表
  - `archive_meta`：压缩包内容统计
  - `video_meta`：视频技术信息
  - `parsed_metadata`：文件名解析结果（标题、社团、活动等）

- 标注与人物
  - `tags` / `file_tags`
  - `artists` / `file_artists`（含 `role`，可区分 author/coser）

- 历史与行为
  - `progress`：阅读/播放进度
  - `folder_open_history`：目录打开历史
  - `activity_logs`：活动日志

---

## 3) 主要表关系

- `files.folderpath -> folders.filepath`
- `archive_meta.filepath -> files.filepath`
- `video_meta.filepath -> files.filepath`
- `parsed_metadata.filepath -> files.filepath`
- `file_tags.filepath -> files.filepath`，`file_tags.tag_name -> tags.tag_name`
- `file_artists.filepath -> files.filepath`，`file_artists.artist_name -> artists.artist_name`

整体上以 `files` 为中心，标签/作者/coser等信息通过关联表挂载到文件。

---

## 4) 迁移机制（Migration）

- 用户库迁移目录：`backend/app/alembic/versions/`
- 索引库迁移目录：`backend/app/index_db/alembic/versions/`
- 索引库启动时会自动迁移到最新版本（见 `backend/README.md` 的 Index DB 说明）

建议：改了 `index_db/models.py` 后同步补 Alembic migration，避免各环境 schema 不一致。
