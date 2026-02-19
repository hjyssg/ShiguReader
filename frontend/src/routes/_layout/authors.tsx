/**
 * 作者列表页面 - 显示所有作者及其文件数量，支持排序和搜索
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

type AuthorsResponse = {
  items: {
    name: string
    thumbnail?: string | null
    file_count: number
  }[]
  page: number
  page_size: number
  total: number
}

export const Route = createFileRoute("/_layout/authors")({
  component: AuthorsPage,
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
        title: "Authors",
      },
    ],
  }),
})

function AuthorsPage() {
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
    params.append("scopes", "author")
    return `/search?${params.toString()}`
  }

  const { data, isLoading } = useQuery({
    queryKey: ["authors", page, pageSize, sort_by, sort_order],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        sort_by,
        sort_order,
      })
      const res = await fetch(
        `${OpenAPI.BASE}/api/v1/authors?${params.toString()}`,
      )
      if (!res.ok) {
        throw new Error("Failed to fetch authors")
      }
      return (await res.json()) as AuthorsResponse
    },
  })

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("authors.title")}
        </h1>
        <p className="text-muted-foreground">{t("authors.description")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4 border rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm">{t("authors.sortByField")}</Label>
          <Select
            value={sort_by}
            onValueChange={(v) => {
              navigate({
                to: "/authors",
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
              <SelectItem value="count">{t("authors.fileCount")}</SelectItem>
              <SelectItem value="name">{t("authors.name")}</SelectItem>
              <SelectItem value="recommendation">{t("authors.recommendation")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <SortDirectionToggle
          value={sort_order}
          title={
            sort_order === "asc"
              ? t("authors.ascending")
              : t("authors.descending")
          }
          onToggle={() => {
            navigate({
              to: "/authors",
              search: {
                page: 1,
                sort_by,
                sort_order: sort_order === "asc" ? "desc" : "asc",
              },
            })
          }}
        />
      </div>

      <EntityGrid
        items={data?.items ?? []}
        isLoading={isLoading}
        page={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        onPageChange={(nextPage) => {
          navigate({
            to: "/authors",
            search: {
              page: nextPage,
              sort_by,
              sort_order,
            },
          })
        }}
        getItemHref={(item) => buildSearchHref(item.name)}
        emptyText={t("authors.empty")}
      />
    </div>
  )
}
