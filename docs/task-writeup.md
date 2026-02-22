# Task Writeup

## Task 2: quick-match-batch — 判断同人是否已在本地

### 目标
Tampermonkey 脚本已在调用 `POST /api/search/quick-match-batch`，但后端没有这个接口。需要实现它。

### 新增文件
- `backendnode/src/utils/titleMatcher.ts` — title 比较逻辑
- `backendnode/tests/utils/titleMatcher.test.ts` — 单元测试

### 修改文件
- `backendnode/src/routes/search.ts` — 新增 quick-match-batch handler
- `backendnode/src/db/repository.ts` — 新增 `quickMatchCandidates()` 方法
- `backendnode/package.json` — 添加 `fastest-levenshtein` 依赖

### 接口定义

```
POST /api/search/quick-match-batch
Body: {
  queries: string[],       // ehentai 页面上的标题列表
  limit?: number,          // 每个 query 最多返回几个候选，默认 5
  presence_filter?: string // "all" | "present"，默认 "all"
}
Response: {
  results: Array<{
    q: string,             // 原始 query
    match_level: "downloaded" | "likely" | "same_author" | "different",
    confidence: number,    // 0.0 ~ 1.0
    reason: string,        // 调试用，说明为什么这个 level
    hits: Array<{
      name: string,
      match_level: string,
      confidence: number
    }>
  }>
}
```

### 算法流程

```
Step 1 — 解析 query
  parseName(query) 得到 title / authors / groupName

Step 2 — 搜索候选（不用 tag）
  a. 如果有 authors → searchByAuthor(authors[0])
  b. 取 title 中间 10~15 字作为关键词 → searchFiles(keyword)
  两路结果合并去重，取前 limit * 3 个候选

Step 3 — 对每个候选打分
  parseName(candidate.filename) 得到候选的 title / authors
  
  author_score:
    完全匹配任一 author → 1.0
    groupName 匹配 → 0.7
    无匹配 → 0.0

  title_score (titleMatcher):
    strip 噪音 token（DL版、オリジナル、修正版 等）
    提取卷号（末尾数字、I/II/III、上/中/下、第X話）
    如果 strip 后完全一致 → 1.0
    如果 strip 后一致但卷号不同 → 0.1（明确不同卷）
    否则用 fastest-levenshtein 计算距离：
      distance / max(len_a, len_b) 得到相似度

Step 4 — 决定 match_level
  author_score >= 1.0 && title_score >= 0.9  → downloaded
  author_score >= 0.7 && title_score >= 0.8  → likely
  author_score >= 1.0 && title_score < 0.5   → same_author
  其他                                        → different
```

### 关键测试用例

```
// 同一本（尾部噪音不同）→ downloaded
query:     "(コミティア155) [準特注くろますく (へたれん)] 勇者レベルアップでシスターから祝福をII (オリジナル) [DL版]"
candidate: "(コミティア155) [準特注くろますく (へたれん)] 勇者レベルアップでシスターから祝福をII"
expected:  downloaded

// 不同卷 → same_author 或 different
query:     "...勇者レベルアップでシスターから祝福を1..."
candidate: "...勇者レベルアップでシスターから祝福を2..."
expected:  same_author（author 匹配，但卷号不同）
```

---

## Task 3: 简化 progress 表

### 目标
`progress` 表字段过多，每次翻页都写大量冗余快照字段。改为极简的 append log。

### 修改文件
- `backendnode/src/db/schema.sql` — 删 progress，加 read_history
- `backendnode/src/db/repository.ts` — 删旧方法，加新方法
- `backendnode/src/routes/history.ts` — 内部实现换掉，接口签名尽量兼容
- `backendnode/tests/routes/history.test.ts` — 更新 mock

### 新表结构

```sql
-- 删掉 progress 表
-- 保留 folder_open_history 不动

CREATE TABLE IF NOT EXISTS read_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filepath TEXT NOT NULL,
  opened_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_read_history_opened_at ON read_history(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_read_history_filepath ON read_history(filepath);
```

### Repository 变更

删掉：
- `upsertProgress()`
- `listProgressHistory()`
- `countProgressHistory()`

新增：
- `recordRead(filepath)` — INSERT 一条记录
- `listReadHistory(offset, limit)` — JOIN files，返回展示字段
- `countReadHistory()` — 总条数

### history/list 接口响应字段

```json
{
  "items": [{
    "id": 1,
    "filepath": "/path/to/book.zip",
    "filename": "book.zip",
    "file_type": "archive",
    "thumbnail_url": "...",
    "opened_at": 1700000000
  }],
  "page": 1,
  "page_size": 50,
  "total": 100,
  "total_pages": 2
}
```

注意：去掉了 `page_current`、`page_total`、`position_sec` 等进度字段。

### Migration
由于是开发阶段，直接在 `schema.sql` 里改，不写 ALTER TABLE migration。启动时如果检测到旧 `progress` 表存在，打一条 warn log 即可（不自动迁移，让用户手动删 DB 重建）。

---

## Task 4: 主要 API 集成测试

### 目标
用真实 SQLite + 真实 zip 文件测试主要接口，找出 mock 测试发现不了的问题。

### 新增文件
- `backendnode/tests/integration/fixtures/generate.ts` — 生成测试文件的脚本
- `backendnode/tests/integration/api.integration.test.ts` — 集成测试主文件

### 依赖
- `jszip` — 生成真实 zip 文件（加到 devDependencies）

### 测试文件生成

`generate.ts` 在临时目录创建：
```
/tmp/shigureader-test/
  manga/
    (C102) [サークル (作者A)] タイトルA (オリジナル).zip   ← 含3张假PNG
    (C102) [サークル (作者A)] タイトルB (オリジナル).zip   ← 同作者不同标题
    (コミティア155) [準特注くろますく (へたれん)] 勇者レベルアップでシスターから祝福をII.zip
    (コミティア155) [準特注くろますく (へたれん)] 勇者レベルアップでシスターから祝福を1.zip
  videos/
    sample_video.mp4   ← 空文件，只测文件类型识别
```

### 测试覆盖场景

```
fs/list
  ✓ 列出目录返回正确文件列表
  ✓ 文件类型识别正确（archive/video）
  ✓ 不存在的目录返回 400


author/tag也需要测试哦

search
  ✓ 按文件名搜索日文标题
  ✓ 按作者搜索
  ✓ presence_filter=present 过滤已删除文件
  ✓ 搜索结果去重

history/record + history/list
  ✓ record 后 list 能查到
  ✓ 同一文件多次 record → list 出现多条（append log）
  ✓ 分页正确

quick-match-batch（Task 2 完成后加）
  ✓ 同一本（DL版噪音）→ downloaded
  ✓ 不同卷号 → same_author
  ✓ 完全不同 → different
  ✓ 空 queries → 正常返回空数组
```

### 运行方式
```bash
cd backendnode
npx vitest run tests/integration/api.integration.test.ts
```

---

## 实施顺序

1. Task 3（schema 改动最基础，其他任务依赖它）
2. Task 2（新接口，依赖 repository）
3. Task 4（依赖前两个任务完成）
