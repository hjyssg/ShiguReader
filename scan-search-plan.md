
## 实施计划

我已经通读了后端和前端的核心代码，以下是按模块拆分的详细计划：

---

### 第一步：后端 — 扫描时自动解析 filename 并入库

现有基础：
- `name_parser` 已经完整实现（`parser.py`），能输出 `ParseResult(title, authors, group, raw_tags, event, date_tag, type)`
- `IndexRepository.save_parse_result` / `batch_save_parse_results` 已经能把解析结果写入 `parsed_metadata` / `artists` / `tags` 等表
- `fs.py` 的 `list_directory` 在后台任务中做了 `batch_upsert_files`，但没有调用 name_parser

改动：
- 在 `fs.py` 的 `upsert_to_db()` 后台任务中，对每个文件调用 `parse(filename)`，将解析结果通过 `repo.batch_save_parse_results()` 写入 DB
- 解析失败（返回 None）不阻塞，只跳过该文件的 metadata 写入

---

### 第二步：后端 — 新增递归扫描 + 扫描并监听 API

现有基础：
- `list_directory` 只扫描当前目录（非递归）
- `FolderWatcher` 已实现（基于 watchdog），支持 recursive watch

新增两个端点到 `fs.py`：

1. `POST /api/v1/fs/scan` — 递归扫描子文件夹
   - 参数：`path`, `recursive=true`
   - 递归遍历所有子目录，对每个文件做 upsert + name_parser 解析入库
   - 后台任务执行，返回任务状态

2. `POST /api/v1/fs/scan-watch` — 递归扫描 + 启动 watchdog 监听
   - 在 scan 基础上，额外启动 `FolderWatcher`
   - 维护一个全局 watcher 注册表，避免重复 watch

3. `GET /api/v1/fs/scan-status` — 查询扫描状态（可选，用于前端轮询）

---

### 第三步：后端 — Search API

新增 `backend/app/api/routes/search.py`：

`POST /api/v1/search`
```python
{
  "q": "string",
  "scopes": ["file", "author", "tag"],
  "mode": "exact" | "hybrid"
}
```

在 `IndexRepository` 中新增搜索方法：
- `search_files(q, mode)` — 按 filename/filepath 做 LIKE 或全文匹配
- `search_by_author(q, mode)` — 查 `artists` + `file_artists` 关联回 `files`
- `search_by_tag(q, mode)` — 查 `tags` + `file_tags` 关联回 `files`

返回结构对齐 `FileSystemItem`（name, path, item_type, file_type, filesize, mtime, thumbnail_url），前端可直接复用 Explorer 的渲染组件。

注册到 `api/main.py`。

---

### 第四步：前端 — 抽离通用 FileList 组件

从 `explorer.tsx` 中抽出：
- `FileItem`（grid 卡片）
- `DetailsView` + `DetailsRow`（列表视图）
- `FileIcon`、排序逻辑、工具栏（viewMode/sort 切换）
- 格式化工具函数

放到 `frontend/src/components/Files/` 目录下：
- `FileList.tsx` — 主组件，接收 `items: FileSystemItem[]`、`isLoading`、排序/视图状态
- `FileItem.tsx` — grid 单项
- `DetailsView.tsx` — 列表视图
- `FileIcon.tsx` — 图标组件
- `utils.ts` — formatFileSize, formatDateTime, formatFileType

Explorer 页面改为引用这个通用组件。

---

### 第五步：前端 — Explorer 新增扫描策略 Dropdown

在 Explorer 工具栏中新增一个 `DropdownMenu`（使用已有的 `ui/dropdown-menu.tsx`）：
- 选项 1：「扫描包括子文件夹」→ 调用 `POST /api/v1/fs/scan`
- 选项 2：「扫描并监听子文件夹」→ 调用 `POST /api/v1/fs/scan-watch`
- 扫描中显示 loading 状态，完成/失败给 toast 提示

---

### 第六步：前端 — 新增 Search Page

1. 新建路由 `frontend/src/routes/_layout/search.tsx`
2. 页面包含：
   - Search Panel：输入框（q）、scope 多选（file/author/tag）、mode 选择（exact/hybrid）
   - Results Area：使用第四步抽出的 `FileList` 组件渲染结果
3. 在 Sidebar 的 `AppSidebar.tsx` 中添加 Search 导航项
4. 在 `sdk.gen.ts` / `types.gen.ts` 中手动添加 Search API 的类型和方法（或重新生成 client）

---

### 文件变更清单

后端：
- `backend/app/api/routes/fs.py` — 修改 upsert_to_db 加入 name_parser；新增 scan / scan-watch 端点
- `backend/app/api/routes/search.py` — 新建
- `backend/app/api/main.py` — 注册 search router
- `backend/app/index_db/repository.py` — 新增 search 查询方法

前端：
- `frontend/src/components/Files/FileList.tsx` — 新建通用组件
- `frontend/src/components/Files/FileItem.tsx` — 新建
- `frontend/src/components/Files/DetailsView.tsx` — 新建
- `frontend/src/components/Files/FileIcon.tsx` — 新建
- `frontend/src/components/Files/utils.ts` — 新建
- `frontend/src/routes/_layout/explorer.tsx` — 重构，使用通用组件 + 添加扫描 Dropdown
- `frontend/src/routes/_layout/search.tsx` — 新建
- `frontend/src/components/Sidebar/AppSidebar.tsx` — 添加 Search 导航
- `frontend/src/client/sdk.gen.ts` — 添加 scan/search API 方法
- `frontend/src/client/types.gen.ts` — 添加对应类型

---

这个计划覆盖了 task.md 中的所有验收标准。你觉得这个方案 OK 吗？有需要调整的地方可以说，确认后请 toggle to Act mode，我来开始实现。
