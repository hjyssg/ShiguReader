# Search API 参数说明

## POST `/api/v1/search`

### 请求体参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `q` | `string` | `""` | 搜索关键词。空字符串直接返回空结果 |
| `scopes` | `string[]` | `["file","author","coser","tag"]` | 搜索维度，见下方说明 |
| `mode` | `"exact" \| "hybrid"` | `"hybrid"` | 匹配模式，见下方说明 |
| `presence_filter` | `"all" \| "watched" \| "scanned_recent"` | `"all"` | 文件存在性过滤，见下方说明 |
| `limit` | `number` | `200` | 最多返回条数，上限 500 |
| `offset` | `number` | `0` | 分页偏移量 |

---

### `mode` — 匹配模式

| 值 | SQL 等价 | 适用场景 |
|----|---------|---------|
| `exact` | `field = q` | 已知精确名称时使用，结果更干净。例如从 badge 点击跳转搜索 |
| `hybrid` | `field LIKE %q%` | 用户手动输入关键词时使用，模糊匹配，容错性更好 |

各 scope 在不同 mode 下的 SQL 行为：

| scope | exact | hybrid |
|-------|-------|--------|
| `file` | `filename = q OR filepath = q` | `filename LIKE %q% OR filepath LIKE %q%` |
| `author` | `artist_name = q`（role=''） | `artist_name LIKE %q%`（role=''） |
| `coser` | `artist_name = q`（role='coser'） | `artist_name LIKE %q%`（role='coser'） |
| `tag` | `tag_name = q` | `tag_name LIKE %q%` |

---

### `scopes` — 搜索维度

多个 scope 的结果按 `filepath` 去重合并（同一文件只出现一次）。

| 值 | 说明 |
|----|------|
| `file` | 按文件名或完整路径搜索 |
| `author` | 按作者名搜索，返回该作者关联的所有文件 |
| `coser` | 按 coser 名搜索，返回该 coser 关联的所有文件 |
| `tag` | 按标签名搜索，返回带有该标签的所有文件 |

---

### `presence_filter` — 文件存在性过滤

| 值 | 说明 |
|----|------|
| `all` | 返回所有记录，包括已从磁盘消失（`is_missing=1`）的历史记录 |
| `watched` | 只返回有阅读历史的文件（`filepath IN read_history`） |
| `scanned_recent` | 只返回最近 10 分钟内被扫描到的文件（`is_missing=0 AND last_seen_at >= now-600`） |

---

### 响应

```json
{
  "items": [
    {
      "name": "filename.zip",
      "path": "/absolute/path/to/file.zip",
      "item_type": "file",
      "file_type": "archive",
      "filesize": 12345678,
      "mtime": 1700000000,
      "thumbnail_url": "/api/v1/thumbnail?path=..."
    }
  ],
  "total": 42
}
```

`total` 是去重后的总命中数（未分页），`items` 是按 `offset`/`limit` 截取后的结果。

---

## POST `/api/v1/search/quick-match-batch`

油猴脚本专用接口，批量判断一组标题是否已下载。

### 请求体

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `queries` | `string[]` | `[]` | 待匹配的文件名/标题列表 |
| `limit` | `number` | `5` | 每个 query 返回的候选命中数上限 |
| `presence_filter` | `"all" \| "present"` | `"all"` | 文件存在性过滤 |

### 匹配等级

| 等级 | 含义 |
|------|------|
| `downloaded` | 作者匹配 + 标题高度相似（已下载） |
| `likely` | 作者或标题有较强匹配（可能已下载） |
| `same_author` | 同作者但标题不同（同作者其他作品） |
| `different` | 无匹配 |

---

## 前端跳转规范

- 从 badge/列表点击已知名称跳转搜索 → 使用 `mode: "exact"`
- 搜索框用户手动输入 → 使用 `mode: "hybrid"`（搜索页默认值）
