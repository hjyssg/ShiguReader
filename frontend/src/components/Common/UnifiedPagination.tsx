import { type ReactNode, useMemo, useState } from "react"

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

type UnifiedPaginationProps = {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  paginationClassName?: string
  containerClassName?: string
  showJump?: boolean
  jumpLabel?: ReactNode
  confirmLabel?: ReactNode
  jumpInputClassName?: string
  confirmButtonClassName?: string
  pageSizeLabel?: ReactNode
  pageSize?: number
  pageSizeOptions?: readonly number[]
  onPageSizeChange?: (pageSize: number) => void
  pageSizeButtonClassName?: string
}

export function UnifiedPagination({
  page,
  totalPages,
  onPageChange,
  paginationClassName,
  containerClassName = "flex flex-col items-center gap-3",
  showJump = true,
  jumpLabel = "Go to",
  confirmLabel = "Confirm",
  jumpInputClassName = "h-8 w-20 rounded-md border bg-background px-2",
  confirmButtonClassName = "h-8 rounded-md border px-3",
  pageSizeLabel,
  pageSize,
  pageSizeOptions = [24, 48, 100],
  onPageSizeChange,
  pageSizeButtonClassName = "h-8 rounded-md border px-3",
}: UnifiedPaginationProps) {
  const [jumpPage, setJumpPage] = useState("")

  const visiblePages = useMemo(() => {
    const out: number[] = []
    const start = Math.max(1, page - 2)
    const end = Math.min(totalPages, start + 4)
    for (let i = start; i <= end; i += 1) {
      out.push(i)
    }
    return out
  }, [page, totalPages])

  const goToPage = (nextPage: number) => {
    const target = Math.min(totalPages, Math.max(1, nextPage))
    if (target !== page) {
      onPageChange(target)
    }
  }

  const cyclePageSize = () => {
    if (!onPageSizeChange || pageSize === undefined || pageSizeOptions.length === 0) {
      return
    }
    const currentIndex = pageSizeOptions.indexOf(pageSize)
    const nextIndex = (currentIndex + 1) % pageSizeOptions.length
    onPageSizeChange(pageSizeOptions[nextIndex])
  }

  return (
    <div className={containerClassName}>
      <Pagination className={paginationClassName}>
        <PaginationContent>
          <PaginationItem>
            <PaginationFirst
              href="#"
              onClick={(e) => {
                e.preventDefault()
                goToPage(1)
              }}
              className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
            />
          </PaginationItem>

          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault()
                goToPage(page - 1)
              }}
              className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
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
                page >= totalPages ? "pointer-events-none opacity-50" : undefined
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
                page >= totalPages ? "pointer-events-none opacity-50" : undefined
              }
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      {(showJump || onPageSizeChange) && (
        <div className="flex items-center gap-2 text-sm">
          {onPageSizeChange && pageSize !== undefined && (
            <>
              {pageSizeLabel && (
                <span className="text-muted-foreground">{pageSizeLabel}</span>
              )}
              <button
                type="button"
                className={pageSizeButtonClassName}
                onClick={cyclePageSize}
              >
                {pageSize}
              </button>
            </>
          )}
          {showJump && <span className="text-muted-foreground">{jumpLabel}</span>}
          {showJump && (
            <>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpPage}
                onChange={(e) => setJumpPage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const n = Number(jumpPage)
                    if (!Number.isNaN(n)) {
                      goToPage(n)
                    }
                  }
                }}
                className={jumpInputClassName}
                placeholder={`1-${totalPages}`}
              />
              <button
                type="button"
                className={confirmButtonClassName}
                onClick={() => {
                  const n = Number(jumpPage)
                  if (!Number.isNaN(n)) {
                    goToPage(n)
                  }
                }}
              >
                {confirmLabel}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
