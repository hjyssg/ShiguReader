import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  ArrowDown,
  ArrowUp,
  History as HistoryIcon,
  LayoutGrid,
  List,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { OpenAPI } from "@/client"
import type { FileSystemItem } from "@/client/types.gen"
import { ListTable, type ListTableColumn } from "@/components/Common/ListTable"
import { FileItem } from "@/components/Files/FileItem"
import { FileNameWithPreview } from "@/components/Files/FileNameWithPreview"
import {
  formatDateTime,
  formatFileSize,
  formatFileType,
} from "@/components/Files/utils"
import { Button } from "@/components/ui/button"
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
import { useIsMobile } from "@/hooks/useMobile"
import { getParentPath } from "@/lib/path-utils"

type SortOrder = "asc" | "desc"

type HistoryItem = {
  filepath: string
  filename: string
  file_type: "image" | "video" | "archive" | "audio" | "unknown"
  filesize: number | null
  mtime: number | null
  thumbnail_url: string | null
  read_at: number
  page_current: number | null
  page_total: number | null
  file_exists: boolean
}

type HistoryResponse = {
  items: HistoryItem[]
  page: number
  page_size: number
  total: number
  total_pages: number
}

export const Route = createFileRoute("/_layout/history")({
  component: HistoryPage,
  validateSearch: (search: Record<string, unknown>) => {
    const page = Math.max(1, Number(search.page) || 1)
    const view = search.view === "table" ? "table" : "grid"
    const sort_order: SortOrder = search.sort_order === "asc" ? "asc" : "desc"
    return { page, view, sort_order }
  },
  head: () => ({
    meta: [{ title: "History" }],
  }),
})

function HistoryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [jumpPage, setJumpPage] = useState("")
  const { page, view, sort_order } = Route.useSearch()
  const pageSize = view === "grid" ? 24 : 50

  const { data, isLoading } = useQuery({
    queryKey: ["history", page, view, sort_order],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        sort_order,
      })
      const res = await fetch(
        `${OpenAPI.BASE}/api/v1/history/list?${params.toString()}`,
      )
      if (!res.ok) throw new Error("Failed to fetch history")
      return (await res.json()) as HistoryResponse
    },
  })

  const visiblePages = useMemo(() => {
    const totalPages = Math.max(1, data?.total_pages ?? 1)
    const out: number[] = []
    const start = Math.max(1, page - 2)
    const end = Math.min(totalPages, start + 4)
    for (let i = start; i <= end; i += 1) out.push(i)
    return out
  }, [data?.total_pages, page])

  const totalPages = Math.max(1, data?.total_pages ?? 1)

  const goToPage = (nextPage: number) => {
    const target = Math.min(totalPages, Math.max(1, nextPage))
    if (target !== page) {
      navigate({ to: "/history", search: { page: target, view, sort_order } })
    }
  }

  const openHistoryItem = (item: HistoryItem) => {
    if (item.file_type === "archive") {
      navigate({ to: "/archive", search: { path: item.filepath } })
      return
    }
    if (item.file_type === "video") {
      navigate({
        to: "/video",
        search: { path: item.filepath, entry: undefined, media: "video" },
      })
      return
    }
    if (item.file_type === "audio") {
      navigate({
        to: "/audio",
        search: { path: item.filepath, entry: undefined },
      })
      return
    }
    if (item.file_type === "image") {
      navigate({
        to: isMobile ? "/read-mobile" : "/read",
        search: {
          path: getParentPath(item.filepath),
          source: "folder",
          page: 0,
          filePath: item.filepath,
        },
      })
      return
    }

    toast.info(t("history.unsupportedType"))
  }

  const tableColumns: ListTableColumn[] = [
    { key: "name", header: t("history.name") },
    { key: "readAt", header: t("history.readAt"), headerClassName: "w-[180px]" },
    { key: "type", header: t("history.type"), headerClassName: "w-[120px]" },
    { key: "size", header: t("history.size"), headerClassName: "w-[100px] text-right" },
  ]

  const toFileSystemItem = (item: HistoryItem): FileSystemItem => ({
    name: item.filename,
    path: item.filepath,
    item_type: "file",
    file_type: item.file_type,
    filesize: item.filesize,
    mtime: item.mtime,
    thumbnail_url: item.thumbnail_url,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 pb-2 border-b">
        <div className="flex items-center gap-2">
          <HistoryIcon className="size-5" />
          <h1 className="text-xl font-semibold">{t("history.title")}</h1>
          <span className="text-sm text-muted-foreground">{t("history.subtitle")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={sort_order === "desc" ? "default" : "outline"}
            size="sm"
            onClick={() =>
              navigate({
                to: "/history",
                search: { page: 1, view, sort_order: "desc" },
              })
            }
          >
            <ArrowDown className="size-4 mr-1" /> {t("history.recentFirst")}
          </Button>
          <Button
            variant={sort_order === "asc" ? "default" : "outline"}
            size="sm"
            onClick={() =>
              navigate({
                to: "/history",
                search: { page: 1, view, sort_order: "asc" },
              })
            }
          >
            <ArrowUp className="size-4 mr-1" /> {t("history.oldestFirst")}
          </Button>
          <Button
            variant={view === "grid" ? "default" : "ghost"}
            size="sm"
            onClick={() =>
              navigate({
                to: "/history",
                search: { page: 1, view: "grid", sort_order },
              })
            }
            className="h-8 w-8 p-0"
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            variant={view === "table" ? "default" : "ghost"}
            size="sm"
            onClick={() =>
              navigate({
                to: "/history",
                search: { page: 1, view: "table", sort_order },
              })
            }
            className="h-8 w-8 p-0"
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        view === "grid" ? (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-square w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">{t("history.empty")}</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
          {data?.items.map((item) => (
            <div
              key={`${item.filepath}-${item.read_at}`}
              onClick={() => openHistoryItem(item)}
              className="cursor-pointer"
            >
              <FileItem
                item={toFileSystemItem(item)}
                className="file-item-root--compact"
                metaText={`${t("history.readAt")}：${formatDateTime(item.read_at)}`}
              />
            </div>
          ))}
        </div>
      ) : (
        <ListTable
          columns={tableColumns}
          rows={data?.items ?? []}
          renderRow={(item) => (
            <tr
              key={`${item.filepath}-${item.read_at}`}
              className="border-b last:border-b-0 text-sm cursor-pointer hover:bg-muted/50"
              onClick={() => openHistoryItem(item)}
            >
              <td className="p-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileNameWithPreview
                    filename={item.filename}
                    filepath={item.filepath}
                    thumbnailUrl={item.thumbnail_url}
                    className="min-w-0"
                  />
                </div>
              </td>
              <td className="p-2 text-muted-foreground">{formatDateTime(item.read_at)}</td>
              <td className="p-2 text-muted-foreground">{formatFileType(item.file_type)}</td>
              <td className="p-2 text-right text-muted-foreground">{item.filesize ? formatFileSize(item.filesize) : "-"}</td>
            </tr>
          )}
        />
      )}

      {(data?.total ?? 0) > 0 && (
        <div className="flex flex-col items-center gap-3">
          <Pagination>
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
                  className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}
                />
              </PaginationItem>

              <PaginationItem>
                <PaginationLast
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    goToPage(totalPages)
                  }}
                  className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}
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
