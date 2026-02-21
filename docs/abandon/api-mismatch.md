# 前端 API 调用 vs 后端实现 差异报告

> 以前端 `sdk.gen.ts` / `types.gen.ts` 为准，后端需要对齐。

---

## 1. Authors / Cosers / Tags — 分页参数不一致

| 项目 | 前端期望 | 后端实现 |
|------|---------|---------|
| 查询参数 | `page`, `page_size` | `offset`, `limit` |
| 响应字段 | `{ items, page, page_size, total }` | `{ total, items }` |

**受影响路由：** `GET /api/v1/authors`、`GET /api/v1/cosers`、`GET /api/v1/tags`

---

## 2. History — URL 路径不一致

| 项目 | 前端期望 | 后端实现 |
|------|---------|---------|
| 记录历史 | `POST /api/v1/history/record` | `POST /api/v1/history` |
| 列出历史 | `GET /api/v1/history/list` | `GET /api/v1/history` |

---

## 3. History — 分页参数不一致

| 项目 | 前端期望 | 后端实现 |
|------|---------|---------|
| 查询参数 | `page`, `page_size` | `offset`, `limit` |
| 响应字段 | `{ items, page, page_size, total, total_pages }` | `{ total, items }` |

---

## 4. History — 字段名不一致

| 项目 | 前端期望 | 后端实现 |
|------|---------|---------|
| 时间字段 | `read_at` | `last_opened_at` |

---

## 5. Parse — batch 请求体字段名不一致

| 项目 | 前端期望 | 后端实现 |
|------|---------|---------|
| 请求体字段 | `{ filepaths: string[] }` | `{ filenames: string[] }` |

**受影响路由：** `POST /api/v1/parse/batch`

---

## 6. Parse — GET 响应类型不一致

| 项目 | 前端期望 | 后端实现 |
|------|---------|---------|
| 响应类型 | `StoredParseResponse { filepath, title, authors, cosers, group_name, raw_tags, event, date_tag, media_type }` | 直接返回 `parseName()` 结果（无 `filepath`，字段名不同） |

**受影响路由：** `GET /api/v1/parse?filepath=...`

---

## 7. Settings — 缺少 PUT 端点

| 项目 | 前端期望 | 后端实现 |
|------|---------|---------|
| 更新设置 | `PUT /api/v1/settings` with `{ favorite_dir?, fs_roots?, already_read_dir? }` | **不存在** |

---

## 8. Settings — fs_roots 类型不一致

| 项目 | 前端期望 | 后端实现 |
|------|---------|---------|
| `fs_roots` 类型 | `string`（逗号分隔） | `string[]`（数组） |

---

## 9. fs/move-file、fs/move-folder — 请求体字段名不一致

| 项目 | 前端期望 | 后端实现 |
|------|---------|---------|
| 请求体 | `{ source_path, dest_path }` | `{ src, dst }` |

---

## 10. fs/delete — 缺少 `permanently` 字段

| 项目 | 前端期望 | 后端实现 |
|------|---------|---------|
| 请求体 | `{ path, permanently?: boolean }` | `{ path }` |

---

## 11. fs/zip-folder — 请求体字段名不一致

| 项目 | 前端期望 | 后端实现 |
|------|---------|---------|
| 请求体 | `{ folder_path, output_path? }` | `{ path, dest? }` |

---

## 12. fs/unzip — 请求体字段名不一致

| 项目 | 前端期望 | 后端实现 |
|------|---------|---------|
| 请求体 | `{ archive_path, output_dir? }` | `{ path, dest? }` |

---

## 13. fs/scan-status — 响应格式完全不一致

| 项目 | 前端期望 | 后端实现 |
|------|---------|---------|
| 响应 | `Array<ScanStatusItem>` | `{ running: false, progress: null }` |

`ScanStatusItem` 结构：`{ path, status, message?, recursive?, scanned_folders?, scanned_files?, parsed_files?, watcher_active?, started_at?, finished_at? }`

---

## 14. fs/archive/compress-images — 请求体字段名不一致

| 项目 | 前端期望 | 后端实现 |
|------|---------|---------|
| 请求体 | `{ archive_path, output_path?, max_width?, max_height?, quality?, min_size? }` | `{ path, max_height?, quality? }` |

