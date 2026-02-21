# 开局行为说明

## 启动时做了什么

后端启动（`server.ts`）只做两件事：

1. `initDb(dbPath)` — 初始化 SQLite 数据库（建表，如果不存在）
2. `buildApp()` — 注册所有 HTTP 路由，启动 Fastify 服务器

**不会自动扫描任何文件夹**，包括 `FAVORITE_DIR`、`FS_ROOTS` 等配置的目录。

---

## 扫描是什么时候触发的

### 1. 被动触发（用户浏览目录时）

调用 `GET /api/v1/fs/list?path=<dir>` 时，后端会在返回结果后，通过 `setImmediate` 异步（fire-and-forget）将当前目录的文件 upsert 进数据库：

- `upsertFolder(dirPath)` — 记录该文件夹
- `upsertFile(...)` — 记录目录下每个文件
- `saveParsedMetadata(...)` — 解析文件名中的 author/tag 等信息
- `recordFolderOpen(dirPath)` — 记录文件夹打开历史（用于首页"常用文件夹"统计）

这是**懒加载**模式：只有用户实际打开过的目录才会被索引。

### 2. 主动扫描（用户手动触发）

| 操作 | API | 说明 |
|------|-----|------|
| Explorer 点击 "Scan" | `POST /api/v1/fs/scan` | 递归扫描指定目录，后台异步执行 |
| Explorer 点击 "Scan and Watch" | `POST /api/v1/fs/scan-watch` | 扫描 + 启动 fs.watch 监听文件变化 |
| Explorer 点击 "Backfill" | `POST /api/v1/fs/backfill` | 补全缺失的 thumbnail 和 meta 信息 |
| Admin 页面 "Sync File Table" | `POST /api/v1/fs/sync-file-table` | 遍历所有 FS_ROOTS 并全量同步到数据库 |

### 3. 文件变化监听（Watch 模式）

调用 `scan-watch` 后，后端会用 `fs.watch` 监听目录变化，有新文件时自动 upsert 进数据库。Watch 状态保存在内存中，重启后失效。

---

## FAVORITE_DIR 的特殊说明

`FAVORITE_DIR` 在启动时**不会被自动扫描**。

推荐度算法（`rec_score`）依赖 favorite 目录中的文件数据，因此建议在首次使用时手动对 favorite 目录执行一次 Scan 或 Backfill，确保数据库中有完整的索引。

---

## 配置项说明（.env）

| 变量 | 说明 |
|------|------|
| `FS_ROOTS` | 首页快捷访问目录，逗号分隔，如 `D:/_DOWNLOADS,E:/_Pictures` |
| `FAVORITE_DIR` | 收藏目录，用于推荐度计算和"移动到收藏"功能 |
| `ALREADY_READ_DIR` | 已读目录，用于"移动到已读"功能 |
| `MOVE_PLACE_DIR` | "移动到..."的默认目标目录 |

以上配置均可在 Settings 页面实时修改，修改后会同步写入 `.env` 文件。
