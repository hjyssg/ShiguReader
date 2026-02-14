// 实体网格布局组件，支持分页
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { ResponsiveGrid } from "@/components/semantic/layout"

import { EntityCard, type EntityCardItem } from "./EntityCard"

export function EntityGrid({
  items,
  isLoading,
  page,
  pageSize,
  total,
  onPageChange,
  onCardClick,
  emptyText = "暂无数据",
}: {
  items: EntityCardItem[]
  isLoading: boolean
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onCardClick?: (item: EntityCardItem) => void
  emptyText?: string
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const visiblePages = []
  const start = Math.max(1, page - 2)
  const end = Math.min(totalPages, start + 4)
  for (let i = start; i <= end; i += 1) {
    visiblePages.push(i)
  }

  return (
    <div className="entity-grid-container space-y-6">
      {isLoading ? (
        <ResponsiveGrid className="grid-loading">
          {[...Array(pageSize)].map((_, i) => (
            <div key={i} className="skeleton-card space-y-2">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </ResponsiveGrid>
      ) : items.length === 0 ? (
        <div className="empty-state flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">{emptyText}</p>
        </div>
      ) : (
        <ResponsiveGrid className="grid-content">
          {items.map((item) => (
            <EntityCard key={item.name} item={item} onClick={() => onCardClick?.(item)} />
          ))}
        </ResponsiveGrid>
      )}

      {total > 0 && (
        <Pagination className="grid-pagination">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  if (page > 1) onPageChange(page - 1)
                }}
              />
            </PaginationItem>

            {visiblePages.map((p) => (
              <PaginationItem key={p}>
                <PaginationLink
                  href="#"
                  isActive={p === page}
                  onClick={(e) => {
                    e.preventDefault()
                    onPageChange(p)
                  }}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ))}

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  if (page < totalPages) onPageChange(page + 1)
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
