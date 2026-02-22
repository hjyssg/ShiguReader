// 文件视图容器 — 集成选择、键盘快捷键、对话框
import { LayoutGrid, LayoutList, List } from "lucide-react"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import type { FileSystemItem } from "@/client"
import {
  ResponsiveGrid,
  Toolbar,
  ToolbarGroup,
} from "@/components/semantic/layout"
import { SortDirectionToggle } from "@/components/Common/SortDirectionToggle"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { UnifiedPagination } from "@/components/Common/UnifiedPagination"
import { useFileExplorerKeyboard } from "@/hooks/useFileExplorerKeyboard"
import { useFileNavigation } from "@/hooks/useFileNavigation"
import { useFileOperations } from "@/hooks/useFileOperations"
import { useFileSelection } from "@/hooks/useFileSelection"
import { detectPathSeparator, getBaseName } from "@/lib/path-utils"
import { cn } from "@/lib/utils"
import { type CompressAction, CompressDialog } from "./dialogs/CompressDialog"
import { ConfirmMoveDialog } from "./dialogs/ConfirmMoveDialog"
import { DeleteDialog } from "./dialogs/DeleteDialog"
import { MoveDialog } from "./dialogs/MoveDialog"
import { RenameDialog } from "./dialogs/RenameDialog"
import { FileGridView } from "./FileGridView"
import { FileIcon } from "./FileIcon"
import { FileTableView, type SortField, type SortOrder } from "./FileTableView"

export type ViewMode = "grid" | "table" | "mixed"

type PaginationState = {
  page: number
  pageSize: number
}

type PaginationConfig = PaginationState & {
  onChange: (next: PaginationState) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: readonly number[]
  pageSizeLabel?: ReactNode
}

