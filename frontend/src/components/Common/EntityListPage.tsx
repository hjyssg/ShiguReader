/**
 * 通用实体列表页 - 供 authors/tags/cosers 页面复用
 * 包含：标题/描述、排序控件、EntityGrid 分页网格
 */
import { useQuery } from "@/shims/react-query"
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

type EntityType = "author" | "tag" | "coser"
type SortOrder = "asc" | "desc"

export type SortOption = {
  value: string
  label: string
}

type EntityItem = {
  name: string
  thumbnail?: string | null
  file_count: number
  recommendation_score?: number | null
}

type EntityListResponse = {
  items: EntityItem[]
  page: number
  page_size: number
  total: number
}

type Props = {
  /** 页面标题 */
  title: string
  /** 页面描述 */
  description: string
  /** API 端点，如 /api/v1/authors */
  apiEndpoint: string
  /** 实体类型，用于 EntityGrid 和搜索跳转 */
  entityType: EntityType
  /** 搜索 scope，如 "author" */
  searchScope: string
  /** 排序字段选项列表 */
  sortOptions: SortOption[]
  /** 排序字段 label */
  sortByLabel: string
  /** 空列表提示文字 */
  emptyText: string
  /** 当前页 */
  page: number
  /** 当前排序字段 */
  sortBy: string
  /** 当前排序方向 */
  sortOrder: SortOrder
  /** 升序 label */
  ascLabel: string
  /** 降序 label */
  descLabel: string
  /** 页码变化回调 */
  onPageChange: (page: number) => void
  /** 排序字段变化回调 */
  onSortByChange: (sortBy: string) => void
  /** 排序方向切换回调 */
  onSortOrderToggle: () => void
}

const PAGE_SIZE = 24

export function EntityListPage({
  title,
  description,
  apiEndpoint,
  entityType,
  searchScope,
  sortOptions,
  sortByLabel,
  emptyText,
  page,
  sortBy,
  sortOrder,
  ascLabel,
  descLabel,
  onPageChange,
  onSortByChange,
  onSortOrderToggle,
}: Props) {
  const { data, isLoading } = useQuery({
    queryKey: [entityType, page, PAGE_SIZE, sortBy, sortOrder],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(PAGE_SIZE),
        sort_by: sortBy,
        sort_order: sortOrder,
      })
      const res = await fetch(`${OpenAPI.BASE}${apiEndpoint}?${params.toString()}`)
      if (!res.ok) throw new Error(`Failed to fetch ${entityType}`)
      return (await res.json()) as EntityListResponse
    },
  })

  const buildSearchHref = (q: string) => {
    const params = new URLSearchParams({ q, mode: "exact", page: "1", presenceFilter: "all" })
    params.append("scopes", searchScope)
    return `/search?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      {/* 排序控件 */}
      <div className="flex flex-wrap items-center gap-4 border rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm">{sortByLabel}</Label>
          <Select value={sortBy} onValueChange={onSortByChange}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <SortDirectionToggle
          value={sortOrder}
          title={sortOrder === "asc" ? ascLabel : descLabel}
          onToggle={onSortOrderToggle}
        />
      </div>

      {/* 实体网格 */}
      <EntityGrid
        items={(data?.items ?? []).map((item) => ({ ...item, entityType }))}
        isLoading={isLoading}
        page={page}
        pageSize={PAGE_SIZE}
        total={data?.total ?? 0}
        onPageChange={onPageChange}
        getItemHref={(item) => buildSearchHref(item.name)}
        emptyText={emptyText}
      />
    </div>
  )
}
