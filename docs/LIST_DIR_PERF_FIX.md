# /fs/list 性能优化计划

## 问题
list_directory 每次请求执行 6+ 次 SQL（推荐分数 5 次 + archive_meta 1 次），导致 900ms 响应。

## 改动

### 1. File 表加 `rec_score` 字段
- models.py: File 加 `rec_score: float = 0.0`
- 新建 alembic migration

### 2. Repository 加高效查询方法
- `get_files_by_folder(folderpath)` → 一次查出目录下所有文件的 rec_score + archive_meta
- `get_archive_metas_by_folder(folderpath)` → 子查询替代 IN(...)
- `batch_update_rec_scores(scores: dict[str, float])` → 批量更新分数

### 3. 内存缓存 + scan 后更新
- 模块级缓存 favorite 频率数据（author_freq, tag_freq, tag_total）
- `_run_scan` 完成后调用 `_refresh_rec_scores()`
- favorite 目录 scan → 刷新全局缓存 + 全量重算
- 非 favorite scan → 用缓存给新文件算分

### 4. list_directory 接口瘦身
- 删除 `_compute_recommendation_scores` 的同步调用
- 改用 `WHERE folderpath = ?` 一次查出 rec_score
- archive_meta 用子查询

### 预期效果
list 接口 SQL: 6次 → 1-2次简单查询，响应时间接近旧版 4ms 水平。
