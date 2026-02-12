# ShiguReader Remake 功能对比与开发计划

## 项目概述

本文档对比了原版 ShiguReader (D:\Git\ShiguReader) 和 Remake 版本 (D:\Git\Shigureader-vibecode) 的功能差异，并制定了详细的开发计划。

---

## 当前 Remake 已实现的功能 ✅

| 模块 | 状态 | 说明 |
|------|------|------|
| 用户认证系统 | ✅ 完成 | FastAPI + JWT，原版没有 |
| 首页 (Root 目录列表) | ✅ 基础完成 | 显示配置的根目录 |
| 文件浏览器 Explorer | ✅ 基础完成 | 目录列表、文件列表、缩略图 |
| 压缩包查看 Archive | ✅ 基础完成 | 列表内容、分页提取、优先提取当前页附近 |
| 漫画阅读器 Reader | ✅ 基础完成 | 图片显示、翻页、键盘导航 (左右箭头) |
| 视频播放器 Video | ✅ 基础完成 | 支持直接文件和压缩包内视频 |
| 缩略图生成服务 | ✅ 完成 | 压缩包、视频、图片缩略图，WebP 格式 |
| Index DB | ✅ 基础完成 | 文件/文件夹/压缩包元数据存储 |
| 后端架构 | ✅ 完成 | FastAPI + SQLModel + Alembic |
| 前端架构 | ✅ 完成 | React + TanStack Router + TanStack Query |

---

## 功能缺失清单（按优先级）

### P0 - 核心功能缺失 🔴

#### 1. 文件名解析器 (Name Parser)
**原版实现：** `packages/name-parser/index.js`
- 从文件名提取元数据：作者、标签、同人展会(C101等)、日期、类型
- 支持日文括号 `[]` 和 `()` 的解析规则
- 标签归一化和去重
- 角色名识别
- 同人展会日期推算

**Remake 需要：**
- Python 版本的 name parser
- 集成到 Index DB，为每个文件解析元数据
- 存储到新表：`parsed_metadata` (filepath, author, tags, event, date_tag, title)

**API 端点：**
```python
# 后端新增
POST /api/v1/parse/batch  # 批量解析文件名
GET /api/v1/parse/cache   # 获取解析缓存
```

---

#### 2. 搜索功能
**原版实现：** `packages/backend/src/routes/search.js`
- 全文搜索 (`MODE_SEARCH`)
- 按作者搜索 (`MODE_AUTHOR`)
- 按标签搜索 (`MODE_TAG`)
- 相似文件查找 (基于编辑距离算法)

**Remake 需要：**
```python
# 后端新增
POST /api/v1/search/files
  - mode: "search" | "author" | "tag"
  - text: str
  - 返回: 文件列表 + 元数据

POST /api/v1/search/similar
  - text: str (文件名)
  - 返回: 相似度评分的文件列表
```

**前端新增：**
- 全局搜索栏组件
- 搜索结果页面 `/search`
- 相似文件页面 `/similar`

---

#### 3. 阅读历史系统
**原版实现：** `packages/backend/src/routes/history.js` + `models/history-db.js`
- 记录文件访问时间和次数
- 历史记录页面分页显示
- 按天分组显示

**Remake 需要：**
- 扩展 `Progress` 表，添加 `visit_count` 字段
- 后端 API：
```python
POST /api/v1/history/add
  - filepath: str
  
GET /api/v1/history/list
  - page: int
  - 返回: 分页历史记录

GET /api/v1/history/file
  - filepath: str
  - 返回: 单个文件的历史
```

**前端新增：**
- `/history` 页面
- 历史记录组件 (按天分组)

---

#### 4. 排序和筛选功能
**原版实现：** `components/common/SortHeader` + `components/common/FilterPanel`
- 排序选项：时间、修改时间、文件大小、页数、文件名、评分、随机
- 筛选：文件类型 (压缩包/视频/图片文件夹)
- 升序/降序切换

**Remake 需要：**
- 前端组件：
  - `SortHeader` 组件 (参考原版设计)
  - `FilterPanel` 组件
