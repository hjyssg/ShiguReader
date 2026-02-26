# Gallery 单页模式重写实现清单

## 文件变更

### 1. 新建 `read/-GalleryModeView.tsx`
- [ ] 从 index.tsx 抽出 gallery 模式全部逻辑
- [ ] 图片区 100vh，无上下 toolbar
- [ ] 图片下方放 meta 区：PathBreadcrumb、文件信息、authors/cosers/tags、模式切换、文件操作菜单
- [ ] 键盘快捷键移入此组件（删除 Enter 全屏热键）
- [ ] 保留：左右翻页、缩放、旋转、拖拽、wheel 缩放、preload、页码指示器

### 2. 修改 `read/index.tsx`
- [ ] gallery 分支改为 `<GalleryModeView />` 调用
- [ ] 删除 index.tsx 中 gallery 相关的 state/handler/JSX
- [ ] 删除 index.tsx 中的键盘事件监听（已移入 GalleryModeView）

### 3. 更新 `read/read.css`
- [ ] 新增 `.gallery-*` 样式（页面容器、图片舞台、下方 meta 区）
- [ ] 旧的 `.reader-toolbar` / `.reader-meta-bar` 样式保留（其他模式可能用）

### 4. 不变的部分
- MobileModeView / WaterfallModeView / AudioModeView 不动
- ReaderToolbar.tsx / ReaderMetaBar.tsx 组件文件保留




```
┌─────────────────────────────────┐
│                                 │
│         图片 (100vh)            │  ← 页面顶部就是图片，占满视口
│    左右点击区翻页 / 左右箭头      │
│                                 │
│   页码指示器 (右下角固定)         │
│                                 │
├─────────────────────────────────┤ ← 向下滚动才能看到
│                                 │
│  📂 PathBreadcrumb 面包屑导航    │
│  Meta 信息 (mtime/size/avg)     │
│  Authors / Cosers / Tags        │
│  操作菜单 (模式切换/文件操作)     │
│                                 │
└─────────────────────────────────┘
```

这样更简洁：打开就是全屏图片，往下滑才看到所有信息和操作。不需要任何自动 scrollTo 逻辑了。

图片的zoomin zoomout只有当鼠标在图片上面的时候才work。其他时候要留给页面的scroll