export function FileViewContainer({
  items,
  isLoading,
  currentPath = "",
  initialViewMode = "grid",
  initialSortField = "mtime",
  initialSortOrder = "desc",
  sortField: controlledSortField,
  sortOrder: controlledSortOrder,
  onSortFieldChange,
  onSortOrderChange,
  pagination,
  toolbarExtra,
  emptyText = "This folder is empty",
}: {
  items: FileSystemItem[]
  isLoading: boolean
  currentPath?: string
  initialViewMode?: ViewMode
  initialSortField?: SortField
  initialSortOrder?: SortOrder
  sortField?: SortField
  sortOrder?: SortOrder
  onSortFieldChange?: (field: SortField) => void
  onSortOrderChange?: (order: SortOrder) => void
  pagination?: PaginationConfig
  toolbarExtra?: ReactNode
  emptyText?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()

  // View mode & sort state — URL params / props are the sole source of truth
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode)
  const [internalSortField, setInternalSortField] = useState<SortField>(initialSortField)
  const [internalSortOrder, setInternalSortOrder] = useState<SortOrder>(initialSortOrder)

  const sortField = controlledSortField ?? internalSortField
  const sortOrder = controlledSortOrder ?? internalSortOrder

  const setSortField = useCallback(
    (field: SortField) => {
      if (onSortFieldChange) {
        onSortFieldChange(field)
        return
      }
      setInternalSortField(field)
    },
    [onSortFieldChange],
  )

  const setSortOrder = useCallback(
    (order: SortOrder) => {
      if (onSortOrderChange) {
        onSortOrderChange(order)
        return
      }
      setInternalSortOrder(order)
    },
    [onSortOrderChange],
  )

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
        const imageCountA = a.image_count ?? 0
        const imageCountB = b.image_count ?? 0
        comparison = imageCountA - imageCountB
        if (comparison === 0) {
          comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        }
      } else if (sortField === "likeScore") {
        const scoreA = a.recommendation_score ?? a.likeScore ?? 0
        const scoreB = b.recommendation_score ?? b.likeScore ?? 0
        comparison = scoreA - scoreB
        if (comparison === 0) {
          comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        }
      } else if (sortField === "last_read_at") {
        const readAtA = a.last_read_at ?? 0
        const readAtB = b.last_read_at ?? 0
        comparison = readAtA - readAtB
        if (comparison === 0) {
          comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        }
      } else {
        const mtimeA = a.mtime || 0
        const mtimeB = b.mtime || 0
        comparison = mtimeA - mtimeB;
      }

      return sortOrder === "asc" ? comparison : -comparison
    })

    return list
  }, [items, sortField, sortOrder])

  const currentPage = pagination?.page ?? 1
  const pageSize = pagination?.pageSize ?? sortedItems.length

  // 目录和视频固定展示在第一页，不参与分页计数。
  const pinnedFirstPageItems = useMemo(
    () =>
      sortedItems.filter(
        (item) => item.item_type === "folder" || item.file_type === "video",
      ),
    [sortedItems],
  )
  // 仅归档文件参与分页，且保持与 sortedItems 一致的排序结果。
  const pagedArchiveItems = useMemo(
    () =>
      sortedItems.filter(
        (item) => item.item_type !== "folder" && item.file_type !== "video",
      ),
    [sortedItems],
  )

  const totalPages = Math.max(1, Math.ceil(pagedArchiveItems.length / pageSize))
  const normalizedPage = Math.min(Math.max(currentPage, 1), totalPages)
  const goToPage = useCallback(
    (nextPage: number) => {
      if (!pagination) return
      const target = Math.min(totalPages, Math.max(1, nextPage))
      if (target !== normalizedPage) {
        pagination.onChange({ page: target, pageSize })
      }
    },
    [pagination, totalPages, normalizedPage, pageSize],
  )

  const pagedItems = useMemo(() => {
    if (!pagination) return sortedItems

    // 分页只针对归档文件：第 1 页展示 [固定项 + 第 1 页归档]，其余页仅展示当页归档。
    const start = (normalizedPage - 1) * pageSize
    const archivesOfCurrentPage = pagedArchiveItems.slice(start, start + pageSize)

    if (normalizedPage === 1) {
      return [...pinnedFirstPageItems, ...archivesOfCurrentPage]
    }

    return archivesOfCurrentPage
  }, [
    pagination,
    sortedItems,
    normalizedPage,
    pageSize,
    pagedArchiveItems,
    pinnedFirstPageItems,
  ])

  useEffect(() => {
    if (!pagination) return
    if (pagination.page !== normalizedPage) {
      pagination.onChange({ page: normalizedPage, pageSize })
    }
  }, [pagination, normalizedPage, pageSize])

  // Selection
  const selection = useFileSelection()
  const { openItem, openItemInNewTab, isOpenable } = useFileNavigation()
  const operations = useFileOperations(currentPath)

  // Dialog state
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [compressDialogOpen, setCompressDialogOpen] = useState(false)
  const [compressAction, setCompressAction] =
    useState<CompressAction>("zip-folder")
  const [confirmFavoriteOpen, setConfirmFavoriteOpen] = useState(false)
  const [confirmAlreadyReadOpen, setConfirmAlreadyReadOpen] = useState(false)
  // 当前操作的目标项
  const [contextItem, setContextItem] = useState<FileSystemItem | null>(null)

  const anyDialogOpen =
    renameDialogOpen ||
    deleteDialogOpen ||
    moveDialogOpen ||
    compressDialogOpen ||
    confirmFavoriteOpen ||
    confirmAlreadyReadOpen

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

  const handleConfirmMoveToFavorite = useCallback((subfolder?: string) => {
    const paths = getTargetPaths()
    for (const p of paths) {
      const item = sortedItems.find((i) => i.path === p)
      if (item) {
        operations.moveToFavoriteMutation.mutate({
          sourcePath: p,
          isFolder: item.item_type === "folder",
          subfolder,
        })
      }
    }
    setConfirmFavoriteOpen(false)
    selection.clearSelection()
  }, [
    getTargetPaths,
    sortedItems,
    operations.moveToFavoriteMutation,
    selection,
  ])

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
  }, [
    getTargetPaths,
    sortedItems,
    operations.moveToAlreadyReadMutation,
    selection,
  ])

  const handleOpenFirst = useCallback(() => {
    const item = getFirstSelectedItem()
    if (item) openItemInNewTab(item)
  }, [getFirstSelectedItem, openItemInNewTab])

  const handleDownload = useCallback((item: FileSystemItem) => {
    if (item.item_type === "folder") return
    const href = `/api/v1/fs/download?path=${encodeURIComponent(item.path)}`
    const anchor = document.createElement("a")
    anchor.href = href
    anchor.download = item.name
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  }, [])

  // 点击事件处理
  const handleItemClick = useCallback(
    (item: FileSystemItem, _e: React.MouseEvent) => {
      // 左键直接打开：文件夹当前页打开，文件新标签打开
      if (item.item_type === "folder") {
        openItem(item)
      } else {
        openItemInNewTab(item)
      }
    },
    [openItem, openItemInNewTab],
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

  // 空白区域点击清除选择
  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement
      // 点击文件项内部不清除（由 item 自己的 onClick 处理）
      if (
        target.closest(".file-item-wrapper") ||
        target.closest("tr.cursor-pointer")
      ) {
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
      document.removeEventListener(
        "pointerdown",
        handleDocumentPointerDown,
        true,
      )
    }
  }, [anyDialogOpen, selection.clearSelection, selection])

  // 键盘快捷键
  useFileExplorerKeyboard({
    selectedPaths: selection.selectedPaths,
    clearSelection: selection.clearSelection,
    onDelete: handleOpenDelete,
    onRename: handleOpenRename,
    onOpen: handleOpenFirst,
    containerRef,
    dialogOpen: anyDialogOpen,
  })

  // 构建操作区 actions
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
      onDownload: () => handleDownload(item),
      onRename: () => {
        setContextItem(item)
        if (!selection.isSelected(item.path)) {
          selection.select(item.path)
        }
        setRenameDialogOpen(true)
      },
      onMove: () => {
        setContextItem(item)
        if (!selection.isSelected(item.path)) {
          selection.select(item.path)
        }
        setMoveDialogOpen(true)
      },
      onMoveToFavorite: () => {
        setContextItem(item)
        if (!selection.isSelected(item.path)) {
          selection.select(item.path)
        }
        setConfirmFavoriteOpen(true)
      },
      onMoveToAlreadyRead: () => {
        setContextItem(item)
        if (!selection.isSelected(item.path)) {
          selection.select(item.path)
        }
        setConfirmAlreadyReadOpen(true)
      },
      onBackfillFolder: () => {
        operations.backfillFolderMutation.mutate(item.path)
      },
      onDelete: () => {
        setContextItem(item)
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
    }),
    [
      openItem,
      openItemInNewTab,
      handleDownload,
      selection,
      operations.backfillFolderMutation,
    ],
  )

  // Mixed view: group items by type
  const mixedGroups = useMemo(() => {
    if (viewMode !== "mixed") return { folders: [], videos: [], archives: [] }
    const folders = pagedItems.filter((i) => i.item_type === "folder")
    const videos = pagedItems.filter(
      (i) => i.item_type === "file" && i.file_type === "video",
    )
    const archives = pagedItems.filter(
      (i) => i.item_type === "file" && i.file_type !== "video",
    )
    return { folders, videos, archives }
  }, [viewMode, pagedItems])

  // 混合视图：文件名列表行渲染（用于 folder / video section）
  const renderNameListItem = useCallback(
    (item: FileSystemItem) => {
      const linkProps =
        item.item_type === "folder"
          ? {
              to: "/explorer" as const,
              search: { path: item.path, page: 1, pageSize: 48, sortField: "mtime" as const, sortOrder: "desc" as const },
            }
          : {
              to: "/video" as const,
              search: {
                path: item.path,
                entry: undefined as string | undefined,
              },
            }

      return (
        <Link
          key={item.path}
          {...linkProps}
          className={cn(
            "file-item-wrapper group flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-colors hover:bg-accent/50",
          )}
        >
          <FileIcon
            fileType={item.file_type}
            isFolder={item.item_type === "folder"}
            size="sm"
            className="shrink-0"
          />
          <span
            className="min-w-0 text-sm truncate group-hover:underline"
            title={item.name}
          >
            {item.name}
          </span>
        </Link>
      )
    },
    [],
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
          {
            onSuccess: () => {
              setRenameDialogOpen(false)
              selection.clearSelection()
            },
          },
        )
      }
    },
    [getTargetPaths, operations.renameMutation, selection],
  )

  const handleDeleteConfirm = useCallback(
    (permanently: boolean) => {
      const paths = getTargetPaths()
      if (paths.length > 0) {
        operations.deleteMutation.mutate(
          { path: paths[0], permanently },
          {
            onSuccess: () => {
              setDeleteDialogOpen(false)
              selection.clearSelection()
            },
          },
        )
      }
    },
    [getTargetPaths, operations.deleteMutation, selection],
  )

  const handleMoveConfirm = useCallback(
    (destDir: string) => {
      const paths = getTargetPaths()
      const sourcePath = paths[0]
      if (!sourcePath) return
      const item = sortedItems.find((i) => i.path === sourcePath)
      if (item) {
        const fileName = getBaseName(sourcePath)
        const separator = detectPathSeparator(destDir || sourcePath)
        const normalizedDestDir = destDir.replace(/[\\/]+$/, "")
        const destPath = `${normalizedDestDir}${separator}${fileName}`
        operations.move(sourcePath, destPath, item.item_type === "folder")
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
  }, [
    contextItem,
    compressAction,
    operations.zipFolderMutation,
    operations.compressArchiveImagesMutation,
  ])

  return (
    <div
      className="file-list-container space-y-4 select-none"
      ref={containerRef}
      onClick={handleContainerClick}
    >
      {/* Toolbar */}
      <Toolbar className="file-list-toolbar">
        <ToolbarGroup className="sort-controls">
          <span className="text-sm text-muted-foreground">{t("explorer.sortBy")}</span>
          <Select
            value={sortField}
            onValueChange={(v) => setSortField(v as SortField)}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs leading-none">
              <SelectValue className="text-xs" />
            </SelectTrigger>
            <SelectContent className="text-xs">
              <SelectItem className="text-xs" value="name">{t("explorer.table.name")}</SelectItem>
              <SelectItem className="text-xs" value="type">{t("explorer.table.type")}</SelectItem>
              <SelectItem className="text-xs" value="mtime">{t("explorer.table.dateModified")}</SelectItem>
              <SelectItem className="text-xs" value="likeScore">{t("explorer.table.likeScore")}</SelectItem>
              <SelectItem className="text-xs" value="image_count">{t("explorer.table.imageCount")}</SelectItem>
              <SelectItem className="text-xs" value="last_read_at">{t("explorer.table.lastReadAt")}</SelectItem>
            </SelectContent>
          </Select>
          <SortDirectionToggle
            value={sortOrder}
            onToggle={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          />
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
            variant={viewMode === "table" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("table")}
            className="h-8 w-8 p-0"
            title="Table view"
          >
            <List className="size-4" />
          </Button>
        </ToolbarGroup>
      </Toolbar>

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
          <div className="table-loading space-y-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )
      ) : pagedItems.length === 0 ? (
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
              <FileGridView
                items={mixedGroups.archives}
                isOpenable={isOpenable}
                buildActions={buildContextMenuActions}
                onItemClick={handleItemClick}
              />
            </section>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <FileGridView
          items={pagedItems}
          isOpenable={isOpenable}
          buildActions={buildContextMenuActions}
          onItemClick={handleItemClick}
          className="grid-content"
        />
      ) : (
        <FileTableView
          items={pagedItems}
          onSort={handleSortFieldChange}
          sortField={sortField}
          sortOrder={sortOrder}
          isSelected={() => false}
          onItemClick={(item, e) => handleItemClick(item, e)}
          onItemDoubleClick={(item, e) => handleItemDoubleClick(item, e)}
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
        isPending={operations.deleteMutation.isPending}
      />
      <MoveDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        filePaths={getTargetPaths()}
        onConfirm={handleMoveConfirm}
        isPending={
          operations.moveFileMutation.isPending ||
          operations.moveFolderMutation.isPending
        }
      />
      <CompressDialog
        open={compressDialogOpen}
        onOpenChange={setCompressDialogOpen}
        filePath={contextItem?.path || ""}
        action={compressAction}
        onConfirm={handleCompressConfirm}
        isPending={
          operations.zipFolderMutation.isPending ||
          operations.compressArchiveImagesMutation.isPending
        }
      />
      <ConfirmMoveDialog
        open={confirmFavoriteOpen}
        onOpenChange={setConfirmFavoriteOpen}
        filePaths={getTargetPaths()}
        destination="Favorites"
        showSubfolder
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
      {pagination && sortedItems.length > 0 && (
        <UnifiedPagination
          page={normalizedPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          containerClassName="flex flex-col items-center gap-3 pt-2"
          onPageSizeChange={pagination.onPageSizeChange}
          pageSize={pageSize}
          pageSizeOptions={pagination.pageSizeOptions}
          pageSizeLabel={pagination.pageSizeLabel}
        />
      )}
    </div>
  )
}
