/**
 * 标签列表页面 - 显示所有标签及其文件数量，支持排序和搜索
 */
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { OpenAPI } from "@/client"
import { EntityGrid } from "@/components/Common/EntityGrid"
import { SortDirectionToggle } from "@/components/Common/SortDirectionToggle"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type SortBy = "count" | "name" | "recommendation"
type SortOrder = "asc" | "desc"

type TagsResponse = {
  items: {
    name: string
    thumbnail?: string | null
    file_count: number
    avg_rec_score?: number | null
  }[]
  page: number
  page_size: number
  total: number
}

export const Route = createFileRoute("/_layout/tags")({
  component: TagsPage,
  validateSearch: (search: Record<string, unknown>) => {
    const page = Math.max(1, Number(search.page) || 1)
    const sort_by: SortBy =
      search.sort_by === "name"
        ? "name"
        : search.sort_by === "recommendation"
          ? "recommendation"
          : "count"
    const sort_order: SortOrder = search.sort_order === "asc" ? "asc" : "desc"

    return {
      page,
      sort_by,
      sort_order,
    }
  },
  head: () => ({
    meta: [
      {
        title: "Tags",
      },
    ],
  }),
})

function TagsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { page, sort_by, sort_order } = Route.useSearch()
  const pageSize = 24
  const buildSearchHref = (q: string) => {
    const params = new URLSearchParams({
      q,
      mode: "hybrid",
      page: "1",
      presenceFilter: "all",
    })
    params.append("scopes", "tag")
    return `/search?${params.toString()}`
  }

  const { data, isLoading } = useQuery({
    queryKey: ["tags", page, pageSize, sort_by, sort_order],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        sort_by,
        sort_order,
      })
      const res = await fetch(
        `${OpenAPI.BASE}/api/v1/tags?${params.toString()}`,
      )
      if (!res.ok) {
        throw new Error("Failed to fetch tags")
      }
      return (await res.json()) as TagsResponse
    },
  })

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("tags.title")}</h1>
        <p className="text-muted-foreground">{t("tags.description")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4 border rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm">{t("tags.sortByField")}</Label>
          <Select
            value={sort_by}
            onValueChange={(v) => {
              navigate({
                to: "/tags",
                search: {
                  page: 1,
                  sort_by: v as SortBy,
                  sort_order,
                },
              })
            }}
          >
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="count">{t("tags.fileCount")}</SelectItem>
              <SelectItem value="name">{t("tags.name")}</SelectItem>
              <SelectItem value="recommendation">{t("tags.recommendation")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm">{t("tags.sortDirection")}</Label>
          <SortDirectionToggle
            value={sort_order}
            title={
              sort_order === "asc" ? t("tags.ascending") : t("tags.descending")
            }
            onToggle={() => {
              navigate({
                to: "/tags",
                search: {
                  page: 1,
                  sort_by,
                  sort_order: sort_order === "asc" ? "desc" : "asc",
                },
              })
            }}
          />
        </div>
      </div>

      <EntityGrid
        items={(data?.items ?? []).map((item) => ({ ...item, entityType: "tag" as const }))}
        isLoading={isLoading}
        page={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        onPageChange={(nextPage) => {
          navigate({
            to: "/tags",
            search: {
              page: nextPage,
              sort_by,
              sort_order,
            },
          })
        }}
        getItemHref={(item) => buildSearchHref(item.name)}
        emptyText={t("tags.empty")}
      />
    </div>
  )
}