- Explorer 页面集成排序和筛选
- URL 参数保存排序状态

---

#### 5. 文件操作 (移动/删除/重命名)
**原版实现：** `packages/backend/src/routes/file-move-delete.js` + `FileChangeToolbar`
- 移动文件到指定目录
- 删除文件/文件夹 (支持回收站)
- 重命名文件
- 快捷移动到 "good" / "no good" 文件夹
- 文件夹打包为 zip

**Remake 需要：**
```python
# 后端新增
POST /api/v1/fs/move
  - src: str
  - dest: str

POST /api/v1/fs/delete
  - path: str
  - use_trash: bool = True

POST /api/v1/fs/rename
  - src: str
  - dest: str

POST /api/v1/fs/zip_folder
  - path: str
```

**前端新增：**
- `FileOperationToolbar` 组件
- 移动文件模态框 (带目录树选择)
- 快捷键支持 (x = 移动到 no good, v = 移动到 good)

---

### P1 - 重要功能缺失 🟠

#### 6. 作者/标签页面
**原版实现：** `pages/TagPage/index.js`
- 按作者聚合显示所有文件
- 按标签聚合显示所有文件
- 显示每个作者/标签的文件数量
- 显示最新作品的缩略图
- 支持排序：文件数量、评分、最新作品、随机
- 标签分类筛选：Parody、Comiket、Human Name

**Remake 需要：**
```python
# 后端新增
GET /api/v1/tags/authors
  - 返回: 作者列表 + 文件数 + 最新作品缩略图

GET /api/v1/tags/tags
  - 返回: 标签列表 + 文件数 + 最新作品缩略图

GET /api/v1/tags/author/{author_name}
  - 返回: 该作者的所有文件

GET /api/v1/tags/tag/{tag_name}
  - 返回: 该标签的所有文件
```

**前端新增：**
- `/authors` 页面
- `/tags` 页面
- 标签卡片组件 (带缩略图)

---

#### 7. 相似文件查找页面
**原版实现：** `pages/SimilarFilePage/index.js`
- 基于文件名相似度算法
- 评分分级：Exact Match (100+)、Likely Match (70+)、Same Author (20+)
- 显示文件路径和类型

**Remake 需要：**
- 实现编辑距离算法 (Levenshtein Distance)
- 前端 `/similar` 页面
- 从 TamperMonkey 脚本跳转支持

---

#### 8. 首页增强
**原版实现：** `pages/HomePage/index.js`
- Watched Folders (扫描的目录)
- Quick Access (快速访问目录)
- Recent Access (最近访问的目录)
- Hard Drives (硬盘列表)

**Remake 需要：**
```python
# 后端增强
GET /api/v1/fs/roots
  - 新增字段: quick_access, recent_access, hdd_list
```

**前端增强：**
- 首页显示多个分组
- 最近访问从历史记录提取

---

#### 9. 音乐播放器
**原版实现：** `components/MusicPlayer/index.js`
- 播放压缩包内的音频文件
- 播放列表
- 自动播放下一首
- 显示在阅读器底部

**Remake 需要：**
- 前端 `MusicPlayer` 组件
- Reader 页面集成音乐播放器
- Archive 页面显示音频文件

---

#### 10. 漫画阅读器增强
**原版功能：** `pages/BookReadPage/index.js`
- 双页模式 (左右翻页)
- 图片缩放 (鼠标滚轮 / +/- 键)
- 图片旋转 (90度)
- 拖拽滚动 (鼠标拖动)
- 全屏模式 (Enter 键)
- 快速跳页 (g 键)
- 阅读进度记录 (读到 1/3 或 3 页后记录)
- 图片尺寸自适应
- 移动端触控翻页

**Remake 需要：**
- 前端增强 Reader 组件
- 添加所有交互功能
- 阅读进度 API 集成

---

### P2 - 进阶功能缺失 🟡

