import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { OpenAPI } from "@/client"
import { EntityGrid } from "@/components/Common/EntityGrid"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type SortBy = "count" | "name"
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
    const sort_by: SortBy = search.sort_by === "name" ? "name" : "count"
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
  const navigate = useNavigate()
  const { page, sort_by, sort_order } = Route.useSearch()
  const pageSize = 24

  const { data, isLoading } = useQuery({
    queryKey: ["authors", page, pageSize, sort_by, sort_order],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        sort_by,
        sort_order,
      })
      const res = await fetch(`${OpenAPI.BASE}/api/v1/authors?${params.toString()}`)
      if (!res.ok) {
        throw new Error("Failed to fetch authors")
      }
      return (await res.json()) as AuthorsResponse
    },
  })

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Authors</h1>
        <p className="text-muted-foreground">按作者浏览文件集合</p>
      </div>

      <div className="flex flex-wrap items-center gap-4 border rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm">排序字段</Label>
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
              <SelectItem value="count">文件数量</SelectItem>
              <SelectItem value="name">名称</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm">排序方向</Label>
          <Select
            value={sort_order}
            onValueChange={(v) => {
              navigate({
                to: "/authors",
                search: {
                  page: 1,
                  sort_by,
                  sort_order: v as SortOrder,
                },
              })
            }}
          >
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">降序</SelectItem>
              <SelectItem value="asc">升序</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
        onCardClick={(item) => {
          navigate({
            to: "/search",
            search: {
              q: item.name,
              scopes: ["author"],
              mode: "hybrid",
            },
          })
        }}
        emptyText="暂无作者数据"
      />
    </div>
  )
}
