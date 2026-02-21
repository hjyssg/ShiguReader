# Archive 解压 & 列表修复进度

## 问题根因

前端显示"无图片"，实际是三处 API 不匹配：

| # | 问题 | 位置 |
|---|------|------|
| 1 | `extractArchive` 从 `req.body` 读参数，但前端 SDK 发 POST+query string | `routes/fs.ts` |
| 2 | `listEntries` 返回 `path`/`type` 字段，前端期望 `entry_path`/`file_type`/`name` | `services/archiveService.ts` |
| 3 | `listArchive` 响应缺少 `total` 字段 | `routes/fs.ts` |
| 4 | `parseSingle` 读 `req.query.filename`，前端传 `filepath` | `routes/parse.ts` |

## 修复记录

### [x] Fix 1 — extractArchive 参数来源
- 文件：`backendnode/src/routes/fs.ts`
- 改动：handler 签名从 `Body: { path, page }` 改为 `Querystring: { path, page?: string }`

### [x] Fix 2 — ArchiveEntry 字段名
- 文件：`backendnode/src/services/archiveService.ts`
- 改动：`listEntries` 返回对象新增 `name`、`entry_path`、`file_type`，保留旧字段 `path`/`type` 作为 deprecated compat

### [x] Fix 3 — listArchive 补 total
- 文件：`backendnode/src/routes/fs.ts`
- 改动：`reply.send({ entries, total: entries.length })`

### [x] Fix 4 — parse 参数名
- 文件：`backendnode/src/routes/parse.ts`
- 改动：同时接受 `filepath`（优先）和 `filename`

## 单元测试

文件：`backendnode/tests/services/archiveService.test.ts`

### 运行结果（2026-02-21）

```
✓ tests/services/archiveService.test.ts (15 tests) 18ms
  ✓ listEntries > returns image entries with correct fields
  ✓ listEntries > filters out non-media files
  ✓ listEntries > filters out __MACOSX and .DS_Store entries
  ✓ listEntries > sorts entries naturally (numeric order)
  ✓ listEntries > assigns sequential index starting from 0
  ✓ listEntries > returns empty array when archive has no media files
  ✓ listEntries > correctly identifies video and audio types
  ✓ listEntries > throws when 7z command fails
  ✓ getExtractCacheDir > returns a deterministic path for the same input
  ✓ getExtractCacheDir > returns different paths for different archives
  ✓ getExtractCacheDir > cache dir is under EXTRACT_CACHE_DIR
  ✓ extractEntries > does nothing when entries list is empty
  ✓ extractEntries > calls 7z x with list file for non-empty entries
  ✓ extractEntries > creates dest directory before extracting
  ✓ extractEntries > cleans up temp list file even on error

Tests  15 passed (15)
```

**全部通过 ✅**

## 数据流（修复后）

```
前端 read.tsx
  → POST /api/v1/fs/archive/extract?path=...&page=0
      ↓ stepwiseExtract → 7z x → cache_dir
  → GET /api/v1/fs/archive/list?path=...
      ↓ listEntries → [{ name, entry_path, file_type, index }]
  → 前端过滤 e.file_type === "image"  ✅ 字段匹配
  → GET /api/v1/fs/archive/file?path=...&entry=<entry_path>
      ↓ 从 cache_dir 读取文件流
```
