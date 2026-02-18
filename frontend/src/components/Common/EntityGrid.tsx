// 实体网格布局组件，支持分页
import { useTranslation } from "react-i18next"
import { ResponsiveGrid } from "@/components/semantic/layout"
import { Skeleton } from "@/components/ui/skeleton"
import { UnifiedPagination } from "@/components/Common/UnifiedPagination"

import { EntityCard, type EntityCardItem } from "./EntityCard"

export function EntityGrid({
  items,
  isLoading,
  page,
  pageSize,
  total,
  onPageChange,
  getItemHref,
  emptyText,
}: {
  items: EntityCardItem[]
  isLoading: boolean
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  getItemHref?: (item: EntityCardItem) => string | undefined
  emptyText?: string
}) {
  const { t } = useTranslation()
  const defaultEmptyText = t("common.noData")
  const finalEmptyText = emptyText ?? defaultEmptyText

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
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
              href={getItemHref?.(item)}
            />
          ))}
        </ResponsiveGrid>
      )}

      {total > 0 && (
        <UnifiedPagination
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          paginationClassName="grid-pagination"
          jumpLabel={t("history.goTo")}
          confirmLabel={t("history.confirm")}
        />
      )}
    </div>
  )
}