---

## 15. PathOperationResponse — 响应字段不完整

| 项目 | 前端期望 | 后端实现 |
|------|---------|---------|
| 响应 | `{ status: "ok", message: string, path: string, dest_path?: string }` | 各接口返回不一致，缺少 `message`、`path`、`dest_path` |

**受影响路由：** move-file、move-folder、delete、zip-folder、rename、unzip

---

## 16. fs/backfill — 缺少 `recursive` 字段

| 项目 | 前端期望 | 后端实现 |
|------|---------|---------|
| 请求体 | `{ path, recursive?, fill_thumbnail?, fill_meta? }` | `{ path, fill_thumbnail?, fill_meta? }` |

---

## 17. fs/scan-watch — 缺少 `recursive` 字段

| 项目 | 前端期望 | 后端实现 |
|------|---------|---------|
| 请求体 | `{ path, recursive? }` | `{ path }` |

---

## 18. FileSystemItem — 缺少字段

| 项目 | 前端期望 | 后端实现 |
|------|---------|---------|
| 缺少字段 | `scan_state`, `watch_state`, `confidence_level`, `confidence_score`, `avg_image_size` | 后端有 `last_read_at`（前端无此字段） |

---

## 19. fs/recent-activity — activity_type 枚举值后端未完整记录

| 项目 | 前端期望 | 后端实现 |
|------|---------|---------|
| `activity_type` 枚举 | `"scan" \| "minify_zip_images" \| "move" \| "delete" \| "rename" \| "startup" \| "cache_cleanup" \| "db_sync"` | 实际只写入 `"scan"`、`"backfill"`（`"backfill"` 前端不认识） |

**受影响路由：** `GET /api/v1/fs/recent-activity`

缺少写入的类型：
- `"startup"` — 服务器启动时应写入，`since_latest_startup` 过滤器依赖此记录
- `"cache_cleanup"` — 清理 extract cache 时应写入
- `"db_sync"` — 同步文件表时应写入
- `"move"` — move-file / move-folder 操作时应写入
- `"delete"` — delete 操作时应写入
- `"rename"` — rename 操作时应写入
- `"minify_zip_images"` — compress-images 操作时应写入

---

## 20. fs/recent-activity — since_latest_startup 过滤器永远失效

| 项目 | 前端期望 | 后端实现 |
|------|---------|---------|
| `since_latest_startup=true` | 只返回最近一次启动之后的日志 | 查询 `activity_type = 'startup'` 的记录，但后端从不写入此类型，导致永远回退到返回全部日志 |

**受影响路由：** `GET /api/v1/fs/recent-activity?since_latest_startup=true`（前端默认传此参数）

---

## 21. fs/sync-file-table — 端点缺失

| 项目 | 前端期望 | 后端实现 |
|------|---------|---------|
| 重试 db_sync 活动 | `POST /api/v1/fs/sync-file-table` | **不存在** |

`RecentActivityPanel` 对 `activity_type === "db_sync"` 的失败条目提供重试按钮，调用此端点。

---

## 修复状态

- [x] #1 Authors/Cosers/Tags 分页参数
- [x] #2 History URL 路径
- [x] #3 History 分页参数
- [x] #4 History `read_at` 字段名
- [x] #5 Parse batch `filepaths` 字段名
- [x] #6 Parse GET 响应类型
- [x] #7 Settings PUT 端点
- [x] #8 Settings `fs_roots` 类型
- [x] #9 move-file/move-folder 字段名
- [x] #10 delete `permanently` 字段
- [x] #11 zip-folder 字段名
- [x] #12 unzip 字段名
- [x] #13 scan-status 响应格式
- [x] #14 compress-images 字段名
- [x] #15 PathOperationResponse 字段
- [x] #16 backfill `recursive` 字段
- [x] #17 scan-watch `recursive` 字段
- [x] #18 FileSystemItem 缺少字段
- [x] #19 recent-activity activity_type 枚举值未完整记录
- [x] #20 recent-activity since_latest_startup 过滤器永远失效
- [x] #21 sync-file-table 端点缺失
