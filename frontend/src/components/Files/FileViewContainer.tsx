// 文件视图容器 — 排序、视图切换、分页
import { LayoutGrid, LayoutList, List } from "lucide-react"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { type ReactNode, useCallback, useMemo, useState, useEffect } from "react"

import { type FileSystemItem } from "@/client"
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
import { cn } from "@/lib/utils"
import { FileGridView } from "./FileGridView"
import { FileIcon } from "./FileIcon"
import { FileTableView, type SortField, type SortOrder } from "./FileTableView"
import { getLinkTarget } from "@/constants/openBehavior"

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
  const { t } = useTranslation()

  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode)
  const [internalSortField, setInternalSortField] = useState<SortField>(initialSortField)
  const [internalSortOrder, setInternalSortOrder] = useState<SortOrder>(initialSortOrder)

  const sortField = controlledSortField ?? internalSortField
  const sortOrder = controlledSortOrder ?? internalSortOrder

  const setSortField = useCallback(
    (field: SortField) => {
      if (onSortFieldChange) { onSortFieldChange(field); return }
      setInternalSortField(field)
    },
    [onSortFieldChange],
  )

  const setSortOrder = useCallback(
    (order: SortOrder) => {
      if (onSortOrderChange) { onSortOrderChange(order); return }
      setInternalSortOrder(order)
    },
    [onSortOrderChange],
  )

  const sortedItems = useMemo(() => {
    if (!items) return []
    const list = items.filter((item) =>
      item.item_type === "folder" || item.file_type !== "unknown",
    )

    list.sort((a, b) => {
      if (a.item_type !== b.item_type) return a.item_type === "folder" ? -1 : 1

      let comparison = 0
      if (sortField === "name") {
        comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      } else if (sortField === "type") {
        comparison = (a.file_type || "unknown").localeCompare(b.file_type || "unknown")
        if (comparison === 0) comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      } else if (sortField === "image_count") {
        comparison = (a.image_count ?? 0) - (b.image_count ?? 0)
        if (comparison === 0) comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      } else if (sortField === "likeScore") {
        comparison = (a.recommendation_score ?? a.likeScore ?? 0) - (b.recommendation_score ?? b.likeScore ?? 0)
        if (comparison === 0) comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      } else if (sortField === "last_read_at") {
        comparison = (a.last_read_at ?? 0) - (b.last_read_at ?? 0)
        if (comparison === 0) comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      } else {
        comparison = (a.mtime || 0) - (b.mtime || 0)
      }

      return sortOrder === "asc" ? comparison : -comparison
    })

    return list
  }, [items, sortField, sortOrder])

  const currentPage = pagination?.page ?? 1
  const pageSize = pagination?.pageSize ?? sortedItems.length

  // 目录和视频固定展示在第一页，不参与分页计数。
  const pinnedFirstPageItems = useMemo(
    () => sortedItems.filter((item) => item.item_type === "folder" || item.file_type === "video"),
    [sortedItems],
  )
  const pagedArchiveItems = useMemo(
    () => sortedItems.filter((item) => item.item_type !== "folder" && item.file_type !== "video"),
    [sortedItems],
  )

  const totalPages = Math.max(1, Math.ceil(pagedArchiveItems.length / pageSize))
  const normalizedPage = Math.min(Math.max(currentPage, 1), totalPages)

  const goToPage = useCallback(
    (nextPage: number) => {
      if (!pagination) return
      const target = Math.min(totalPages, Math.max(1, nextPage))
      if (target !== normalizedPage) pagination.onChange({ page: target, pageSize })
    },
    [pagination, totalPages, normalizedPage, pageSize],
  )

  const pagedItems = useMemo(() => {
    if (!pagination) return sortedItems
    const start = (normalizedPage - 1) * pageSize
    const archivesOfCurrentPage = pagedArchiveItems.slice(start, start + pageSize)
    return normalizedPage === 1
      ? [...pinnedFirstPageItems, ...archivesOfCurrentPage]
      : archivesOfCurrentPage
  }, [pagination, sortedItems, normalizedPage, pageSize, pagedArchiveItems, pinnedFirstPageItems])

  useEffect(() => {
    if (!pagination) return
    if (pagination.page !== normalizedPage) pagination.onChange({ page: normalizedPage, pageSize })
  }, [pagination, normalizedPage, pageSize])

  // Mixed view: group items by type
  const mixedGroups = useMemo(() => {
    if (viewMode !== "mixed") return { folders: [], videos: [], archives: [] }
    return {
      folders: pagedItems.filter((i) => i.item_type === "folder"),
      videos: pagedItems.filter((i) => i.item_type === "file" && i.file_type === "video"),
      archives: pagedItems.filter((i) => i.item_type === "file" && i.file_type !== "video"),
    }
  }, [viewMode, pagedItems])

  const renderNameListItem = useCallback((item: FileSystemItem) => {
    const linkProps =
      item.item_type === "folder"
        ? {
            to: "/explorer" as const,
            search: { path: item.path, page: 1, pageSize: 48, sortField: "mtime" as const, sortOrder: "desc" as const },
          }
        : {
            to: "/video" as const,
            search: { path: item.path, entry: undefined as string | undefined },
          }

    return (
      <Link
        key={item.path}
        {...linkProps}
        className={cn(
          "group flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors hover:bg-accent/50",
        )}
        target={getLinkTarget(item.path)}
      >
        <FileIcon
          fileType={item.file_type}
          isFolder={item.item_type === "folder"}
          size="sm"
          className="shrink-0"
        />
        <span className="min-w-0 text-sm truncate group-hover:underline" title={item.name}>
          {item.name}
        </span>
      </Link>
    )
  }, [])

  const handleSortFieldChange = (field: SortField) => {
    if (field === sortField) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
      return
    }
    setSortField(field)
    setSortOrder("asc")
  }

  return (
    <div className="file-list-container space-y-4 select-none">
      {/* Toolbar */}
      <Toolbar className="file-list-toolbar">
        <ToolbarGroup className="sort-controls">
          <span className="text-sm text-muted-foreground">{t("explorer.sortBy")}</span>
          <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
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
          <Button variant={viewMode === "mixed" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("mixed")} className="h-8 w-8 p-0" title="Mixed view">
            <LayoutList className="size-4" />
          </Button>
          <Button variant={viewMode === "grid" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("grid")} className="h-8 w-8 p-0" title="Grid view">
            <LayoutGrid className="size-4" />
          </Button>
          <Button variant={viewMode === "table" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("table")} className="h-8 w-8 p-0" title="Table view">
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
          {mixedGroups.archives.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Archives ({mixedGroups.archives.length})
              </h3>
              <FileGridView items={mixedGroups.archives} />
            </section>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <FileGridView items={pagedItems} className="grid-content" />
      ) : (
        <FileTableView
          items={pagedItems}
          onSort={handleSortFieldChange}
          sortField={sortField}
          sortOrder={sortOrder}
        />
      )}

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
