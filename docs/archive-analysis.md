# Archive 处理分析

## 支持的格式

`.zip` `.cbz` `.rar` `.cbr` `.7z` `.tar` `.tar.gz` `.tgz`

统一通过 **7z CLI** 处理，无格式分支逻辑。工具路径：`tools/7zip-lite/7z.exe` → fallback `PATH`。

---

## 几大任务

| 任务 | 入口 | 核心操作 |
|------|------|----------|
| **列出内容** | `GET /archive/list` | `listEntries()` → `7z l -ba -slt` 解析 Path/Size |
| **分步解压（阅读）** | `POST /archive/extract` | `stepwiseExtract()` → 3 阶段提取到 extract_cache |
| **生成缩略图** | `GET /thumbnail` | `generateArchiveThumb()` → `7z e` 提取首图 → magick 缩放 |
| **压缩图片** | `POST /archive/compress-images` | 全量解压 → magick 缩放 → 重新打包 zip |
| **Backfill 元数据** | `POST /backfill` | `listEntries()` → 统计 image/video/audio 数量写 DB + `getOrGenerateThumb()` 生成缩略图 |
| **解压到目录** | `POST /unzip` | 直接 `7z x` 全量解压 |

---

## 共用的函数 / 模式

### `archiveService.ts` 中的共享函数

```
listEntries(archivePath)
  ├── 被 listArchive (路由)
  ├── 被 stepwiseExtract (阅读)
  ├── 被 backfill (元数据回填)
  └── 被 _backfillArchiveMeta (后台元数据更新)

extractEntries(archivePath, destDir, entries[])
  └── 被 stepwiseExtract 的三个阶段全部调用

getExtractCacheDir(archivePath)
  ├── 被 stepwiseExtract (确定解压目标目录)
  ├── 被 getArchiveFile (定位已解压文件)
  └── 被 clearExtractCache (清理时跳过活跃目录)

calcAvgImageSize(entries)
  ├── 被 stepwiseExtract (返回给前端)
  └── 被 _backfillArchiveMeta (写入 DB)
```

### 工具路径解析

统一提取到 `utils/tools.ts`，导出 `get7z()` / `getMagick()` / `getFfmpeg()`。
`archiveService.ts`、`thumbService.ts`、`routes/fs.ts` 均从此处 import，不再各自实现。

### 后台异步模式（`setImmediate`）

所有耗时操作都用 `setImmediate` 异步执行，不阻塞 HTTP 响应：
- `listDirectory` → 后台 upsertFile + parseName
- `extractArchive` → 后台检查版本签名 + 生成缩略图
- `scanDirectory` → 整个 walk 都在后台
- `_backfillArchiveMeta` → 写 DB + 生成缩略图

### 并发限制（`pLimit`）

| 限制器 | 位置 | 用途 |
|--------|------|------|
| `extractLimit` | `archiveService.ts` | 限制同时解压数量（`EXTRACT_CONCURRENCY`）|
| `thumbLimit` | `thumbService.ts` | 限制同时生成缩略图数量（`THUMB_CONCURRENCY`）|

---

## 数据流（阅读场景）

```
前端请求 /archive/extract?path=xxx&page=5
  │
  ├─ stepwiseExtract()
  │    ├─ listEntries() → 7z l -slt → 解析所有 entry
  │    ├─ Phase 1 (同步): 提取 page±2 → extractEntries()
  │    └─ Phase 2/3 (后台): 提取 ±10 → 剩余全部
  │
  └─ 前端 GET /archive/file?path=xxx&entry=yyy
       └─ 直接读 extract_cache/{hash}/{entry_path}
```

---

## 注意点

- `ArchiveEntry` 有两个 deprecated 字段（`path`、`type`），新代码用 `entry_path` 和 `file_type`
- `inProgress` Set 防止同一 archive 重复触发解压，但进程重启后会丢失状态
- 缩略图生成用 `7z e`（flat 提取），不保留目录结构；正式解压用 `7z x`（保留结构）
