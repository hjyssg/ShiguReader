import { LayoutGrid, List, ArrowDown, ArrowUp } from "lucide-react"
import { type ReactNode, useEffect, useMemo, useState } from "react"

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

import { DetailsView, type SortField, type SortOrder } from "./DetailsView"
import { FileItem } from "./FileItem"

type ViewMode = "grid" | "details"

export function FileList({
  items,
  isLoading,
  initialViewMode = "grid",
  initialSortField = "type",
  initialSortOrder = "asc",
  storageKeyPrefix = "file-list",
  toolbarExtra,
  emptyText = "This folder is empty",
}: {
  items: FileSystemItem[]
  isLoading: boolean
  initialViewMode?: ViewMode
  initialSortField?: SortField
  initialSortOrder?: SortOrder
  storageKeyPrefix?: string
  toolbarExtra?: ReactNode
  emptyText?: string
}) {
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
      } else if (sortField === "recommendation") {
        const scoreA = a.recommendation_score || 0
        const scoreB = b.recommendation_score || 0
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

  const handleSortFieldChange = (field: SortField) => {
    if (field === sortField) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
      return
    }
    setSortField(field)
    setSortOrder("asc")
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 pb-2 border-b">
        <div className="flex items-center gap-2">
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
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className="h-8 w-8 p-0"
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            variant={viewMode === "details" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("details")}
            className="h-8 w-8 p-0"
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        viewMode === "grid" ? (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-square w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )
      ) : sortedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">{emptyText}</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {sortedItems.map((item) => (
            <FileItem key={item.path} item={item} />
          ))}
        </div>
      ) : (
        <DetailsView
          items={sortedItems}
          onSort={handleSortFieldChange}
          sortField={sortField}
          sortOrder={sortOrder}
        />
      )}
    </div>
  )
}
