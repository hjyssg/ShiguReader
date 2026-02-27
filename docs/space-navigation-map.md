# 页面空间导航关系图

## 总览

```
                        ┌─────────────────────────────────────────────────────────────────┐
                        │                          Sidebar                                 │
                        │  Home | Explorer | History | Search | Authors | Tags | Cosers   │
                        └──────────────────────────┬──────────────────────────────────────┘
                                                   │ 全局导航
          ┌────────────────────┬───────────────────┼──────────────────┬────────────────────┐
          ▼                    ▼                   ▼                  ▼                    ▼
    ┌──────────┐        ┌──────────┐        ┌──────────┐      ┌──────────────┐    ┌──────────────┐
    │   Home   │        │ Explorer │        │  Search  │      │   History    │    │  Entities    │
    │   (/)    │        │/explorer │        │ /search  │      │  /history    │    │ /authors     │
    └────┬─────┘        └────┬─────┘        └────┬─────┘      └──────┬───────┘    │ /tags        │
         │                   │                   │                   │            │ /cosers      │
         │ 点击文件夹/驱动器   │ 点击文件/压缩包     │ 点击搜索结果        │ 点击历史条目  └──────┬───────┘
         │                   │                   │                   │                   │
         └──────────┬─────────┘                   └─────────┬─────────┘                   │
                    │                                       │                             │
                    ▼                                       │                             │
             ┌─────────────────────────────────────────────┘                             │
             │                                                                            │
             ▼                                                                            │
      ┌──────────────┐                                                                    │
      │     Read     │◄───────────────────────────────────────────────────────────────────┘
      │   /read      │                                          点击实体名 → Search (scope过滤)
      └──────┬───────┘
             │
             │ mode 切换（URL param）
             │
    ┌────────┴──────────────────────────────────────────────┐
    │                                                       │
    ▼                                                       ▼
┌──────────────────────────────────────────┐    ┌──────────────────────┐
│           gallery (默认)                  │    │       audio          │
│  - 单页图片 100vh                          │    │  - 音轨列表           │
│  - meta: authors / cosers / tags          │    │  - 小图翻页           │
│  - 操作: rotate / mobile / waterfall      │    │  - AudioPlayer       │
└──────────────────────────────────────────┘    └──────────────────────┘
         │              │         │                        │
         │              │         │                        │
         ▼              ▼         ▼                        ▼
  ┌──────────┐  ┌──────────┐  ┌──────────┐         ┌──────────┐
  │  mobile  │  │waterfall │  │ Explorer │         │  gallery │
  │ 全屏点击  │  │ 瀑布滚动  │  │(解压缓存) │         │  (返回)  │
  └────┬─────┘  └────┬─────┘  └──────────┘         └──────────┘
       │              │
       ▼              ▼
  ┌──────────┐  ┌──────────┐
  │  gallery │  │  gallery │
  │  (返回)  │  │ 点击跳转  │
  └──────────┘  └──────────┘
```

---

## 各空间详细说明

### Home `/`
- 展示：驱动器列表、特殊文件夹（favorite / already_read）、根目录、最近活动、常开文件夹
- **出口**：所有文件夹卡片 → `Explorer`

### Explorer `/explorer?path=`
- 展示：目录内容（文件夹 + 文件），支持排序/过滤/分页
- **入口**：Home、Search 结果、Read 内的"Explorer"按钮
- **出口**：
  - 点击文件夹 → `Explorer`（子目录）
  - 点击压缩包/文件夹 → `Read`
  - 扫描操作（原地）

### Read `/read?path=&page=&mode=`

Read 是一个多模式容器，`mode` 决定渲染哪个子视图：

| mode | 视图 | 说明 |
|------|------|------|
| `gallery`（默认）| GalleryModeView | 单页图片 + meta + 操作区 |
| `audio` | AudioModeView | 音轨列表 + 小图翻页 + 播放器 |
| `mobile` | MobileModeView | 全屏图片，点击左/右半翻页 |
| `waterfall` | WaterfallModeView | 所有图片纵向瀑布流 |

**数据来源**（`useArchiveExtract`）：
```
path 有压缩包扩展名  →  archive 模式  →  extractArchive API
path 无扩展名       →  folder 模式   →  listDirectory(path)
path 是图片/音频    →  sibling 模式  →  listDirectory(parentPath)
```

**gallery 模式出口**：
- `mode=mobile` → MobileModeView
- `mode=waterfall` → WaterfallModeView
- `mode=audio`（有音轨时自动跳转或手动）→ AudioModeView
- 点击 authors/cosers/tags badge → `Search`（scope 过滤）
- 点击 Explorer 按钮 → `Explorer`（解压缓存目录）

**audio 模式出口**：
- 点击 Images → `Read?mode=gallery`
- 点击 Explorer → `Explorer`（父目录）

**waterfall 模式出口**：
- 点击图片 → `Read?mode=gallery`（跳到对应页）
- 点击"打开阅读器"→ `Read?mode=gallery`

**mobile 模式出口**：
- 点击 X 关闭 → `Read?mode=gallery`（当前页）

### Search `/search?q=&scopes=&mode=&page=`
- 支持 scope：`file` / `author` / `coser` / `tag`
- 支持 mode：`exact` / `fuzzy`
- 支持 presenceFilter：`all` / `watched` / `scanned_recent`
- **入口**：Sidebar、Read gallery 的 meta badge、Entities 页面
- **出口**：搜索结果 → `Read` 或 `Explorer`（取决于文件类型）

### History `/history`
- 展示最近阅读记录，支持网格/列表视图
- **出口**：点击条目 → `Read` 或 `Explorer`

### Entities（Authors / Tags / Cosers）
```
/authors   →  EntityListPage  →  Search?scopes=["author"]
/tags      →  EntityListPage  →  Search?scopes=["tag"]
/cosers    →  EntityListPage  →  Search?scopes=["coser"]
```
- 三个页面共用 `EntityListPage` 组件
- 点击实体卡片 → `Search`（精确匹配对应 scope）

---

## 核心导航流

```
Home
 └─► Explorer ──────────────────────────────────────────────────────────┐
      └─► Read (gallery) ◄──────────────────────────────────────────────┤
               ├─► Read (mobile)  ──────────────────────────────────────┤
               │        └─► Read (gallery)                              │
               ├─► Read (waterfall) ─────────────────────────────────── ┤
               │        └─► Read (gallery)                              │
               ├─► Read (audio) ─────────────────────────────────────── ┤
               │        └─► Read (gallery)                              │
               ├─► Search (via author/coser/tag badge)                  │
               │        └─► Read / Explorer ◄──────────────────────────-┤
               └─► Explorer (解压缓存)                                   │
                                                                        │
History ────────────────────────────────────────────────────────────────┘
Authors / Tags / Cosers ──► Search ──► Read / Explorer
```
