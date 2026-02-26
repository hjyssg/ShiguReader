# Files 组件关系图

## 组件层级总览

```
FileViewContainer                          ← 顶层容器，被 Explorer / Search 页面使用
├── Toolbar（排序控件 + 视图切换按钮）
│
├── [viewMode = "grid"]
│   └── FileGridView
│       └── FileItem  ×N
│           ├── FileIcon                   ← 无缩略图时的占位图标
│           ├── ThumbnailImage             ← 有缩略图时展示（hover 显示 tooltip）
│           └── actionSlot = FileActionsDropdown（仅有 thumbnail_url 时挂载）
│               ├── [快捷按钮] ✓ 移到收藏
│               ├── [快捷按钮] ✗ 移到已读
│               ├── [快捷按钮] 🗑 删除
│               └── DropdownMenu
│                   └── FileActionMenuItems
│                       ├── DownloadMenuItem（非文件夹）
│                       ├── 重命名 / 移动 / 收藏 / 已读 / 删除
│                       └── 压缩 / 压缩图片（条件显示）
│
├── [viewMode = "table"]
│   └── FileTableView
│       └── ListTable
│           └── TableRowCells  ×N
│               └── FileNameLinkCell
│                   ├── FileIcon
│                   └── FileNameWithPreview  ← hover 显示缩略图 tooltip
│
└── [viewMode = "mixed"]
    ├── Folders 分组  → renderNameListItem（Link + FileIcon，响应式网格）
    ├── Videos 分组   → renderNameListItem（Link + FileIcon，响应式网格）
    └── Archives 分组 → FileGridView（同 grid 模式）
```

---

## 各组件职责

### FileViewContainer
顶层容器，负责：
- 排序（内部状态 or 受控，支持 name / type / mtime / likeScore / image_count / last_read_at）
- 分页（文件夹和视频固定展示在第一页，不参与分页计数；压缩包/图片/音频参与分页）
- 视图模式切换（grid / table / mixed）
- 将处理后的 `pagedItems` 分发给子视图

**使用方**：`Explorer`、`Search`

---

### FileGridView
纯展示，将 items 渲染为响应式网格，每项用 `FileItem`。
仅当 `item.thumbnail_url` 存在时才传入 `actionSlot`（即 `FileActionsDropdown`）。

---

### FileItem
单个文件卡片，包含：
- 文件名链接（`<a href>`，根据文件类型跳转不同路由）
- 缩略图（有 thumbnail_url 时）或 FileIcon 占位；有缩略图时 hover 显示 Tooltip
- 底部 info 区（文件大小、图片数、平均图片大小）
- `actionSlot`（由调用方传入，通常为 `FileActionsDropdown`）
- 可选 `metaText` / `metaTitle`（History 页面用于显示阅读时间）
- 可选 `thumbnailTooltip`（覆盖默认 tooltip 内容）

默认 thumbnail tooltip 内容：父目录路径 + 修改时间 + 评分 + 最后阅读时间。

**跳转规则**（`buildItemHref`）：
```
folder   → /explorer?path=
archive  → /read?path=&page=0[&mode=mobile]
video    → /video?path=&media=video
audio    → /read?path=&page=0&mode=audio
image    → /read?path=&page=0[&mode=mobile]
unknown  → null（不可点击）
```

---

### FileTableView
表格视图，列：名称 / 修改时间 / 类型 / 大小 / 评分 / 图片数 / 最后阅读。
列头可点击排序，委托给 `FileViewContainer.handleSortFieldChange`。

每行用 `FileNameLinkCell`：
```
FileNameLinkCell
├── FileIcon（sm 尺寸）
└── FileNameWithPreview（hover tooltip 显示缩略图）
```

---

### FileActionsDropdown
悬浮在 FileItem 卡片上的操作区，包含：
- 3 个快捷图标按钮（收藏 / 已读 / 删除）
- DropdownMenu → `FileActionMenuItems`

内部通过 `useFileOperationDialogs` 管理对话框状态，`dialogs` 节点直接渲染在组件内。

---

### FileActionMenuItems
纯菜单项集合（无外壳），被两处复用：
- `FileActionsDropdown`（Explorer/Search grid 卡片悬浮菜单，传 `showShortcuts`）
- `GalleryModeView`（Read 页面底部操作区）

包含的操作：
```
下载（DownloadMenuItem，非文件夹时显示）
重命名（F2）
移动到...
移到收藏夹
移到已读
删除（Del）
── 分隔线 ──（仅有压缩操作时）
压缩为 zip（仅文件夹，onCompressToZip 存在时）
压缩图片（仅压缩包，onMinifyZipImages 存在时）
```

可选 `onBackfillFolder`：Explorer 文件夹补全缩略图/元数据（仅 Explorer 传入）。

---

### DownloadMenuItem
单个下载菜单项，生成 `/api/v1/fs/download-full?path=` 链接，用 `<a download>` 触发浏览器下载。
仅在非文件夹时由 `FileActionMenuItems` 渲染。

---

### FileNameWithPreview
表格行中的文件名，hover 时弹出 Tooltip：
- 有缩略图 → 显示图片 + 父目录路径
- 无缩略图 → 仅显示父目录路径

---

### FileIcon
纯图标，根据 `fileType` 和 `isFolder` 返回对应 lucide 图标：
```
folder  → Folder（黄色）
image   → FileImage（绿色）
video   → FileVideo（紫色）
archive → FileArchive（翠绿）
audio   → FileAudio（蓝色）
其他    → File（灰色）
```

---

## 数据流

```
FileSystemItem[]
       │
       ▼
FileViewContainer
  ├── 排序 → sortedItems
  ├── 分页 → pagedItems（文件夹/视频固定第一页）
  │
  ├── grid  → FileGridView → FileItem
  │                              ├── href 由 buildItemHref 计算
  │                              └── actionSlot = FileActionsDropdown（有缩略图时）
  │                                       └── FileActionMenuItems
  │
  ├── table → FileTableView → FileNameLinkCell
  │                               └── FileNameWithPreview
  │
  └── mixed → folders/videos: renderNameListItem（Link + FileIcon）
              archives: FileGridView（同 grid）
```

---

## 跨页面复用关系

```
FileActionMenuItems
    ├── 被 FileActionsDropdown 使用（Explorer/Search grid 卡片）
    └── 被 GalleryModeView 使用（Read 页面底部 DropdownMenu）

FileViewContainer
    ├── 被 Explorer 页面使用（受控排序 + 分页）
    └── 被 Search 页面使用（内部排序 + 分页）

FileItem
    ├── 被 FileGridView 使用（Explorer / Search grid 模式）
    └── 被 History 页面直接使用（网格历史记录，无 actionSlot，带 metaText 显示阅读时间）

FileNameLinkCell
    ├── 被 FileTableView 使用（Explorer / Search table 模式）
    └── 被 History 页面 table 视图直接使用
```
