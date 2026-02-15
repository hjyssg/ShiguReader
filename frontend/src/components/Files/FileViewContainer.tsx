// 文件视图容器 — 集成选择、右键菜单、键盘快捷键、对话框
import { LayoutGrid, List, LayoutList, ArrowDown, ArrowUp } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { FileSystemItem } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Toolbar, ToolbarGroup, ResponsiveGrid } from "@/components/semantic/layout"
import { cn } from "@/lib/utils"

import { useFileSelection } from "@/hooks/useFileSelection"
import { useFileNavigation } from "@/hooks/useFileNavigation"
import { useFileOperations } from "@/hooks/useFileOperations"
import { useFileExplorerKeyboard } from "@/hooks/useFileExplorerKeyboard"

import { FileTableView, type SortField, type SortOrder } from "./FileTableView"
import { FileIcon } from "./FileIcon"
import { FileItem } from "./FileItem"
import { FileContextMenu } from "./FileContextMenu"
import { FileSelectionToolbar } from "./FileSelectionToolbar"
import { RenameDialog } from "./dialogs/RenameDialog"
import { DeleteDialog } from "./dialogs/DeleteDialog"
import { MoveDialog } from "./dialogs/MoveDialog"
import { CompressDialog, type CompressAction } from "./dialogs/CompressDialog"
import { ConfirmMoveDialog } from "./dialogs/ConfirmMoveDialog"
import { getBaseName } from "@/lib/path-utils"

type ViewMode = "grid" | "details" | "mixed"

