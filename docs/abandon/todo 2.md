分析完成，以下是前后端 API 字段对比结果，发现了几处不匹配：

---

## 已确认的 Mismatch

### 1. `BackfillResponse` — 严重不匹配
前端期望：
```ts
{ status: "ok", scanned_files: number, backfilled_thumbnails: number, backfilled_meta: number, message: string }
```
后端实际返回（`backfill` handler）：
```ts
{ status: "started", message: "Backfill task started", path: dirPath }
```
完全不同的 shape，`status` 值也不对。

---

### 2. `BatchParseItem.result` — 字段命名不匹配
前端期望 `result` 是 `ParseResponse`：
```ts
{ title, authors, cosers?, group?, raw_tags, event?, date_tag?, type, pack_kind? }
```
后端直接返回 `parseName()` 的原始结果（camelCase）：
```ts
{ title, authors, cosers, groupName, rawTags, event, dateTag, mediaType }
```
`groupName` vs `group`，`rawTags` vs `raw_tags`，`dateTag` vs `date_tag`，且缺少 `type` 字段。

---

### 3. `HistoryItem.file_exists` — 缺失字段
前端类型有 `file_exists?: (boolean | null)`，后端 `listHistory` 从不返回这个字段。

---

### 4. `ScanStatusItem.parsed_files` — 缺失字段
前端类型有 `parsed_files?: number`，后端 `getScanStatus` 的 in-memory map 里没有这个字段。

---

### 5. `StoredParseResponse` 从 DB 读取时 authors/cosers/raw_tags 丢失
`parseSingle` 从 DB 读取时：
```ts
return { filepath, title, authors: [], cosers: [], group_name, raw_tags: [], ... }
```
`authors`、`cosers`、`raw_tags` 硬编码为空数组，DB 里存的数据没有被读出来。

---

### 6. `listDirectory` 缺少 `has_video` / `has_audio` 查询参数
前端 SDK 发送 `has_video` 和 `has_audio` 过滤参数，但后端 handler 的 Querystring 类型里没有这两个字段，完全忽略了。

---

### 7. `listDirectory` 的 `sort_by` 支持不完整
前端支持 `'name' | 'mtime' | 'type' | 'recommendation' | 'image_count'`，后端只处理了 `mtime` 和 `recommendation`，`type` 和 `image_count` 排序没有实现。

---

### 8. `/api/v1/utils/health-check/` 未实现
前端 SDK 调用这个路径，后端只有 `/health`（无 `/api/v1` 前缀，路径也不同）。

---

### 9. Users / Private 相关端点完全未实现
前端 SDK 里有 `UsersService`、`PrivateService`，后端没有对应路由。（这些可能是遗留的 Python 模板代码，看情况是否需要实现。）

---

## 无问题的部分
- Authors / Cosers / Tags 列表接口 ✅
- History record ✅  
- Search ✅
- Settings GET/PUT ✅（后端多返回 `env_file_path` 无影响）
- Archive list/extract/file ✅
- FileSystemItem 主要字段 ✅（后端多返回 `last_read_at` 无影响）

---

## 建议修复优先级

| 优先级 | 问题 |
|--------|------|
| 高 | `BackfillResponse` shape 完全错误 |
| 高 | `BatchParseItem.result` 字段命名不匹配 |
| 高 | `listDirectory` 忽略 `has_video`/`has_audio` 过滤 |
| 中 | `StoredParseResponse` DB 读取时 authors/cosers/raw_tags 为空 |
| 中 | `HistoryItem.file_exists` 缺失 |
| 低 | `ScanStatusItem.parsed_files` 缺失 |
| 低 | `sort_by=type/image_count` 未实现 |
| 低 | `/utils/health-check/` 路径不对 |

需要我切换到 Act 模式来修复这些问题吗？可以按优先级逐一处理。