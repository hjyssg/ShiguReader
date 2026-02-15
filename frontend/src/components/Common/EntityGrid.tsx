// 实体网格布局组件，支持分页
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ResponsiveGrid } from "@/components/semantic/layout"
import {
  Pagination,
  PaginationContent,
  PaginationFirst,
  PaginationItem,
  PaginationLast,
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
  emptyText,
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
  const { t } = useTranslation()
  const defaultEmptyText = t("common.noData")
  const finalEmptyText = emptyText ?? defaultEmptyText
  
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const [jumpPage, setJumpPage] = useState("")

  const visiblePages = []
  const start = Math.max(1, page - 2)
  const end = Math.min(totalPages, start + 4)
  for (let i = start; i <= end; i += 1) {
    visiblePages.push(i)
  }

  const goToPage = (nextPage: number) => {
    const target = Math.min(totalPages, Math.max(1, nextPage))
    if (target !== page) onPageChange(target)
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
          <p className="text-muted-foreground">{finalEmptyText}</p>
        </div>
      ) : (
        <ResponsiveGrid className="grid-content">
          {items.map((item) => (
            <EntityCard
              key={item.name}
              item={item}
              onClick={() => onCardClick?.(item)}
            />
          ))}
        </ResponsiveGrid>
      )}

      {total > 0 && (
        <div className="flex flex-col items-center gap-3">
          <Pagination className="grid-pagination">
            <PaginationContent>
              <PaginationItem>
                <PaginationFirst
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    goToPage(1)
                  }}
                  className={
                    page <= 1 ? "pointer-events-none opacity-50" : undefined
                  }
                />
              </PaginationItem>

              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    goToPage(page - 1)
                  }}
                  className={
                    page <= 1 ? "pointer-events-none opacity-50" : undefined
                  }
                />
              </PaginationItem>

              {visiblePages.map((p) => (
                <PaginationItem key={p}>
                  <PaginationLink
                    href="#"
                    isActive={p === page}
                    onClick={(e) => {
                      e.preventDefault()
                      goToPage(p)
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
                    goToPage(page + 1)
                  }}
                  className={
                    page >= totalPages
                      ? "pointer-events-none opacity-50"
                      : undefined
                  }
                />
              </PaginationItem>

              <PaginationItem>
                <PaginationLast
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    goToPage(totalPages)
                  }}
                  className={
                    page >= totalPages
                      ? "pointer-events-none opacity-50"
                      : undefined
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t("history.goTo")}</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpPage}
              onChange={(e) => setJumpPage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const n = Number(jumpPage)
                  if (!Number.isNaN(n)) goToPage(n)
                }
              }}
              className="h-8 w-20 rounded-md border bg-background px-2"
              placeholder={`1-${totalPages}`}
            />
            <button
              type="button"
              className="h-8 rounded-md border px-3"
              onClick={() => {
                const n = Number(jumpPage)
                if (!Number.isNaN(n)) goToPage(n)
              }}
            >
              {t("history.confirm")}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
