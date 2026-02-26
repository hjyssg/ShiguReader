/**
 * 历史记录页面 - 显示最近浏览的文件，支持网格和列表视图
 */
import { useQuery } from "@/shims/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  ArrowDown,
  ArrowUp,
  History as HistoryIcon,
  LayoutGrid,
  List,
} from "lucide-react"
import { useTranslation } from "react-i18next"

import { OpenAPI } from "@/client"
import type { FileSystemItem } from "@/client/types.gen"
import { ListTable, type ListTableColumn } from "@/components/Common/ListTable"
import { FileItem } from "@/components/Files/FileItem"
import { FileNameLinkCell } from "@/components/Files/FileNameLinkCell"
import {
  formatDateTime,
  formatFileSize,
  formatFileType,
} from "@/components/Files/utils"
import { Button } from "@/components/ui/button"
import { UnifiedPagination } from "@/components/Common/UnifiedPagination"
import { Skeleton } from "@/components/ui/skeleton"
import { buildNavigationTarget } from "@/hooks/useFileNavigation"
import { useIsMobile } from "@/hooks/useMobile"

type SortOrder = "asc" | "desc"

type HistoryItem = {
  filepath: string
  filename: string
  file_type: "image" | "video" | "archive" | "audio" | "unknown"
  filesize: number | null
  mtime: number | null
  thumbnail_url: string | null
  read_at?: number
  opened_at?: number
  page_current: number | null
  page_total: number | null
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
      const res = await fetch(
        `${OpenAPI.BASE}/api/v1/history/list?${params.toString()}`,
      )
      if (!res.ok) throw new Error("Failed to fetch history")
      return (await res.json()) as HistoryResponse
    },
  })

  const totalPages = Math.max(1, data?.total_pages ?? 1)


  const goToPage = (nextPage: number) => {
    const target = Math.min(totalPages, Math.max(1, nextPage))
    if (target !== page) {
      navigate({ to: "/history", search: { page: target, view, sort_order } })
    }
  }

  const tableColumns: ListTableColumn[] = [
    { key: "name", header: t("history.name") },
    {
      key: "readAt",
      header: t("history.readAt"),
      headerClassName: "w-[180px]",
    },
    { key: "type", header: t("history.type"), headerClassName: "w-[120px]" },
    {
      key: "size",
      header: t("history.size"),
      headerClassName: "w-[100px] text-right",
    },
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

  const getHistoryTimestamp = (item: HistoryItem): number =>
    item.read_at ?? item.opened_at ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 pb-2 border-b">
        <div className="flex items-center gap-2">
          <HistoryIcon className="size-5" />
          <h1 className="text-xl font-semibold">{t("history.title")}</h1>
          <span className="text-sm text-muted-foreground">
            {t("history.subtitle")}
          </span>
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
              <FileItem
                item={toFileSystemItem(item)}
                className="file-item-root--compact"
                metaText={`${formatDateTime(getHistoryTimestamp(item))}`}
                metaTitle={t("history.readAt")}
                thumbnailTooltip={`${t("history.readAt")}: ${formatDateTime(getHistoryTimestamp(item))}`}
              />
          ))}
        </div>
      ) : (
        <ListTable
          columns={tableColumns}
          rows={data?.items ?? []}
          renderRow={(item) => {
            const target = buildNavigationTarget(
              toFileSystemItem(item),
              isMobile,
            )

            return (
              <tr
                key={`${item.filepath}-${getHistoryTimestamp(item)}`}
                className="border-b last:border-b-0 text-sm hover:bg-muted/50"
              >
                <td className="p-2">
                  <FileNameLinkCell
                    filename={item.filename}
                    filepath={item.filepath}
                    thumbnailUrl={item.thumbnail_url}
                    fileType={item.file_type}
                    target={target}
                  />
                </td>
                <td className="p-2 text-muted-foreground">
                  {formatDateTime(getHistoryTimestamp(item))}
                </td>
                <td className="p-2 text-muted-foreground">
                  {formatFileType(item.file_type)}
                </td>
                <td className="p-2 text-right text-muted-foreground">
                  {item.filesize ? formatFileSize(item.filesize) : "-"}
                </td>
              </tr>
            )
          }}
        />
      )}

      {(data?.total ?? 0) > 0 && (
        <UnifiedPagination
          page={page}
          totalPages={totalPages}
          onPageChange={goToPage}
          jumpLabel={t("history.goTo")}
          confirmLabel={t("history.confirm")}
        />
      )}
    </div>
  )
}
