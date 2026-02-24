# Archive Extract IO 优化方案

## 问题

打开压缩包时前端同时发送两个请求：
- `GET /api/v1/fs/archive/extract` → 后端调用 `listEntries`（`7z l`）+ `7z x`
- `GET /api/v1/fs/archive/list` → 后端再次调用 `listEntries`（`7z l`）

导致同一个压缩包的 `7z l` 被执行两次，浪费磁盘 IO。

## 方案

### 后端

1. **`archiveService.ts`：`listEntries` 加内存缓存（TTL 60s）**
   - `entriesCache: Map<string, { entries, expireAt }>` 模块级变量
   - 命中缓存直接返回，不跑 `7z l`
   - 缓存 key = archivePath，过期时间 = 调用时刻 + 60000ms

2. **`StepwiseExtractResult` 加 `entries` 字段**
   - `started` / `already_running` / `completed` 三个分支都返回 entries
   - 因为 `listEntries` 有缓存，`already_running` 分支的额外调用几乎零开销

3. **`fsArchive.ts`：`extractArchive` handler 透传 `entries`**

### 前端

4. **`types.gen.ts`：`ExtractStatus` 加 `entries?: Array<ArchiveEntry>`**

5. **`useArchiveExtract.ts`：移除 `listArchive` 并发调用**
   - 删除 `listData` state 和 `FilesystemService.listArchive` 调用
   - `imageEntries` / `audioTracks` / `audioCoverUrl` 改为读 `extractStatus?.entries ?? []`

## 效果

- 每次打开压缩包 `7z l` 从 2 次降为 1 次
- 60s 内重复打开同一压缩包 `7z l` 为 0 次（走缓存）
- `already_running` 轮询场景也走缓存，无额外 IO