#### 11. 统计图表页面
**原版实现：** `pages/ChartPage/index.js`
- 按时间统计 (年/季度/月/日)
- 按同人展会统计 (Comiket 等)
- 按类型统计 (饼图)
- 文件数量和大小统计
- 支持筛选作者/标签/目录

**Remake 需要：**
```python
# 后端新增
GET /api/v1/stats/by_time
  - group_by: "year" | "quarter" | "month" | "day"
  - file_type: "compress" | "video"

GET /api/v1/stats/by_event
  - 返回: 同人展会统计

GET /api/v1/stats/by_type
  - 返回: 文件类型分布
```

**前端新增：**
- `/chart` 页面
- Chart.js 集成
- 多种图表类型

---

#### 12. 压缩包内图片压缩 (Minify)
**原版实现：** `routes/zip-minify.js` + ImageMagick
- 使用 ImageMagick 压缩图片
- 压缩后保存到 `minified_zip_cache`
- 覆盖原文件功能
- 压缩队列管理

**Remake 需要：**
```python
# 后端新增 (可选功能)
POST /api/v1/minify/check
  - path: str
  - 返回: 是否可压缩

POST /api/v1/minify/start
  - path: str
  - 启动压缩任务

GET /api/v1/minify/queue
  - 返回: 压缩队列状态

POST /api/v1/minify/overwrite
  - path: str
  - 用压缩版覆盖原文件
```

**依赖：** ImageMagick / Pillow

---

#### 13. 瀑布流阅读模式
**原版实现：** `pages/BookWaterfallPage/index.js`
- 所有图片垂直排列
- 懒加载
- 适合长篇漫画连续阅读

**Remake 需要：**
- 前端 `/waterfall` 页面
- 虚拟滚动优化

---

#### 14. 概览模式
**原版实现：** `pages/BookOverviewPage/index.js`
- 缩略图网格显示所有页面
- 点击跳转到对应页面
- 懒加载

**Remake 需要：**
- 前端 `/overview` 页面
- 缩略图网格组件

---

#### 15. Admin 页面增强
**原版功能：** `pages/AdminPage/index.js`
- 预生成缩略图 (选择目录批量生成)
- 缓存使用情况统计
- 清理缓存
- QR 码显示局域网地址
- 阅读习惯设置 (左右翻页方向)
- 远程关机
- Minify 队列显示

**Remake 需要：**
```python
# 后端新增
POST /api/v1/admin/pregenerate_thumbs
  - path: str
  - 批量生成缩略图

GET /api/v1/admin/cache_stats
  - 返回: 缓存统计

POST /api/v1/admin/clear_cache

GET /api/v1/admin/server_info
  - 返回: 服务器 IP、端口等
```

**前端增强：**
- Admin 页面添加更多功能
- QR 码生成

---

#### 16. 视频播放器增强
**原版功能：** `pages/VideoPlayer/index.js`
- 记忆播放位置 (Cookie)
- 自适应窗口大小
- 缩放控制 (+/- 键)
- DPlayer 集成

**Remake 需要：**
- 播放位置记录到 `Progress` 表
- 视频尺寸自适应逻辑
- 键盘快捷键

---

#### 17. 文件夹打包 Zip
**原版实现：** `routes/file-move-delete.js` - `zipFolder`
- 将图片文件夹打包为 zip
- 使用 7-Zip

**Remake 需要：**
```python
# 后端新增
POST /api/v1/fs/zip_folder
  - path: str
  - 返回: 生成的 zip 路径
```

---

#### 18. TamperMonkey 集成
**原版实现：** `packages/TamperMonkeyScript/EhentaiHighighliger.js`
- 在 E-Hentai 网站上高亮已下载的文件
- 与后端 `/api/exhentaiApi` 通信

**Remake 需要：**
```python
# 后端新增
GET /api/v1/integration/ehentai
  - 返回: 所有文件的解析结果 (title, author)
```

**前端：**
- 更新 TamperMonkey 脚本

---

### P3 - 小功能/优化 🟢

#### 19. 全局搜索栏
**原版实现：** `App.jsx` - 顶部导航栏
- 搜索输入框
- 过滤当前页面按钮

