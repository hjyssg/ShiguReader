# backendnode 实现计划

对照 `backend/app/api/routes/fs.py`（Python 版本）逐一列出 Node.js 版本的实现状态与待办。

---

## 1. Thumbnail — `GET /api/v1/fs/thumb`

### Python 做了什么
- `ThumbService.get_or_generate(path)` 异步生成缩略图
- archive → `extract_single_to_temp_file` + PIL resize
- video → ffmpeg 截帧
- image → PIL resize
- 文件不存在时通过 DB 按文件名 fallback 查找

### Node.js 当前状态
- ✅ 调用 `getOrGenerateThumb(filePath)` 异步生成
- ✅ video → ffmpeg
- ✅ image → imagemagick
- ✅ archive → 通配符提取（`7z e *.jpg *.jpeg ...`），不依赖 `7z l` 的乱码路径（已修复）
- ✅ 文件不存在时通过 DB `findFilesByFilename` fallback 查找（已实现）

---

## 2. Archive List — `GET /api/v1/fs/archive/list`

### Python 做了什么
- `list_archive_entries(path)` → 返回排序后的条目列表
- 支持 zip / 7z / rar / tar
- 过滤掉 ignore 规则的条目
- 只返回 image/video/audio 类型，带 index

### Node.js 当前状态
- ✅ `src/services/archiveService.ts` — `listEntries(archivePath)`
  - `7z l -ba -slt -scsUTF-8 <archive>` 解析 `Path = ...` 行
  - 过滤 ignore 条目（`.DS_Store`, `__MACOSX`, `Thumbs.db` 等）
  - 返回排序后的 entry 列表（含 index、type）
- ✅ `fs.ts` `listArchive` handler 已实现

---

## 3. Archive Extract — `POST /api/v1/fs/archive/extract`

### Python 做了什么
- 三阶段渐进式解压（`stepwise_extract`）
- cache_dir = `extract_cache/<sha256_hash[:2]>/<sha256_hash[2:]>/`
- 幂等：已在解压中直接返回进度
- 返回 `{ status, extracted_count, total_count, cache_dir }`

### Node.js 当前状态
- ✅ `archiveService.ts` — `extractEntries(archive, destDir, entries[])`
  - 使用 `7z x <archive> -o<dest> -y -scsUTF-8 @<listfile>`（list file 写 UTF-8）
- ✅ `archiveService.ts` — `stepwiseExtract(archive, currentPage)`
  - 阶段1（±2页）同步，阶段2（±10页）/阶段3（剩余，图片优先）setImmediate 后台
- ✅ `archiveService.ts` — `getExtractCacheDir(archivePath)` — sha256 hash 路径
- ✅ `fs.ts` `extractArchive` handler 已实现

---

## 4. Archive File — `GET /api/v1/fs/archive/file`

### Python 做了什么
- 从 `extract_cache/<hash>/` 目录读取已解压文件
- 文件不存在返回 404

### Node.js 当前状态
- ✅ `fs.ts` `getArchiveFile` handler 已实现
  - 计算 cache_dir，拼接 entry 路径
  - 路径安全检查（防止目录穿越）
  - 文件存在则 stream 返回，否则 404

---

## 5. Extract Cache Clear — `DELETE /api/v1/fs/extract-cache`

### Python 做了什么
- 删除 `extract_cache/` 下所有目录（跳过正在解压的）
- 返回 `{ deleted_files, freed_bytes, freed_size_readable }`

### Node.js 当前状态
- ✅ `archiveService.ts` — `clearExtractCache()` 已实现
  - 遍历 extract_cache 目录，统计并删除
  - 跳过正在解压的目录（inProgress set）
  - 返回 `{ deleted_files, freed_bytes, freed_size_readable }`

---

## 6. Unzip — `POST /api/v1/fs/unzip`

### Python 做了什么
- 解压到同名目录（或指定 output_dir）
- 目标目录已存在返回 409

### Node.js 当前状态
- ✅ `fs.ts` `unzip` handler 已实现
  - 使用 `7z x <archive> -o<dest> -y -scsUTF-8`（支持所有格式）
  - 目标目录已存在返回 409

---