export function FileViewContainer({
  items,
  isLoading,
  currentPath = "",
  initialViewMode = "grid",
  initialSortField = "type",
  initialSortOrder = "asc",
  storageKeyPrefix = "file-list",
  toolbarExtra,
  emptyText = "This folder is empty",
}: {
  items: FileSystemItem[]
  isLoading: boolean
  currentPath?: string
  initialViewMode?: ViewMode
  initialSortField?: SortField
  initialSortOrder?: SortOrder
  storageKeyPrefix?: string
  toolbarExtra?: ReactNode
  emptyText?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  // View mode & sort state
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(`${storageKeyPrefix}-view-mode`)
    return (saved as ViewMode) || initialViewMode
  })
  const [sortField, setSortField] = useState<SortField>(() => {
    const saved = localStorage.getItem(`${storageKeyPrefix}-sort-field`)
    return (saved as SortField) || initialSortField
  })
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    const saved = localStorage.getItem(`${storageKeyPrefix}-sort-order`)
    return (saved as SortOrder) || initialSortOrder
  })

  useEffect(() => {
    localStorage.setItem(`${storageKeyPrefix}-view-mode`, viewMode)
  }, [storageKeyPrefix, viewMode])
  useEffect(() => {
    localStorage.setItem(`${storageKeyPrefix}-sort-field`, sortField)
  }, [storageKeyPrefix, sortField])
  useEffect(() => {
    localStorage.setItem(`${storageKeyPrefix}-sort-order`, sortOrder)
  }, [storageKeyPrefix, sortOrder])

  // Sorted items
  const sortedItems = useMemo(() => {
    if (!items) return []
    const list = items.filter((item) => {
      if (item.item_type === "folder") return true
      return item.file_type !== "unknown"
    })

    list.sort((a, b) => {
      if (a.item_type !== b.item_type) {
        return a.item_type === "folder" ? -1 : 1
      }

      let comparison = 0
      if (sortField === "name") {
        comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      } else if (sortField === "type") {
        const typeA = a.file_type || "unknown"
        const typeB = b.file_type || "unknown"
        comparison = typeA.localeCompare(typeB)
        if (comparison === 0) {
          comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        }
      } else if (sortField === "image_count") {
        const imageCountA = (a.image_count ?? 0)
        const imageCountB = (b.image_count ?? 0)
        comparison = imageCountA - imageCountB
        if (comparison === 0) {
          comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        }
      } else if (sortField === "recommendation") {
        const scoreA = (a as any).recommendation_score || 0
        const scoreB = (b as any).recommendation_score || 0
        comparison = scoreA - scoreB
        if (comparison === 0) {
          comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        }
      } else {
        const mtimeA = a.mtime || 0
        const mtimeB = b.mtime || 0
        comparison = mtimeB - mtimeA
      }

      return sortOrder === "asc" ? comparison : -comparison
    })

    return list
  }, [items, sortField, sortOrder])

  // Selection
  const selection = useFileSelection()
  const { openItem, openItemInNewTab, isOpenable } = useFileNavigation()
  const operations = useFileOperations(currentPath)

  // Dialog state
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [compressDialogOpen, setCompressDialogOpen] = useState(false)
  const [compressAction, setCompressAction] = useState<CompressAction>("zip-folder")
  const [confirmFavoriteOpen, setConfirmFavoriteOpen] = useState(false)
  const [confirmAlreadyReadOpen, setConfirmAlreadyReadOpen] = useState(false)
  // 右键菜单操作的目标项
  const [contextItem, setContextItem] = useState<FileSystemItem | null>(null)

  const anyDialogOpen = renameDialogOpen || deleteDialogOpen || moveDialogOpen || compressDialogOpen || confirmFavoriteOpen || confirmAlreadyReadOpen

  // 获取当前操作目标路径
  const getTargetPaths = useCallback((): string[] => {
    if (selection.selectedCount > 0) {
      return Array.from(selection.selectedPaths)
    }
    if (contextItem) {
      return [contextItem.path]
    }
    return []
  }, [selection.selectedPaths, selection.selectedCount, contextItem])

  const getFirstSelectedItem = useCallback((): FileSystemItem | null => {
    const paths = getTargetPaths()
    if (paths.length === 0) return null
    return sortedItems.find((i) => i.path === paths[0]) || null
  }, [getTargetPaths, sortedItems])

  // 操作回调
  const handleOpenRename = useCallback(() => {
    if (selection.selectedCount === 1) {
      setRenameDialogOpen(true)
    }
  }, [selection.selectedCount])

  const handleOpenDelete = useCallback(() => {
    if (getTargetPaths().length > 0) {
      setDeleteDialogOpen(true)
    }
  }, [getTargetPaths])

  const handleOpenMove = useCallback(() => {
    if (getTargetPaths().length > 0) {
      setMoveDialogOpen(true)
    }
  }, [getTargetPaths])

  const handleMoveToFavorite = useCallback(() => {
    if (getTargetPaths().length > 0) {
      setConfirmFavoriteOpen(true)
    }
  }, [getTargetPaths])

  const handleConfirmMoveToFavorite = useCallback(() => {
    const paths = getTargetPaths()
    for (const p of paths) {
      const item = sortedItems.find((i) => i.path === p)
      if (item) {
        operations.moveToFavoriteMutation.mutate({
          sourcePath: p,
          isFolder: item.item_type === "folder",
        })
      }
    }
    setConfirmFavoriteOpen(false)
    selection.clearSelection()
  }, [getTargetPaths, sortedItems, operations.moveToFavoriteMutation, selection])

  const handleMoveToAlreadyRead = useCallback(() => {
    if (getTargetPaths().length > 0) {
      setConfirmAlreadyReadOpen(true)
    }
  }, [getTargetPaths])

  const handleConfirmMoveToAlreadyRead = useCallback(() => {
    const paths = getTargetPaths()
    for (const p of paths) {
      const item = sortedItems.find((i) => i.path === p)
      if (item) {
        operations.moveToAlreadyReadMutation.mutate({
          sourcePath: p,
          isFolder: item.item_type === "folder",
        })
      }
    }
    setConfirmAlreadyReadOpen(false)
    selection.clearSelection()
  }, [getTargetPaths, sortedItems, operations.moveToAlreadyReadMutation, selection])

  const handleOpenFirst = useCallback(() => {
    const item = getFirstSelectedItem()
    if (item) openItemInNewTab(item)
  }, [getFirstSelectedItem, openItemInNewTab])

  // 点击事件处理
  const handleItemClick = useCallback(
    (item: FileSystemItem, e: React.MouseEvent) => {
      // Ctrl/Cmd + 点击改回多选切换；Shift 保持范围选择
      selection.handleClick(item.path, e, sortedItems)
    },
    [selection, sortedItems],
  )

  const handleItemDoubleClick = useCallback(
    (item: FileSystemItem, _e: React.MouseEvent) => {
      // 文件夹双击：当前页面跳转；文件双击：新标签页打开
      if (item.item_type === "folder") {
        openItem(item)
      } else {
        openItemInNewTab(item)
      }
    },
    [openItem, openItemInNewTab],
  )

  const handleItemContextMenu = useCallback(
    (item: FileSystemItem) => {
      setContextItem(item)
      selection.handleContextMenu(item.path)
    },
    [selection],
  )

  // 空白区域点击清除选择
  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement
      // 点击文件项内部不清除（由 item 自己的 onClick 处理）
      if (target.closest(".file-item-wrapper") || target.closest("tr.cursor-pointer")) {
        return
      }
      selection.clearSelection()
    },
    [selection],
  )

  // 点击 file-list-container 外部也清除选择
  useEffect(() => {
    const handleDocumentPointerDown = (event: PointerEvent) => {
      if (anyDialogOpen) return
      // 仅左键
      if (event.button !== 0) return

      const container = containerRef.current
      const target = event.target as HTMLElement | null
      if (!container || !target) return

      // 点击容器内部，不处理
      if (container.contains(target)) return

      selection.clearSelection()
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown, true)
    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown, true)
    }
  }, [anyDialogOpen, selection.clearSelection])

  // 键盘快捷键
  useFileExplorerKeyboard({
    items: sortedItems,
    selectedPaths: selection.selectedPaths,
    selectAll: selection.selectAll,
    clearSelection: selection.clearSelection,
    onDelete: handleOpenDelete,
    onRename: handleOpenRename,
    onOpen: handleOpenFirst,
    containerRef,
    dialogOpen: anyDialogOpen,
  })

  // 构建右键菜单 actions
  const buildContextMenuActions = useCallback(
    (item: FileSystemItem) => ({
      onOpen: () => {
        // 文件夹：当前页面跳转；文件：新标签页打开
        if (item.item_type === "folder") {
          openItem(item)
        } else {
          openItemInNewTab(item)
        }
      },
      onOpenInNewTab: () => openItemInNewTab(item),
      onRename: () => {
        selection.select(item.path)
        setRenameDialogOpen(true)
      },
      onMove: () => {
        if (!selection.isSelected(item.path)) {
          selection.select(item.path)
        }
        setMoveDialogOpen(true)
      },
      onMoveToFavorite: () => {
        if (!selection.isSelected(item.path)) {
          selection.select(item.path)
        }
        handleMoveToFavorite()
      },
      onMoveToAlreadyRead: () => {
        if (!selection.isSelected(item.path)) {
          selection.select(item.path)
        }
        handleMoveToAlreadyRead()
      },
      onBackfillFolder: () => {
        operations.backfillFolderMutation.mutate(item.path)
      },
      onDelete: () => {
        if (!selection.isSelected(item.path)) {
          selection.select(item.path)
        }
        setDeleteDialogOpen(true)
      },
      onZipFolder: () => {
        setCompressAction("zip-folder")
        setContextItem(item)
        setCompressDialogOpen(true)
      },
      onMinifyZipImages: () => {
        setCompressAction("minify-zip-images")
        setContextItem(item)
        setCompressDialogOpen(true)
      },
      onSelectAll: () => selection.selectAll(sortedItems),
    }),
    [openItem, openItemInNewTab, selection, sortedItems, handleMoveToFavorite, handleMoveToAlreadyRead, operations.backfillFolderMutation],
  )

  // Mixed view: group items by type
  const mixedGroups = useMemo(() => {
    if (viewMode !== "mixed") return { folders: [], videos: [], archives: [] }
    const folders = sortedItems.filter((i) => i.item_type === "folder")
    const videos = sortedItems.filter((i) => i.item_type === "file" && i.file_type === "video")
    const archives = sortedItems.filter((i) => i.item_type === "file" && i.file_type !== "video")
    return { folders, videos, archives }
  }, [viewMode, sortedItems])

  // 混合视图：文件名列表行渲染（用于 folder / video section）
  const renderNameListItem = useCallback(
    (item: FileSystemItem) => (
      <FileContextMenu
        key={item.path}
        item={item}
        selectedCount={selection.selectedCount}
        isOpenable={isOpenable(item)}
        actions={buildContextMenuActions(item)}
        onContextMenuOpen={() => handleItemContextMenu(item)}
      >
        <div
          className={cn(
            "file-item-wrapper flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer hover:bg-accent transition-colors",
            selection.isSelected(item.path) && "bg-accent ring-1 ring-primary",
          )}
          onClick={(e) => handleItemClick(item, e)}
          onDoubleClick={(e) => handleItemDoubleClick(item, e)}
        >
          <FileIcon fileType={item.file_type} isFolder={item.item_type === "folder"} size="sm" />
          <span className="text-sm truncate" title={item.name}>{item.name}</span>
        </div>
      </FileContextMenu>
    ),
    [selection, isOpenable, buildContextMenuActions, handleItemContextMenu, handleItemClick, handleItemDoubleClick],
  )

  const handleSortFieldChange = (field: SortField) => {
    if (field === sortField) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
      return
    }
    setSortField(field)
    setSortOrder("asc")
  }

  // Dialog confirm handlers
  const handleRenameConfirm = useCallback(
    (newName: string) => {
      const paths = getTargetPaths()
      if (paths.length === 1) {
        operations.renameMutation.mutate(
          { path: paths[0], newName },
          { onSuccess: () => { setRenameDialogOpen(false); selection.clearSelection() } },
        )
      }
    },
    [getTargetPaths, operations.renameMutation, selection],
  )

  const handleDeleteConfirm = useCallback(() => {
    const paths = getTargetPaths()
    if (paths.length === 1) {
      operations.deleteMutation.mutate(paths[0], {
        onSuccess: () => { setDeleteDialogOpen(false); selection.clearSelection() },
      })
    } else if (paths.length > 1) {
      operations.deleteBatchMutation.mutate(paths, {
        onSuccess: () => { setDeleteDialogOpen(false); selection.clearSelection() },
      })
    }
  }, [getTargetPaths, operations.deleteMutation, operations.deleteBatchMutation, selection])

  const handleMoveConfirm = useCallback(
    (destDir: string) => {
      const paths = getTargetPaths()
      for (const p of paths) {
        const item = sortedItems.find((i) => i.path === p)
        if (item) {
          const fileName = getBaseName(p)
          const destPath = `${destDir}/${fileName}`
          operations.move(p, destPath, item.item_type === "folder")
        }
      }
      setMoveDialogOpen(false)
      selection.clearSelection()
    },
    [getTargetPaths, sortedItems, operations, selection],
  )

  const handleCompressConfirm = useCallback(() => {
    if (!contextItem) return
    if (compressAction === "zip-folder") {
      operations.zipFolderMutation.mutate(contextItem.path, {
        onSuccess: () => setCompressDialogOpen(false),
      })
    } else {
      operations.compressArchiveImagesMutation.mutate(contextItem.path, {
        onSuccess: () => setCompressDialogOpen(false),
      })
    }
  }, [contextItem, compressAction, operations.zipFolderMutation, operations.compressArchiveImagesMutation])

  return (
    <div className="file-list-container space-y-4 select-none" ref={containerRef} onClick={handleContainerClick}>
      {/* Toolbar */}
      <Toolbar className="file-list-toolbar">
        <ToolbarGroup className="sort-controls">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="type">Type</SelectItem>
              <SelectItem value="mtime">Date Modified</SelectItem>
              <SelectItem value="recommendation">Recommendation</SelectItem>
              <SelectItem value="image_count">Image Count</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="h-8 w-8 p-0"
          >
            {sortOrder === "asc" ? (
              <ArrowUp className="size-4" />
            ) : (
              <ArrowDown className="size-4" />
            )}
          </Button>
          {toolbarExtra}
        </ToolbarGroup>

        <ToolbarGroup className="view-mode-controls">
          <Button
            variant={viewMode === "mixed" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("mixed")}
            className="h-8 w-8 p-0"
            title="Mixed view"
          >
            <LayoutList className="size-4" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className="h-8 w-8 p-0"
            title="Grid view"
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            variant={viewMode === "details" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("details")}
            className="h-8 w-8 p-0"
            title="Details view"
          >
            <List className="size-4" />
          </Button>
        </ToolbarGroup>
      </Toolbar>

      {/* Selection toolbar */}
      <FileSelectionToolbar
        selectedCount={selection.selectedCount}
        onMove={handleOpenMove}
        onMoveToFavorite={handleMoveToFavorite}
        onDelete={handleOpenDelete}
        onClearSelection={selection.clearSelection}
      />

      {/* Content */}
      {isLoading ? (
        viewMode === "grid" ? (
          <ResponsiveGrid className="grid-loading">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="skeleton-card space-y-2">
                <Skeleton className="aspect-square w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </ResponsiveGrid>
        ) : (
          <div className="details-loading space-y-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )
      ) : sortedItems.length === 0 ? (
        <div className="empty-state flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">{emptyText}</p>
        </div>
      ) : viewMode === "mixed" ? (
        <div className="mixed-view space-y-6">
          {/* Folders section */}
          {mixedGroups.folders.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Folders ({mixedGroups.folders.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
                {mixedGroups.folders.map(renderNameListItem)}
              </div>
            </section>
          )}
          {/* Videos section */}
          {mixedGroups.videos.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Videos ({mixedGroups.videos.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
                {mixedGroups.videos.map(renderNameListItem)}
              </div>
            </section>
          )}
          {/* Archives / other files section — grid mode */}
          {mixedGroups.archives.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Archives ({mixedGroups.archives.length})
              </h3>
              <ResponsiveGrid>
                {mixedGroups.archives.map((item) => (
                  <FileContextMenu
                    key={item.path}
                    item={item}
                    selectedCount={selection.selectedCount}
                    isOpenable={isOpenable(item)}
                    actions={buildContextMenuActions(item)}
                    onContextMenuOpen={() => handleItemContextMenu(item)}
                  >
                    <div>
                      <FileItem
                        item={item}
                        isSelected={selection.isSelected(item.path)}
                        onClick={(e) => handleItemClick(item, e)}
                        onDoubleClick={(e) => handleItemDoubleClick(item, e)}
                      />
                    </div>
                  </FileContextMenu>
                ))}
              </ResponsiveGrid>
            </section>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <ResponsiveGrid className="grid-content">
          {sortedItems.map((item) => (
            <FileContextMenu
              key={item.path}
              item={item}
              selectedCount={selection.selectedCount}
              isOpenable={isOpenable(item)}
              actions={buildContextMenuActions(item)}
              onContextMenuOpen={() => handleItemContextMenu(item)}
            >
              <div>
                <FileItem
                  item={item}
                  isSelected={selection.isSelected(item.path)}
                  onClick={(e) => handleItemClick(item, e)}
                  onDoubleClick={(e) => handleItemDoubleClick(item, e)}
                />
              </div>
            </FileContextMenu>
          ))}
        </ResponsiveGrid>
      ) : (
        <FileTableView
          items={sortedItems}
          onSort={handleSortFieldChange}
          sortField={sortField}
          sortOrder={sortOrder}
          isSelected={selection.isSelected}
          onItemClick={(item, e) => handleItemClick(item, e)}
          onItemDoubleClick={(item, e) => handleItemDoubleClick(item, e)}
          onItemContextMenu={(item) => handleItemContextMenu(item)}
          buildContextMenuActions={buildContextMenuActions}
          selectedCount={selection.selectedCount}
          isOpenable={isOpenable}
        />
      )}

      {/* Dialogs */}
      <RenameDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        filePath={getTargetPaths()[0] || ""}
        onConfirm={handleRenameConfirm}
        isPending={operations.renameMutation.isPending}
      />
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        filePaths={getTargetPaths()}
        onConfirm={handleDeleteConfirm}
        isPending={operations.deleteMutation.isPending || operations.deleteBatchMutation.isPending}
      />
      <MoveDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        filePaths={getTargetPaths()}
        onConfirm={handleMoveConfirm}
        isPending={operations.moveFileMutation.isPending || operations.moveFolderMutation.isPending}
      />
      <CompressDialog
        open={compressDialogOpen}
        onOpenChange={setCompressDialogOpen}
        filePath={contextItem?.path || ""}
        action={compressAction}
        onConfirm={handleCompressConfirm}
        isPending={operations.zipFolderMutation.isPending || operations.compressArchiveImagesMutation.isPending}
      />
      <ConfirmMoveDialog
        open={confirmFavoriteOpen}
        onOpenChange={setConfirmFavoriteOpen}
        filePaths={getTargetPaths()}
        destination="Favorites"
        onConfirm={handleConfirmMoveToFavorite}
        isPending={operations.moveToFavoriteMutation.isPending}
      />
      <ConfirmMoveDialog
        open={confirmAlreadyReadOpen}
        onOpenChange={setConfirmAlreadyReadOpen}
        filePaths={getTargetPaths()}
        destination="Already Read"
        onConfirm={handleConfirmMoveToAlreadyRead}
        isPending={operations.moveToAlreadyReadMutation.isPending}
      />
    </div>
  )
}