**Remake 需要：**
- 前端顶部导航栏添加搜索框
- 搜索跳转逻辑

---

#### 20. 面包屑导航增强
**原版：** 更丰富的路径导航和返回按钮

**Remake 需要：**
- 优化现有面包屑组件
- 添加更多上下文信息

---

#### 21. 文件下载
**原版：** 直接下载文件的链接

**Remake 需要：**
- 文件操作工具栏添加下载按钮

---

#### 22. 远程关机
**原版实现：** `routes/system-shutdown.js`

**Remake 需要：**
```python
# 后端新增 (可选)
POST /api/v1/system/shutdown
```

---

#### 23. iPad/手机适配
**原版：** 专门的移动端触控翻页逻辑

**Remake 需要：**
- 响应式设计优化
- 触控手势支持

---

#### 24. 图片文件夹作为漫画浏览
**原版：** 散装图片文件夹也能当漫画看

**Remake 需要：**
- 后端识别图片文件夹
- 前端支持文件夹阅读模式

---

## 技术栈对比

| 技术 | 原版 | Remake |
|------|------|--------|
| 后端框架 | Express.js | FastAPI |
| 数据库 | SQLite (better-sqlite3) | SQLite (SQLModel) |
| 前端框架 | React (Class Components) | React (Function Components) |
| 路由 | React Router v5 | TanStack Router |
| 状态管理 | Context API | TanStack Query |
| 样式 | SCSS + Bootstrap | Tailwind CSS + shadcn/ui |
| 构建工具 | Webpack | Vite |
| 文件名解析 | JavaScript | 需要 Python 实现 |
| 压缩包处理 | 7-Zip (node-7z) | py7zr |
| 图片处理 | ImageMagick (可选) | Pillow (可选) |

---

## 开发优先级建议

### 第一阶段 (核心功能)
1. 文件名解析器 (Python 版本)
2. 搜索功能 (全文/作者/标签)
3. 阅读历史系统
4. 排序和筛选
5. 文件操作 (移动/删除/重命名)

### 第二阶段 (重要功能)
6. 作者/标签页面
7. 相似文件查找
8. 首页增强
9. 音乐播放器
10. 漫画阅读器增强

### 第三阶段 (进阶功能)
11. 统计图表页面
12. 瀑布流/概览模式
13. Admin 页面增强
14. 视频播放器增强

### 第四阶段 (可选功能)
15. 压缩包内图片压缩
16. TamperMonkey 集成
17. 远程关机
18. 移动端优化

---

## 数据库 Schema 扩展建议

```sql
-- 解析元数据表
CREATE TABLE parsed_metadata (
    filepath TEXT PRIMARY KEY,
    title TEXT,
    author TEXT,
    authors TEXT,  -- JSON array
    tags TEXT,     -- JSON array
    raw_tags TEXT, -- JSON array
    char_names TEXT, -- JSON array
    extra_tags TEXT, -- JSON array
    event TEXT,    -- e.g., "C101"
    date_tag TEXT, -- e.g., "20220312"
    type TEXT,     -- e.g., "同人誌"
    parsed_at INTEGER
);

-- 作者表
CREATE TABLE authors (
    author_name TEXT PRIMARY KEY,
    file_count INTEGER DEFAULT 0,
    latest_work_path TEXT,
    latest_work_time INTEGER,
    score INTEGER DEFAULT 0
);

-- 标签表
CREATE TABLE tags (
    tag_name TEXT PRIMARY KEY,
    tag_type TEXT,  -- "parody", "comiket", "name", etc.
    file_count INTEGER DEFAULT 0,
    latest_work_path TEXT,
    latest_work_time INTEGER
);

-- 文件-作者关联表
CREATE TABLE file_authors (
    filepath TEXT,
    author_name TEXT,
    PRIMARY KEY (filepath, author_name)
);

-- 文件-标签关联表
CREATE TABLE file_tags (
    filepath TEXT,
    tag_name TEXT,
    PRIMARY KEY (filepath, tag_name)
);

-- 扩展 Progress 表
ALTER TABLE progress ADD COLUMN visit_count INTEGER DEFAULT 0;
ALTER TABLE progress ADD COLUMN last_visit_at INTEGER;
```

