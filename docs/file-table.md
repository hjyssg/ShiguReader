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
- `GET /fs/file` / `GET /fs/download` — 读取/下载文件时，若文件不存在（404），通过 ReconcileQueue 异步标记 missing

### 重置为 present (0)
- `upsertFile` — 任何时候发现文件存在（listDir/scan），自动重置为 0
- `GET /fs/file` / `GET /fs/download` — 成功读取文件时，通过 ReconcileQueue 异步重置为 0

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

---

## Disk I/O 最小化设计

### 背景

原来的问题：
- 多个接口重复做文件存在性检查，结果没有沉淀到 DB
- 读取 archive 内容后，DB 里的 archive 元数据（图片数、视频数等）仍可能是旧的
- 缩略图生成后没有把路径写回 DB，下次还要重新判断

目标：**把"顺手可得"的信息一次性写入 DB，减少未来重复 I/O。**

---

### Phase 1 — 浏览文件夹时顺手标记消失的文件

**触发点**：`GET /fs/list`（浏览文件夹）

**行为**：
- 读取磁盘上的文件列表后，在后台异步对比 DB 记录
- DB 里有、磁盘上没有的文件 → 标记 `is_missing = 1`
- 这样不需要等全量扫描，日常浏览就能持续修正 missing 状态

**涉及代码**：`fs.ts` → `listDirectory` 的 `setImmediate` 后台块，补调 `markMissingInFolder`

---

### Phase 2 — 补全缩略图时把路径存进 DB

**触发点**：`POST /fs/backfill`（补全操作）

**行为**：
- backfill 会为 archive/video/image 文件生成缩略图
- 原来生成完就丢弃了路径，改为：生成成功后立刻把缩略图路径写入 `files.thumbnail_filepath`
- 下次浏览文件夹时直接从 DB 拿路径，不需要重新判断

**涉及代码**：`fs.ts` → `backfill` 函数，`getOrGenerateThumb` 成功后调 `updateFileThumbnail`

---

### Phase 3 — 读取/下载文件时顺手更新文件存在状态

**触发点**：`GET /fs/file`（读文件内容）、`GET /fs/download`（下载文件）

**行为**：
- 成功读到文件 → 异步把 `is_missing` 改成 0，更新 `last_seen_at`
- 文件不存在（404）→ 异步把 `is_missing` 改成 1
- 为避免热路径频繁写 DB，同一个文件 30 秒内只写一次（TTL 去重）
- 多个文件攒一批（最多 200ms 窗口）再一起写 DB

**新增模块**：`services/reconcileQueue.ts` — 统一的异步校准队列

#### ReconcileQueue 机制

```
enqueue(filepath, exists: boolean)
  → 同 key 去重（30s TTL）
  → 200ms 后批量 flush 到 DB（事务内 UPDATE）
```

事件类型：
- `FILE_PRESENCE_OBSERVED` → 更新 `is_missing`、`last_seen_at`

---

### Phase 4 — 打开 archive 时顺手更新元数据 + 缩略图

**触发点**：`GET /fs/archive/list`（查看 archive 内容列表）、`POST /fs/archive/extract`（翻页/解压）

**行为**：
1. 读取 archive 条目列表后，统计图片数、视频数、音频数、封面条目（第一张图片）
2. 用 `mtime + filesize` 拼成版本签名（`version_sig`），与 DB 里的签名对比
3. 签名不一致（文件有变化）→ 异步更新 `archive_meta` 表
4. 如果 `files.thumbnail_filepath` 为空 → 顺手生成缩略图并写入 DB

**archive_meta 表新增字段**：

| 字段 | 类型 | 含义 |
|------|------|------|
| `version_sig` | TEXT | `mtime:size` 拼接，用于判断文件是否变化 |
| `cover_entry` | TEXT | archive 内第一张图片的路径（用于生成缩略图） |
| `index_status` | TEXT | `fresh`/`stale`/`indexing`/`failed`，当前索引状态 |

**涉及代码**：
- `schema.sql` — `archive_meta` 表加三个字段
- `repository.ts` — `upsertArchiveMeta` 加 `version_sig`、`cover_entry` 参数；加 `getArchiveVersionSig` 快速查询
- `fs.ts` — `listArchive` 和 `extractArchive` handler 里，拿到 entries 后异步回写

---

### 设计原则

- **主流程不阻塞**：所有 DB 回写都在 `setImmediate` 或 ReconcileQueue 里异步执行，不影响接口响应时间
- **只在状态变化时写**：`is_missing` 仅在状态与 DB 不一致时更新；`archive_meta` 仅在 `version_sig` 变化时更新
- **最终一致**：DB 状态可能滞后几十~几百毫秒，这是可接受的
