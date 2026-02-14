# Explorer 右键菜单 & Windows 风格交互 — 设计文档

## 目标

为 Explorer 文件列表添加类似 Windows 文件管理器的交互体验：
- 右键上下文菜单（Move / Delete / Rename / Move to Favorites / Minify / Compress）
- 双击打开，Ctrl+点击新标签页打开
- 批量选择（Ctrl+Click / Shift+Click / Ctrl+A）
- 键盘快捷键（Delete / F2 / Escape / Enter）

## 架构

```
hooks/
  useFileSelection.ts          — 选择状态管理
  useFileOperations.ts         — 文件操作 API mutations
  useFileNavigation.ts         — 文件导航（打开/新标签页）
  useFileExplorerKeyboard.ts   — 键盘快捷键

components/Files/
  FileContextMenu.tsx          — 右键菜单 UI
  FileSelectionToolbar.tsx     — 批量操作工具栏
  dialogs/
    RenameDialog.tsx
    MoveDialog.tsx
    DeleteDialog.tsx
    CompressDialog.tsx

components/ui/
  context-menu.tsx             — shadcn/radix context-menu 基础组件
```

## 交互规则

| 操作 | 行为 |
|------|------|
| 单击 | 选中该项 |
| Ctrl+单击 | 切换选择 |
| Shift+单击 | 范围选择 |
| 双击 | 打开（导航） |
| 右键 | 选中 + 上下文菜单 |
| Ctrl+双击 | 新标签页打开 |
| Delete | 删除选中 |
| F2 | 重命名 |
| Ctrl+A | 全选 |
| Escape | 取消选择 |

## 右键菜单项

- Open / Open in New Tab
- Rename (F2)
- Move to... / Move to Favorites
- Delete (Del)
- Compress to ZIP（仅文件夹）
- Minify ZIP Images（仅 archive）
- Select All (Ctrl+A)

## 后端 API（已有）

- `POST /fs/rename` — { path, new_name }
- `DELETE /fs/delete` — { path }
- `POST /fs/move-file` / `POST /fs/move-folder` — { source_path, dest_path }
- `POST /fs/zip-folder` — { folder_path }
- `POST /fs/archive/compress-images` — { archive_path }
- `GET /fs/favorite` — 获取收藏夹目录

## 实施记录

- [x] Step 1: 安装 @radix-ui/react-context-menu，创建 ui/context-menu.tsx
- [x] Step 2: 实现 useFileSelection hook（单选/Ctrl多选/Shift范围选择）
- [x] Step 3: 实现 useFileOperations hook（封装所有后端 API mutations）
- [x] Step 4: 实现 useFileNavigation hook（双击打开/新标签页打开）
- [x] Step 5: 实现 useFileExplorerKeyboard hook（Ctrl+A/Delete/F2/Escape/Enter）
- [x] Step 6: 创建 FileContextMenu 组件（根据文件类型动态菜单）
- [x] Step 7: 创建 dialogs（RenameDialog/MoveDialog/DeleteDialog/CompressDialog）
- [x] Step 8: 改造 FileItem.tsx（去掉 Link 包裹，改为事件驱动 + 选择态高亮）
- [x] Step 9: 改造 FileTableView.tsx（支持选择/双击/右键菜单）
- [x] Step 10: 改造 FileViewContainer.tsx（集成所有 hooks + 对话框 + 工具栏）
- [x] Step 11: 创建 FileSelectionToolbar 组件（批量操作栏）
- [x] Step 12: 更新 explorer.tsx 传入 currentPath
- [x] Step 13: TypeScript 编译验证通过

### 二次迭代（按反馈修正）

- [x] A1: FileSelectionToolbar 始终占位显示（0 selected 时 `visibility: hidden`），避免布局抖动
- [x] A2: 右键菜单宽度从 `w-56` 调整为 `w-64`，避免 "Open in New Tab" 换行
- [x] A3: 文件区点击空白取消选中（容器内空白）
- [x] A4: 文件区添加 `select-none`，去除浏览器默认蓝色文本选中效果
- [x] B1: `ContentWrapper` 宽度改为 `w-full max-w-[1800px]`（更接近父容器，便于后续你自己调）
- [x] B2: Grid 视图间距从 `gap-4` 调整到 `gap-6`
- [x] B3: 点击 `file-list-container` 外部也会取消选中（`document pointerdown capture` outside-click）
- [x] B4: `Ctrl/Cmd + 单击` 改为像链接一样直接新标签打开；`Shift+单击` 保持范围选择
- [x] B5: 评估第三方库：无需新增 npm 依赖，原生事件 + 现有架构即可稳定实现

### 三次迭代（交互规则再调整）

- [x] C1: `Ctrl/Cmd + 单击` 从“新标签打开”改回“多选切换”
- [x] C2: 双击统一改为 `Open in New Tab`
- [x] C3: 右键菜单删除 `Open`（直接跳转）项，仅保留 `Open in New Tab`
- [x] C4: `Enter` 键行为与新规则对齐为“新标签打开选中项”

## 新增/修改文件清单

### 新增文件
- `frontend/src/components/ui/context-menu.tsx`
- `frontend/src/hooks/useFileSelection.ts`
- `frontend/src/hooks/useFileOperations.ts`
- `frontend/src/hooks/useFileNavigation.ts`
- `frontend/src/hooks/useFileExplorerKeyboard.ts`
- `frontend/src/components/Files/FileContextMenu.tsx`
- `frontend/src/components/Files/FileSelectionToolbar.tsx`
- `frontend/src/components/Files/dialogs/RenameDialog.tsx`
- `frontend/src/components/Files/dialogs/DeleteDialog.tsx`
- `frontend/src/components/Files/dialogs/MoveDialog.tsx`
- `frontend/src/components/Files/dialogs/CompressDialog.tsx`

### 修改文件
- `frontend/src/components/Files/FileItem.tsx` — 去掉 Link 包裹，改为 onClick/onDoubleClick/onContextMenu + 选择态高亮
- `frontend/src/components/Files/FileTableView.tsx` — 添加选择/双击/右键菜单支持
- `frontend/src/components/Files/FileViewContainer.tsx` — 集成所有 hooks、对话框、工具栏
- `frontend/src/routes/_layout/explorer.tsx` — 传入 currentPath prop
- `frontend/package.json` — 新增 @radix-ui/react-context-menu 依赖
- `frontend/src/components/semantic/layout.tsx` — `ContentWrapper` 宽度放大；`ResponsiveGrid` 间距改为 `gap-6`
- `frontend/src/components/Files/FileSelectionToolbar.tsx` — 始终占位显示，避免抖动
- `frontend/src/components/Files/FileContextMenu.tsx` — 菜单宽度调大为 `w-64`
- `frontend/src/components/Files/FileViewContainer.tsx` — outside-click 清空选择、Ctrl/Cmd+单击新标签打开、select-none 等交互优化
- `frontend/src/components/Files/FileViewContainer.tsx` — 交互再调整：Ctrl/Cmd+单击恢复多选、双击改新标签、Enter 改新标签
- `frontend/src/components/Files/FileContextMenu.tsx` — 移除 Open 直接跳转菜单项，仅保留 Open in New Tab
