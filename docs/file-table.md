# File Table 设计

## 核心原则

File table 是一个**持久化的文件历史记录**，不随文件删除而清空。这样可以保留阅读历史、标签、推荐分数等关联数据。

## is_missing 字段

`files.is_missing` 是唯一的存在性标记：

| 值 | 含义 |
|----|------|
| `0` | 文件在磁盘上存在（或尚未确认） |
| `1` | 文件已确认不存在（被删除/移走） |

## 何时更新 is_missing

### 标记为 missing (1)
- `DELETE /fs/delete` — 用户主动删除文件时，立即标记
- `listDirectory` fire-and-forget — 打开文件夹时，对比 DB 记录与实际 FS，不在 FS 里的标记 missing
- `scanDirectory` — 全量扫描完一个目录后，同样做对比标记

### 重置为 present (0)
- `upsertFile` — 任何时候发现文件存在（listDir/scan），自动重置为 0

## rename / move 时同步 DB

文件路径是主键，rename/move 需要同步更新所有相关表：

| 操作 | DB 动作 |
|------|---------|
| `rename` / `move file` | `relocateFile(oldPath, newPath)` — 事务内更新所有表的 filepath |
| `move folder` | `relocateFolder(oldPrefix, newPrefix)` — 批量替换路径前缀 |

涉及的表：`files`, `archive_meta`, `video_meta`, `progress`, `parsed_metadata`, `file_tags`, `file_artists`

## Search 的 presence_filter

| 选项 | 行为 |
|------|------|
| `present` (默认) | `is_missing = 0` — 只返回存在的文件 |
| `all` | 不过滤，包含已删除文件的历史记录 |
| `recent` | `is_missing = 0 AND last_seen_at >= now - 10min` |

## 删除的字段

以下字段已从 `files` 表移除，原因是冗余或未被使用：

| 字段 | 原因 |
|------|------|
| `scan_state` | 语义不清，被 `is_missing` 替代 |
| `watch_state` | 从未被正确写入，watch 状态由内存 Map 管理 |
| `fingerprint` | path+mtime+size 的组合，这三个字段本身已在表中 |
| `content_hash` | 从未被写入，死代码 |
| `first_seen_at` | 等同于 `created_at` |
| `last_scanned_at` | 等同于 `last_seen_at` |