---

## API 端点总结

### 新增端点清单

```
# 解析
POST /api/v1/parse/batch
GET /api/v1/parse/cache

# 搜索
POST /api/v1/search/files
POST /api/v1/search/similar

# 历史
POST /api/v1/history/add
GET /api/v1/history/list
GET /api/v1/history/file

# 文件操作
POST /api/v1/fs/move
POST /api/v1/fs/delete
POST /api/v1/fs/rename
POST /api/v1/fs/zip_folder

# 标签/作者
GET /api/v1/tags/authors
GET /api/v1/tags/tags
GET /api/v1/tags/author/{author_name}
GET /api/v1/tags/tag/{tag_name}

# 统计
GET /api/v1/stats/by_time
GET /api/v1/stats/by_event
GET /api/v1/stats/by_type

# Admin
POST /api/v1/admin/pregenerate_thumbs
GET /api/v1/admin/cache_stats
POST /api/v1/admin/clear_cache
GET /api/v1/admin/server_info

# 压缩 (可选)
POST /api/v1/minify/check
POST /api/v1/minify/start
GET /api/v1/minify/queue
POST /api/v1/minify/overwrite

# 集成 (可选)
GET /api/v1/integration/ehentai

# 系统 (可选)
POST /api/v1/system/shutdown
```

---

## 前端路由总结

### 新增路由清单

```
/search          - 搜索结果页面
/similar         - 相似文件页面
/history         - 阅读历史页面
/authors         - 作者列表页面
/author/:name    - 单个作者的文件列表
/tags            - 标签列表页面
/tag/:name       - 单个标签的文件列表
/chart           - 统计图表页面
/overview        - 概览模式 (缩略图网格)
/waterfall       - 瀑布流模式
/admin           - 管理页面 (已有，需增强)
```

---

## 估算工作量

| 功能模块 | 后端工作量 | 前端工作量 | 总计 |
|---------|-----------|-----------|------|
| 文件名解析器 | 3-5 天 | 0.5 天 | 3.5-5.5 天 |
| 搜索功能 | 2-3 天 | 2-3 天 | 4-6 天 |
| 阅读历史 | 1-2 天 | 1-2 天 | 2-4 天 |
| 排序筛选 | 0.5 天 | 2-3 天 | 2.5-3.5 天 |
| 文件操作 | 2-3 天 | 2-3 天 | 4-6 天 |
| 作者/标签页面 | 2-3 天 | 3-4 天 | 5-7 天 |
| 相似文件查找 | 1-2 天 | 1-2 天 | 2-4 天 |
| 音乐播放器 | 0.5 天 | 2-3 天 | 2.5-3.5 天 |
| 阅读器增强 | 0.5 天 | 3-5 天 | 3.5-5.5 天 |
| 统计图表 | 2-3 天 | 3-4 天 | 5-7 天 |
| 其他功能 | 5-7 天 | 5-7 天 | 10-14 天 |
| **总计** | **20-30 天** | **25-35 天** | **45-65 天** |

---

## 注意事项

1. **文件名解析器是核心**：几乎所有高级功能都依赖它，必须优先实现
2. **数据库迁移**：需要编写 Alembic 迁移脚本添加新表
3. **性能优化**：原版使用 better-sqlite3 的同步 API，Remake 需要注意异步性能
4. **兼容性**：考虑是否需要兼容原版的数据库格式
5. **测试**：每个功能都需要充分测试，特别是文件操作相关功能

---

## 参考资料

- 原版项目：`D:\Git\ShiguReader`
- Remake 项目：`D:\Git\Shigureader-vibecode`
- 原版 API 文档：`D:\Git\ShiguReader\API.md`
- 原版使用说明：`D:\Git\ShiguReader\Readme_Usage.md`

---

**生成时间：** 2026-02-13 03:40 AM  
**版本：** v1.0
