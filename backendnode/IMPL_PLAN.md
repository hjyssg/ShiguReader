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
- ❌ archive → 7z 列出条目时 Windows 日文路径编码乱码，导致提取失败
- ❌ 文件不存在时无 DB fallback

### 待修复
- [ ] `thumbService.ts` archive 分支：改用通配符提取（`7z e *.jpg *.jpeg ...`），不依赖 `7z l` 的乱码路径
- [ ] 文件不存在时通过 DB `find_files_by_filename` fallback（低优先级）

---

## 2. Archive List — `GET /api/v1/fs/archive/list`

### Python 做了什么
- `list_archive_entries(path)` → 返回排序后的条目列表
- 支持 zip / 7z / rar / tar（py7zr / rarfile / zipfile / tarfile）
- 失败时 fallback 到 `7z e *` 提取后扫描文件
- 过滤掉 ignore 规则的条目
- 只返回 image/video/audio 类型，带 index

### Node.js 当前状态
- ❌ 返回 `{ entries: [], message: "Archive listing not yet implemented" }`

### 待实现
- [ ] `src/services/archiveService.ts` — 封装 7z CLI 列出条目
  - `7z l -ba -slt -scsUTF-8 <archive>` 解析 `Path = ...` 行
  - 对 zip 可用 Node.js 原生（`yauzl` 或直接 7z）
  - 过滤 ignore 条目（`.DS_Store`, `__MACOSX`, `Thumbs.db` 等）
  - 返回排序后的 entry 列表
- [ ] 更新 `fs.ts` `listArchive` handler 调用 archiveService

---

## 3. Archive Extract — `POST /api/v1/fs/archive/extract`

### Python 做了什么
- 三阶段渐进式解压（`stepwise_extract`）：
  - 阶段1：当前页（同步，立即可用）
  - 阶段2：前后 ±5 页（后台）
  - 阶段3：剩余文件（后台，图片优先）
- cache_dir = `extract_cache/<sha256_hash[:2]>/<sha256_hash[2:]>/`
- 幂等：已在解压中直接返回进度
- 返回 `{ status, extracted_count, total_count, cache_dir }`

### Node.js 当前状态
- ❌ 返回 `{ status: "not_implemented" }`

### 待实现
- [ ] `src/services/archiveService.ts` — `extractEntries(archive, destDir, entries[])`
  - 使用 `7z x <archive> -o<dest> -y -scsUTF-8 @<listfile>` （list file 写 UTF-8）
  - 支持 zip / 7z / rar
- [ ] `src/services/archiveService.ts` — `stepwiseExtract(archive, cacheDir, currentPage, secondary)`
  - 阶段1同步，阶段2/3 setImmediate 后台
- [ ] `src/services/archiveService.ts` — `getExtractCacheDir(archivePath)` — sha256 hash 路径
- [ ] 更新 `fs.ts` `extractArchive` handler

---

## 4. Archive File — `GET /api/v1/fs/archive/file`

### Python 做了什么
- 从 `extract_cache/<hash>/` 目录读取已解压文件
- 文件不存在返回 404

### Node.js 当前状态
- ❌ 返回 501

### 待实现
- [ ] 更新 `fs.ts` `getArchiveFile` handler：
  - 计算 cache_dir
  - 拼接 `cache_dir / entry`
  - 文件存在则 stream 返回，否则 404

---

## 5. Extract Cache Clear — `DELETE /api/v1/fs/extract-cache`

### Python 做了什么
- 删除 `extract_cache/` 下所有目录（跳过正在解压的）
- 返回 `{ deleted_files, freed_bytes, freed_size_readable }`

### Node.js 当前状态
- ❌ 返回 `{ status: "ok", cleared: 0 }`（假实现）

### 待实现
- [ ] 实现真正的清理逻辑（遍历 extract_cache 目录，统计并删除）

---

## 6. Unzip — `POST /api/v1/fs/unzip`

### Python 做了什么
- 解压到同名目录（或指定 output_dir）
- 只支持 zip（用 zipfile.extractall）
- 目标目录已存在返回 409

### Node.js 当前状态
- ❌ 返回 `{ status: "not_implemented" }`

### 待实现
- [ ] 使用 `7z x <archive> -o<dest> -y -scsUTF-8` 实现（支持所有格式）

---

## 7. Zip Folder — `POST /api/v1/fs/zip-folder`

### Python 做了什么
- 用 zipfile 打包目录
- 跳过 ignore 文件、symlink、reparse point

### Node.js 当前状态
- ❌ 返回 `{ status: "not_implemented" }`

### 待实现
- [ ] 使用 `7z a <output.zip> <folder>/*` 实现

---

## 8. Backfill — `POST /api/v1/fs/backfill`

### Python 做了什么
- 遍历目录下所有文件
- `fill_thumbnail=true` → 调用 ThumbService 生成缩略图
- `fill_meta=true` → 解析文件名 + 统计 archive 内容数量
- 写入 DB

### Node.js 当前状态
- ❌ 返回 `{ status: "not_implemented" }`

### 待实现
- [ ] 实现 backfill handler（依赖 archiveService.listEntries）

---

## 9. Archive Compress Images — `POST /api/v1/fs/archive/compress-images`

### Python 做了什么
- 解压 zip → 压缩大图（PIL resize + JPEG）→ 重新打包
- 验证输出 zip 完整性

### Node.js 当前状态
- ❌ 返回 `{ status: "not_implemented" }`

### 待实现（低优先级）
- [ ] 依赖 imagemagick + 7z，实现图片压缩重打包

---

## 10. Scan Watch — `POST /api/v1/fs/scan-watch`

### Python 做了什么
- 启动 watchdog FolderWatcher 监听目录变化
- 同时触发后台扫描

### Node.js 当前状态
- ❌ 返回 `{ status: "not_implemented" }`

### 待实现（低优先级）
- [ ] 使用 `chokidar` 或 Node.js `fs.watch` 实现目录监听

---

## 实现优先级

| 优先级 | 功能 | 原因 |
|--------|------|------|
| P0 | Thumbnail 7z 修复 | 当前测试失败 |
| P1 | Archive List | 阅读器必须 |
| P1 | Archive Extract | 阅读器必须 |
| P1 | Archive File | 阅读器必须 |
| P2 | Unzip | 常用操作 |
| P2 | Extract Cache Clear | 磁盘管理 |
| P2 | Backfill | 元数据补全 |
| P3 | Zip Folder | 次要 |
| P3 | Archive Compress Images | 次要 |
| P3 | Scan Watch | 次要 |

---

## 工具路径约定

```
backend/tools/7zip-lite/7z.exe   ← 7z CLI（列出/提取所有格式）
backend/tools/ffmpeg/ffmpeg.exe  ← 视频截帧
backend/tools/imagemagick/magick.exe ← 图片缩放
```

Node.js 版本统一通过 `resolveTool()` 查找，找不到 fallback 到 PATH。

---

## 关键差异说明

| 方面 | Python | Node.js |
|------|--------|---------|
| DB | `index.db` (SQLAlchemy) | `index_node.db` (node:sqlite) |
| 7z 列出条目 | py7zr 库（原生，无编码问题） | 7z CLI（需 `-scsUTF-8` 参数） |
| 图片处理 | PIL/Pillow | imagemagick CLI |
| 视频截帧 | ffmpeg CLI | ffmpeg CLI（相同） |
| 异步 | asyncio + threading | Node.js async/await + child_process |
