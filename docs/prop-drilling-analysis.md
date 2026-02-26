# 前端 Prop Drilling 分析

> 分析范围：`frontend/src` 目录下的路由页面与组件

---

## 1. ReadPage → GalleryModeView（最严重）

**文件：** `routes/_layout/read/index.tsx` → `routes/_layout/read/-GalleryModeView.tsx`

`ReadPage` 向 `GalleryModeView` 传递了 **14 个 props**，其中多个是仅用于"操作完成后导航"的回调：

```tsx
<GalleryModeView
  path={path}
  isFolderSource={isFolderSource}
  isArchiveSource={isArchiveSource}
  currentPage={currentPage}
  imageEntries={imageEntries}
  imagesReady={imagesReady}
  extractStatus={extractStatus}
  parseMeta={parseMeta}
  mtime={mtime}
  filesize={filesize}
  audioTracks={audioTracks}
  onAfterRename={() => navigate({ to: "/" })}
  onAfterDelete={() => navigate({ to: "/" })}
  onMoveSuccess={(destPath) => navigate(...)}
  onPageChange={goToPage}
/>
```

**问题：** `onAfterRename` / `onAfterDelete` / `onMoveSuccess` 只是 `navigate` 的包装，`GalleryModeView` 内部完全可以自己调用 `useNavigate()`，不需要从父级传入。

---

## 2. FileOperationMenuItems — 大量回调 props

**文件：** `components/Files/FileOperationMenuItems.tsx`

该组件接收 **8 个回调 props**：

```tsx
interface FileOperationMenuItemsProps {
  onRename: () => void
  onMove: () => void
  onMoveToFavorite: () => void
  onMoveToAlreadyRead: () => void
  onDelete: () => void
  onCompressToZip: () => void      // 可选
  onMinifyZipImages: () => void    // 可选
  onBackfillFolder?: () => void
}
```

调用方（`FileActionsDropdown`、`GalleryModeView`）需要把 `useFileOperationDialogs` 返回的所有 open* 方法逐一拆开传入。

**问题：** 可以直接传入一个 `operations` 对象或让组件内部接收 `filePath` 后自己调用 hook，而不是把每个操作都拆成独立 prop。

---

## 3. EntityListPage — 路由状态回调下钻

**文件：** `routes/_layout/_entities/authors.tsx` 等 → `components/Common/EntityListPage.tsx`

`EntityListPage` 接收来自路由页面的排序/分页状态及其回调：

```tsx
<EntityListPage
  page={page}
  sortBy={sortBy}
  sortOrder={sortOrder}
  onPageChange={onPageChange}
  onSortByChange={onSortByChange}
  onSortOrderToggle={onSortOrderToggle}
  // ...还有 title/description/apiEndpoint 等配置 props
/>
```

**问题：** `EntityListPage` 同时承担了"配置容器"和"状态消费者"两个角色，路由层的 URL 状态通过 props 一路传入，导致接口臃肿（共 ~15 个 props）。可以考虑将排序/分页状态提升到 `EntityListPage` 内部，或通过 context 传递。

---

## 4. FileTableView → TableRowCells — isMobile 下钻

**文件：** `components/Files/FileTableView.tsx`

```tsx
// FileTableView 调用 useIsMobile，然后传给每一行
const isMobile = useIsMobile()
// ...
<TableRowCells item={item} isMobile={isMobile} />
```

`TableRowCells` 只是用 `isMobile` 来调用 `buildNavigationTarget`。

**问题：** `TableRowCells` 可以直接调用 `useIsMobile()`，不需要从父组件传入。

---

## 5. FileViewContainer → FileGridView → FileItem — items 链式传递

**文件：** `FileViewContainer` → `FileGridView` → `FileItem`

```
FileViewContainer
  └─ FileGridView(items)
       └─ FileItem(item)  ×N
```

`FileViewContainer` 对 items 做排序/分页后传给 `FileGridView`，`FileGridView` 再逐个传给 `FileItem`。这是正常的列表渲染模式，但 `FileViewContainer` 同时还管理排序、视图切换、分页等状态，职责过重。

**问题：** 轻微，属于组件职责过重而非严格意义的 prop drilling，但如果后续需要在 `FileItem` 层面访问全局排序状态，会产生更深的 drilling。

---

## 6. FileContextMenu — 接收但未使用的 props（死代码）

**文件：** `components/Files/FileContextMenu.tsx`

```tsx
export function FileContextMenu({
  children,
  item: _item,                        // 未使用
  onContextMenuOpen: _onContextMenuOpen, // 未使用
}: FileContextMenuProps) {
  return <>{children}</>
}
```

`item` 和 `onContextMenuOpen` 被接收但完全未使用，是遗留的 prop drilling 残留。

---

## 总结

| 位置 | 类型 | 严重程度 |
|------|------|----------|
| ReadPage → GalleryModeView | 回调 props 可内化 | ⭐⭐⭐ 高 |
| FileOperationMenuItems | 回调 props 过多 | ⭐⭐⭐ 高 |
| EntityListPage | 配置+状态混合 props | ⭐⭐ 中 |
| FileTableView → TableRowCells | isMobile 传递 | ⭐ 低 |
| FileViewContainer → FileGridView → FileItem | 正常列表链 | ⭐ 低 |
| FileContextMenu | 死代码 props | ⭐ 低 |
