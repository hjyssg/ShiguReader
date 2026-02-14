
## Explorer 右键菜单 & Windows 风格交互 — 架构设计方案

我已经完整分析了现有代码，以下是详细的设计方案。

---

### 现状分析

- 当前 `FileItem` 和 `FileTableView` 用 `<Link>` 包裹整个条目，单击即导航
- 没有选择机制、没有右键菜单、没有键盘快捷键
- 后端已支持的 API：`move-file`, `move-folder`, `delete`, `rename`, `zip-folder`, `minify-zip-images`, `minify-folder-images`
- UI 组件库有 `dropdown-menu`, `dialog`, `checkbox`，但缺少 `context-menu`（需要新增）

---

### 架构设计（分层，方便未来 UI 变更）

```
frontend/src/
├── hooks/
│   └── useFileSelection.ts          # 选择状态管理（核心逻辑层）
│   └── useFileOperations.ts         # 文件操作 API 封装（mutation hooks）
│   └── useFileExplorerKeyboard.ts   # 键盘快捷键绑定
├── components/
│   └── ui/
│       └── context-menu.tsx          # shadcn context-menu 基础组件（新增）
│   └── Files/
│       ├── FileViewContainer.tsx     # 改造：注入 selection + context menu
│       ├── FileItem.tsx              # 改造：支持选择态 + 双击导航 + 右键菜单
│       ├── FileTableView.tsx         # 改造：支持选择态 + 双击导航 + 右键菜单
│       ├── FileContextMenu.tsx       # 新增：右键菜单 UI（纯展示层）
│       ├── FileSelectionToolbar.tsx  # 新增：批量选择时的操作工具栏
│       ├── dialogs/
│       │   ├── RenameDialog.tsx      # 重命名对话框
│       │   ├── MoveDialog.tsx        # 移动对话框（含目录选择器）
│       │   ├── DeleteDialog.tsx      # 删除确认对话框
│       │   └── CompressDialog.tsx    # 压缩/压图确认对话框
│       ├── FileIcon.tsx              # 不变
│       ├── FileNameWithPreview.tsx   # 不变
│       └── utils.ts                  # 不变
```

---

### 核心模块设计

#### 1. `useFileSelection` — 选择状态 Hook

```typescript
interface FileSelectionState {
  selectedPaths: Set<string>        // 已选文件路径集合
  lastSelectedPath: string | null   // 上次选中（用于 Shift 范围选择）
  isSelecting: boolean              // 是否处于选择模式
}

interface FileSelectionActions {
  select(path: string)              // 单选（替换）
  toggleSelect(path: string)        // Ctrl+点击 切换选择
  rangeSelect(path: string)         // Shift+点击 范围选择
  selectAll()                       // Ctrl+A 全选
  clearSelection()                  // 清空选择
  isSelected(path: string): boolean
}
```

- 用 `useState` 管理，不需要全局状态
- 传入 `sortedItems` 列表用于计算 Shift 范围选择

#### 2. `useFileOperations` — 文件操作 Mutations

```typescript
// 封装所有后端 API 调用，统一 loading/error/success 处理
function useFileOperations(currentPath: string) {
  return {
    renameMutation,      // POST /fs/rename
    deleteMutation,      // DELETE /fs/delete
    moveMutation,        // POST /fs/move-file 或 move-folder
    zipFolderMutation,   // POST /fs/zip-folder
    minifyZipMutation,   // POST /fs/minify-zip-images
    minifyFolderMutation,// POST /fs/minify-folder-images
    addToFavorite,       // POST /fs/add-favorite-dir
  }
}
```

- 每个 mutation 成功后自动 `invalidateQueries(["fs-list", currentPath])` 刷新列表

#### 3. `useFileExplorerKeyboard` — 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+A` | 全选 |
| `Delete` | 删除选中项 |
| `F2` | 重命名（单选时） |
| `Ctrl+C` / `Ctrl+X` | 复制/剪切路径（预留） |
| `Ctrl+V` | 粘贴/移动（预留） |
| `Escape` | 取消选择 |
| `Enter` | 打开选中项 |

#### 4. `FileContextMenu` — 右键菜单

```
┌─────────────────────────┐
│ Open                    │  ← 双击等效
│ Open in New Tab         │  ← Ctrl+点击等效
│ ─────────────────────── │
│ Rename              F2  │
│ Move to...              │  ← 弹出目录选择器
│ Move to Favorites       │
│ Delete             Del  │
│ ─────────────────────── │
│ Compress to ZIP         │  ← 仅文件夹
│ Minify ZIP Images       │  ← 仅 archive
│ Minify Folder Images    │  ← 仅文件夹
│ ─────────────────────── │
│ Select All      Ctrl+A  │
└─────────────────────────┘
```

- 根据 `item.item_type` 和 `item.file_type` 动态显示/隐藏菜单项
- 批量选择时显示 "Delete X items"、"Move X items" 等

#### 5. 交互行为改造

| 操作 | 行为 |
|------|------|
| 单击 | 选中该项（清除其他选择） |
| Ctrl+单击 | 切换该项选择状态 |
| Shift+单击 | 范围选择 |
| 双击 | 打开（导航到对应页面） |
| 右键 | 选中 + 弹出上下文菜单 |
| Ctrl+双击 / Ctrl+Enter | 新标签页打开 |
| 空白区域单击 | 清除所有选择 |

这意味着需要把 `FileItem` 和 `FileTableView` 中的 `<Link>` 包裹改为事件驱动的导航。

#### 6. `FileSelectionToolbar` — 批量操作栏

选中 ≥1 项时，在工具栏区域显示：
```
[✓ 3 items selected]  [Move]  [Delete]  [Clear Selection]
```

---

### 实施步骤

1. 安装 `@radix-ui/react-context-menu`，创建 `ui/context-menu.tsx`
2. 实现 `useFileSelection` hook
3. 实现 `useFileOperations` hook（封装已有后端 API）
4. 实现 `useFileExplorerKeyboard` hook
5. 创建 `FileContextMenu` 组件
6. 创建 `dialogs/` 下的 4 个对话框组件
7. 改造 `FileItem.tsx` — 去掉 Link 包裹，改为 onClick/onDoubleClick/onContextMenu
8. 改造 `FileTableView.tsx` — 同上
9. 改造 `FileViewContainer.tsx` — 集成 selection state、toolbar、keyboard
10. 创建 `FileSelectionToolbar` 组件

---

### 设计原则

- **逻辑与 UI 分离**：所有状态和操作在 hooks 中，UI 组件只负责渲染。未来换 UI 只需改组件，不动 hooks
- **渐进增强**：不破坏现有功能，先加选择和右键菜单，再逐步完善
- **后端 API 复用**：不需要新增后端接口，全部使用已有的 `/fs/*` 端点

---

你觉得这个方案怎么样？有什么要调整的吗？确认后我会生成一个 markdown 文件给你 review，然后你可以 toggle to Act mode 让我开始实现。
