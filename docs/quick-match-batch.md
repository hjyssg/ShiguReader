 quick-match-batch — 判断同人是否已在本地

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