import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ArrowDown, ArrowUp, History as HistoryIcon, LayoutGrid, List } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { OpenAPI } from "@/client"
import { FileIcon } from "@/components/Files/FileIcon"
import { FileNameWithPreview } from "@/components/Files/FileNameWithPreview"
import { formatDateTime, formatFileSize, formatFileType } from "@/components/Files/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
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
      const res = await fetch(`${OpenAPI.BASE}/api/v1/history/list?${params.toString()}`)
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
        to: "/video",
        search: { path: item.filepath, entry: undefined, media: "audio" },
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
            onClick={() => navigate({ to: "/history", search: { page: 1, view: "grid", sort_order } })}
            className="h-8 w-8 p-0"
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            variant={view === "table" ? "default" : "ghost"}
            size="sm"
            onClick={() => navigate({ to: "/history", search: { page: 1, view: "table", sort_order } })}
            className="h-8 w-8 p-0"
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        view === "grid" ? (
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
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {data?.items.map((item) => (
            <button
              key={`${item.filepath}-${item.read_at}`}
              type="button"
              onClick={() => openHistoryItem(item)}
              className="group relative rounded-lg border bg-card transition-all text-left cursor-pointer hover:border-primary hover:shadow-md"
            >
              <div className="aspect-square w-full overflow-hidden rounded-t-lg bg-muted flex items-center justify-center relative">
                {item.thumbnail_url ? (
                  <img
                    src={`${OpenAPI.BASE}${item.thumbnail_url}`}
                    alt={item.filename}
                    className="size-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <FileIcon fileType={item.file_type} isFolder={false} />
                )}
                {!item.file_exists && (
                  <Badge variant="destructive" className="absolute top-2 right-2">
                    {t("history.unknown")}
                  </Badge>
                )}
              </div>
              <div className="p-2 space-y-1">
                <FileNameWithPreview
                  filename={item.filename}
                  filepath={item.filepath}
                  thumbnailUrl={item.thumbnail_url}
                  className="text-sm block"
                />
                <p className="text-xs text-muted-foreground">{t("history.readAt")}：{formatDateTime(item.read_at)}</p>
                <p className="text-xs text-muted-foreground">
                  {item.filesize ? formatFileSize(item.filesize) : formatFileType(item.file_type)}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr className="text-sm">
                <th className="text-left p-2 font-medium">{t("history.name")}</th>
                <th className="text-left p-2 font-medium w-[180px]">{t("history.readAt")}</th>
                <th className="text-left p-2 font-medium w-[120px]">{t("history.type")}</th>
                <th className="text-right p-2 font-medium w-[100px]">{t("history.size")}</th>
                <th className="text-left p-2 font-medium w-[120px]">{t("history.status")}</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((item) => (
                <tr
                  key={`${item.filepath}-${item.read_at}`}
                  className="border-b last:border-b-0 text-sm cursor-pointer hover:bg-muted/50"
                  onClick={() => openHistoryItem(item)}
                >
                  <td className="p-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="shrink-0">
                        <FileIcon fileType={item.file_type} isFolder={false} size="sm" />
                      </div>
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
                  <td className="p-2 text-right text-muted-foreground">
                    {item.filesize ? formatFileSize(item.filesize) : "-"}
                  </td>
                  <td className="p-2">
                    {item.file_exists ? (
                      <Badge variant="secondary">{t("history.available")}</Badge>
                    ) : (
                      <Badge variant="destructive">{t("history.unknown")}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(data?.total ?? 0) > 0 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  if (page > 1) {
                    navigate({ to: "/history", search: { page: page - 1, view, sort_order } })
                  }
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
                    navigate({ to: "/history", search: { page: p, view, sort_order } })
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
                  if (page < (data?.total_pages ?? 1)) {
                    navigate({ to: "/history", search: { page: page + 1, view, sort_order } })
                  }
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
