# 前端代码概览

## 技术栈

| 技术 | 用途 |
|------|------|
| React 18 | UI 框架 |
| TypeScript | 类型安全 |
| TanStack Router | 文件路由，URL search 参数类型安全 |
| TanStack Query | 服务端状态管理（fetch + 缓存） |
| Tailwind CSS | 原子化样式 |
| shadcn/ui | 基础 UI 组件库（Button, Dialog, Select 等） |
| Lucide React | 图标库 |
| i18next | 国际化（zh/en/ja/ko） |
| Vite | 构建工具 |
| Biome | Lint + Format |

---

## 路由结构

```
__root.tsx          根路由，挂载 HeadContent + Outlet
_layout.tsx         布局路由
                    - 阅读器路由（/read /video /audio 等）→ 直接 Outlet（无侧边栏）
                    - 其他路由 → AppSidebar + SidebarInset 包裹

_layout/
  index.tsx         首页：驱动器、特殊文件夹、快捷访问、最近活动
  explorer.tsx      文件浏览器：目录浏览、排序、过滤、扫描
  archive.tsx       压缩包查看器：列出内容，支持图片/视频/音频预览
  read.tsx          图片阅读器：缩放/旋转/拖拽，键盘快捷键，文件操作
  read-mobile.tsx   移动端阅读器（yet-another-react-lightbox）
  read-waterfall.tsx 瀑布流阅读器
  video.tsx         视频播放器：进度持久化（localStorage）
  audio.tsx         音频播放器：播放列表 + 封面
  search.tsx        搜索：file/author/coser/tag 多维度
  history.tsx       阅读历史：网格/列表视图
  tags.tsx          标签列表
  authors.tsx       作者列表
  cosers.tsx        Coser 列表
  settings.tsx      设置：路径配置、语言、缓存、扫描
```

---

## 共用组件

### Common/
| 组件 | 说明 |
|------|------|
| `PathBreadcrumb` | 路径面包屑，支持折叠、自定义样式，read/video/audio 均使用 |
| `EntityGrid` | 实体卡片网格 + 分页，authors/tags/cosers 共用 |
| `EntityListPage` | 封装排序控件 + EntityGrid，authors/tags/cosers 页面直接使用 |
| `EntityCard` | 单个实体卡片（缩略图 + 名称 + 文件数） |
| `ThumbnailImage` | 懒加载缩略图，带 fallback |
| `SortDirectionToggle` | 升/降序切换按钮 |
| `UnifiedPagination` | 统一分页控件 |
| `FileNotFoundError` | 文件不存在错误页 |
| `ErrorComponent` | 通用错误边界组件 |
| `NotFound` | 404 页面 |

### Files/
| 组件 | 说明 |
|------|------|
| `FileViewContainer` | 切换网格/列表视图的容器，explorer/archive 使用 |
| `FileGridView` | 文件网格视图 |
| `FileTableView` | 文件表格视图 |
| `FileItem` | 单个文件项（网格模式） |
| `FileContextMenu` | 右键菜单（重命名/移动/删除等） |
| `FileSelectionToolbar` | 多选操作工具栏 |
| `FileNameWithPreview` | 文件名 + hover 预览 |
| `dialogs/` | RenameDialog / DeleteDialog / MoveDialog / CompressDialog / ConfirmMoveDialog |

### semantic/layout.tsx
| 组件 | 说明 |
|------|------|
| `ExtractingIndicator` | 压缩包解压进度指示器，read 页面使用 |

### Sidebar/
| 组件 | 说明 |
|------|------|
| `AppSidebar` | 主侧边栏，包含导航链接 |

---

## 各页面技术要点

### explorer
- `FileViewContainer` 切换网格/列表
- URL search 参数：`path / page / pageSize / sortField / sortOrder`
- 面包屑导航 + 扫描触发

### authors / tags / cosers
- 共用 `EntityListPage` 组件（排序 + EntityGrid）
- 点击条目跳转 `/search?scopes={type}&q={name}`

### read
- 布局：`reader-page`（flex 列，100vh）= toolbar + image-stage + meta-bar
- 压缩包模式：先 `extractArchive` 解压，再按页加载图片
- 文件夹模式：直接 `listDirectory` 获取图片列表
- 预加载前后页；键盘快捷键（方向键/AD翻页、+/-缩放、Enter全屏、G跳页）
- 底部 meta bar：mtime/size/avgImageSize（title tooltip）+ 作者/coser/标签（可点击 Badge）

### video
- 复用 `reader-page` / `reader-toolbar` / `reader-meta-bar` CSS 类
- 播放进度持久化：`localStorage` key = `media-progress:video:{path}:{entry}`
- 底部 meta bar：mtime / size（title tooltip）

### audio
- 复用 `reader-page` / `reader-toolbar` / `reader-meta-bar` CSS 类
- 使用 `react-h5-audio-player`
- 自动提取封面图（第一张图片）
- 底部 meta bar：mtime / size（title tooltip）

---

## Hooks

| Hook | 说明 |
|------|------|
| `useDocumentTitle` | 设置页面 title |
| `useFileOperations` | 封装重命名/移动/删除/压缩等文件操作 mutation |
| `useResolveMovedFile` | 文件被移动后自动查找新路径 |
| `useCustomToast` | 封装 sonner toast |

---

## API 客户端

`src/client/` 由 openapi-ts 自动生成，包含：
- `FilesystemService` — 文件系统操作（listDirectory / listArchive / extractArchive 等）
- `ParseService` — 解析文件元数据（作者/标签/coser）
- `OpenAPI.BASE` — API base URL
