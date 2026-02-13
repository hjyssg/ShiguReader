import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"

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
    <div className="space-y-6">
      {isLoading ? (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {[...Array(pageSize)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">{emptyText}</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item) => (
            <EntityCard key={item.name} item={item} onClick={() => onCardClick?.(item)} />
          ))}
        </div>
      )}

      {total > 0 && (
        <Pagination>
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