## 7. Zip Folder — `POST /api/v1/fs/zip-folder`

### Python 做了什么
- 用 zipfile 打包目录

### Node.js 当前状态
- ✅ `fs.ts` `zipFolder` handler 已实现
  - 使用 `7z a -tzip <output.zip> <folder>/*`
  - 输出文件已存在返回 409

---

## 8. Backfill — `POST /api/v1/fs/backfill`

### Python 做了什么
- 遍历目录下所有文件
- `fill_thumbnail=true` → 调用 ThumbService 生成缩略图
- `fill_meta=true` → 解析文件名 + 统计 archive 内容数量
- 写入 DB

### Node.js 当前状态
- ✅ `fs.ts` `backfill` handler 已实现（fire-and-forget 后台）
  - upsertFile 写入 DB
  - `fill_meta=true` → parseName + saveParsedMetadata
  - archive 文件 → listEntries + upsertArchiveMeta（image/video/audio 计数）
  - ✅ `fill_thumbnail=true` → 调用 `getOrGenerateThumb` 后台生成缩略图

---

## 9. Archive Compress Images — `POST /api/v1/fs/archive/compress-images`

### Python 做了什么
- 解压 zip → 压缩大图（PIL resize + JPEG）→ 重新打包
- 验证输出 zip 完整性

### Node.js 当前状态
- ✅ `archiveService.ts` — `compressArchiveImages()` 已实现
  - 解压全部 → imagemagick 压缩大图 → 7z 重新打包为 `_compressed` 后缀文件
  - ✅ 验证输出 zip 完整性（`7z t` 测试，失败时删除损坏文件并抛出错误）

---

## 10. Scan Watch — `POST /api/v1/fs/scan-watch`

### Python 做了什么
- 启动 watchdog FolderWatcher 监听目录变化
- 同时触发后台扫描

### Node.js 当前状态
- ✅ `fs.ts` `scanWatch` handler 已实现
  - 使用 Node.js `fs.watch({ recursive: true })` 监听目录变化
  - 变化时自动 upsertFile 写入 DB
  - 内存中维护 activeWatchers Map，防止重复监听

---

## 实现优先级（已完成）

| 优先级 | 功能 | 状态 |
|--------|------|------|
| P0 | Thumbnail 7z 修复 | ✅ 完成 |
| P1 | Archive List | ✅ 完成 |
| P1 | Archive Extract | ✅ 完成 |
| P1 | Archive File | ✅ 完成 |
| P2 | Unzip | ✅ 完成 |
| P2 | Extract Cache Clear | ✅ 完成 |
| P2 | Backfill | ✅ 完成（缩略图生成待补充） |
| P3 | Zip Folder | ✅ 完成 |
| P3 | Archive Compress Images | ✅ 完成 |
| P3 | Scan Watch | ✅ 完成 |

---

## 遗留小项（全部完成）

- [x] Thumbnail fallback：文件不存在时通过 DB `findFilesByFilename` 查找（app.ts 已实现）
- [x] Backfill `fill_thumbnail=true`：调用 `getOrGenerateThumb` 生成缩略图
- [x] compressImages：验证输出 zip 完整性（`7z t` 测试，失败时删除损坏文件）

---

## 工具路径约定

```
backend/tools/7zip-lite/7z.exe   ← 7z CLI（列出/提取所有格式）
backend/tools/ffmpeg/ffmpeg.exe  ← 视频截帧
backend/tools/imagemagick/magick.exe ← 图片缩放
```

Node.js 版本统一通过 `resolveTool()` / `get7z()` 查找，找不到 fallback 到 PATH。

---

## 关键差异说明

| 方面 | Python | Node.js |
|------|--------|---------|
| DB | `index.db` (SQLAlchemy) | `index_node.db` (node:sqlite) |
| 7z 列出条目 | py7zr 库（原生，无编码问题） | 7z CLI（`-scsUTF-8` 参数） |
| 图片处理 | PIL/Pillow | imagemagick CLI |
| 视频截帧 | ffmpeg CLI | ffmpeg CLI（相同） |
| 异步 | asyncio + threading | Node.js async/await + child_process |
| 目录监听 | watchdog | Node.js fs.watch |
