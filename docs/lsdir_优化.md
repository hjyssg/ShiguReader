
好的，我分析了当前 `list_directory` 的热路径，700ms 的剩余耗时主要来自以下几个地方：

## 瓶颈分析

现在热路径上还剩这些同步操作：

1. **`validated_path.iterdir()` + 每个 entry 的 `stat()` 调用** — 这是文件系统 I/O，目录下有多少文件就调多少次 `stat()`。如果目录有几百个文件，Windows NTFS 上每次 `stat()` 大约 1-3ms，累积就是几百毫秒。这是最大的剩余瓶颈。

2. **每个 entry 调用 `should_ignore()` + `_is_link_or_reparse()`** — `_is_link_or_reparse` 内部又调了 `os.lstat()`，等于每个被 ignore 的文件也要做一次额外的系统调用。

3. **每个文件都调 `compute_confidence()`** — 虽然函数本身很轻，但每次都调 `int(time())`，几百次也有微小开销。

4. **每个文件都调 `detect_file_type()`** — 每次都 `Path(filepath).suffix.lower()`，创建 Path 对象有开销。

5. **DB 查询** — `get_file_data_by_folder` + `get_archive_metas_by_folder` 两次 SQL，虽然有索引但 SQLite 连接建立也有开销。

## 优化方案

### 方案 A：用 `os.scandir()` 替代 `iterdir()` + `stat()` (预计节省 200-400ms)
`os.scandir()` 在 Windows 上一次系统调用就能拿到 `name`、`is_dir`、`is_file`、`stat` 信息，比 `iterdir()` + 逐个 `stat()` 快很多。这是最大的优化点。

### 方案 B：预计算 `now_ts`，避免重复调用 `time()` (微小优化)
在循环外算一次 `int(time())`，传给所有 `compute_confidence()` 调用。

### 方案 C：优化 `_is_link_or_reparse` 调用时机 (预计节省 50-100ms)
当前代码对 `should_ignore` 返回 True 的 entry 还会调 `_is_link_or_reparse`，逻辑有 bug（应该是 ignore 了就直接 continue）。修复后减少无用的 `os.lstat` 调用。

### 方案 D：`detect_file_type` 直接用字符串操作替代 Path 对象 (微小优化)

### 方案 E：合并两次 DB session 为一次 (微小优化)
当前开了两次 `get_index_session()`（一次 record_folder_open 已移到后台，但 metadata 查询还是单独一次 session）。

**最有效的是方案 A**，用 `os.scandir()` 替代 `iterdir()` + `stat()`，预计能把 700ms 降到 200-300ms 左右。

