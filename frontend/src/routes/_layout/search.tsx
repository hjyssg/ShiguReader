import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Search } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { SearchService } from "@/client"
import { FileViewContainer } from "@/components/Files/FileViewContainer"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Scope = "file" | "author" | "tag"
type Mode = "exact" | "hybrid"

export const Route = createFileRoute("/_layout/search")({
  component: SearchPage,
  validateSearch: (search: Record<string, unknown>) => {
    const q = typeof search.q === "string" ? search.q : ""
    const mode: Mode = search.mode === "exact" ? "exact" : "hybrid"
    const page = Math.max(1, Number(search.page) || 1)

    const rawScopes = search.scopes
    const scopes = Array.isArray(rawScopes)
      ? rawScopes.filter(
          (s): s is Scope => s === "file" || s === "author" || s === "tag",
        )
      : []

    return {
      q,
      mode,
      page,
      scopes: scopes.length > 0 ? scopes : (["file", "author", "tag"] as Scope[]),
    } as { q: string; mode: Mode; page: number; scopes: Scope[] }
  },
  head: () => ({
    meta: [
      {
        title: "Search",
      },
    ],
  }),
})

function SearchPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()

  const [q, setQ] = useState(search.q)
  const [submittedQ, setSubmittedQ] = useState(search.q)
  const [scopes, setScopes] = useState<Scope[]>(search.scopes)
  const [mode, setMode] = useState<Mode>(search.mode)

  const pageSize = 24

  useEffect(() => {
    setQ(search.q)
    setSubmittedQ(search.q)
    setScopes(search.scopes)
    setMode(search.mode)
  }, [search.mode, search.q, search.scopes])

  const { data, isLoading } = useQuery({
    queryKey: ["search", submittedQ, scopes, mode],
    queryFn: () =>
      SearchService.searchFiles({
        requestBody: {
          q: submittedQ,
          scopes,
          mode,
        },
      }),
    enabled: submittedQ.trim().length > 0,
  })

  const toggleScope = (scope: Scope, checked: boolean) => {
    setScopes((prev) => {
      if (checked) {
        if (prev.includes(scope)) return prev
        return [...prev, scope]
      }
      const next = prev.filter((s) => s !== scope)
      return next.length === 0 ? prev : next
    })
  }

  const totalText = useMemo(() => {
    if (!submittedQ) return ""
    return `共 ${data?.total ?? 0} 条结果`
  }, [data?.total, submittedQ])

  const paginatedItems = useMemo(() => {
    if (!data?.items) return []
    const startIndex = (search.page - 1) * pageSize
    const endIndex = startIndex + pageSize
    return data.items.slice(startIndex, endIndex)
  }, [data?.items, search.page, pageSize])

  const totalPages = useMemo(() => {
    if (!data?.items) return 1
    return Math.max(1, Math.ceil(data.items.length / pageSize))
  }, [data?.items, pageSize])

  const visiblePages = useMemo(() => {
    const out: number[] = []
    const start = Math.max(1, search.page - 2)
    const end = Math.min(totalPages, start + 4)
    for (let i = start; i <= end; i += 1) out.push(i)
    return out
  }, [totalPages, search.page])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Search</h1>
        <p className="text-muted-foreground">按文件名 / 作者 / 标签搜索</p>
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setSubmittedQ(q.trim())
              }
            }}
            placeholder="输入关键词..."
          />
          <Button onClick={() => setSubmittedQ(q.trim())} disabled={!q.trim()}>
            <Search className="size-4 mr-1" />
            搜索
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-4">
            <Label className="text-sm">范围</Label>
            <div className="flex items-center gap-3">
              {([
                ["file", "文件"],
                ["author", "作者"],
                ["tag", "标签"],
              ] as [Scope, string][]).map(([value, text]) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={scopes.includes(value)}
                    onCheckedChange={(checked) => toggleScope(value, Boolean(checked))}
                  />
                  {text}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm">模式</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exact">Exact</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {submittedQ ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{totalText}</p>
          <FileViewContainer
            items={paginatedItems}
            isLoading={isLoading}
            storageKeyPrefix="search"
            emptyText="没有找到匹配结果"
          />
          {(data?.total ?? 0) > pageSize && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      if (search.page > 1) {
                        navigate({
                          to: "/search",
                          search: { q: submittedQ, mode, scopes, page: search.page - 1 },
                        })
                      }
                    }}
                  />
                </PaginationItem>

                {visiblePages.map((p) => (
                  <PaginationItem key={p}>
                    <PaginationLink
                      href="#"
                      isActive={p === search.page}
                      onClick={(e) => {
                        e.preventDefault()
                        navigate({
                          to: "/search",
                          search: { q: submittedQ, mode, scopes, page: p },
                        })
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
                      if (search.page < totalPages) {
                        navigate({
                          to: "/search",
                          search: { q: submittedQ, mode, scopes, page: search.page + 1 },
                        })
                      }
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      ) : null}
    </div>
  )
}
