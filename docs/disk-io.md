# 磁盘 IO 清单

> 源文件：`backendnode/src/routes/fs.ts` 及相关 services

## 读操作

| 操作 | API | 触发路由 | 说明 |
|------|-----|----------|------|
| 目录列举 | `fs.promises.readdir` | `GET /fs/list`, `POST /fs/scan`, `POST /fs/backfill`, `POST /fs/sync-file-table` | 异步读取目录条目 |
| 文件/目录 stat | `fs.promises.stat` | 几乎所有路由 | 获取 mtime、size、isDirectory |
| 文件存在检查 | `fs.promises.access` | `GET /fs/download`, `GET /fs/file`, `GET /fs/archive/list`, `POST /fs/archive/extract` | 访问权限检查 |
| 文件流读取 | `fs.createReadStream` | `GET /fs/file`, `GET /fs/download`, `GET /fs/archive/file` | 支持 Range 分片 |
| 驱动器列表 | `node-disk-info` (`getDiskInfo`) | `GET /fs/drives` | 异步调用 `wmic`(Win) / `df`(Unix) |

## 写操作

| 操作 | API | 触发路由 | 说明 |
|------|-----|----------|------|
| 创建目录 | `fs.promises.mkdir` | `POST /fs/ensure-dir`, `POST /fs/move-file`, `POST /fs/move-folder` | `recursive: true` |
| 移动/重命名 | `fs.promises.rename` | `POST /fs/move-file`, `POST /fs/move-folder`, `POST /fs/rename` | 同盘原子操作 |
| 删除 | `fs.promises.rm` | `DELETE /fs/delete` (permanently=true) | 递归强制删除 |
| 移入回收站 | `trash()` | `DELETE /fs/delete` (permanently=false) | 第三方库 |

## 归档 IO（子进程）

| 操作 | 工具 | 触发路由 | 说明 |
|------|------|----------|------|
| 列出归档内容 | 7z (`execFile`) | `GET /fs/archive/list`, `POST /fs/backfill` | `archiveService.listEntries` |
| 分步解压 | 7z | `POST /fs/archive/extract` | `archiveService.stepwiseExtract`，写入 `data/extract_cache/` |
| 压缩图片 | 7z + ImageMagick | `POST /fs/archive/compress-images` | `archiveService.compressArchiveImages` |
| 打包为 zip | 7z | `POST /fs/zip-folder` | 直接 `execFileAsync` |
| 解压 zip | 7z | `POST /fs/unzip` | 直接 `execFileAsync` |
| 清理解压缓存 | `fs.promises.rm` | `DELETE /fs/extract-cache` | 删除 `data/extract_cache/` 下内容 |

## 缩略图 IO

| 操作 | 触发路由 | 说明 |
|------|----------|------|
| 读取/生成缩略图 | `GET /fs/thumb`（thumbService） | 读取归档首图或视频帧，写入 `data/thumb_cache/` |
| backfill 批量生成 | `POST /fs/backfill` | fire-and-forget，`getOrGenerateThumb` |

## 文件监听

| 操作 | API | 触发路由 | 说明 |
|------|-----|----------|------|
| 目录 watch | `fs.watch` | `POST /fs/scan-watch` | 递归监听，变更时在 `setImmediate` 内 upsert DB |

## 后台异步 IO（fire-and-forget）

以下操作通过 `setImmediate` 在响应返回后执行，不阻塞请求：

- `GET /fs/list` — upsertFolder + upsertFile + saveParsedMetadata + recordFolderOpen
- `POST /fs/scan` — 递归 walk + upsertFolder + upsertFile + saveParsedMetadata，完成后触发 `refreshAllRecScores`
- `POST /fs/sync-file-table` — 遍历所有 FS_ROOTS 做全量 upsert
