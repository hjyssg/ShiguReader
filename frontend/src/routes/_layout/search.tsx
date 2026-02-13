import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Search } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { SearchService } from "@/client"
import { FileList } from "@/components/Files/FileList"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

    const rawScopes = search.scopes
    const scopes = Array.isArray(rawScopes)
      ? rawScopes.filter(
          (s): s is Scope => s === "file" || s === "author" || s === "tag",
        )
      : []

    return {
      q,
      mode,
      scopes: scopes.length > 0 ? scopes : (["file", "author", "tag"] as Scope[]),
    } as { q: string; mode: Mode; scopes: Scope[] }
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

  const [q, setQ] = useState(search.q)
  const [submittedQ, setSubmittedQ] = useState(search.q)
  const [scopes, setScopes] = useState<Scope[]>(search.scopes)
  const [mode, setMode] = useState<Mode>(search.mode)

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
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{totalText}</p>
          <FileList
            items={data?.items || []}
            isLoading={isLoading}
            storageKeyPrefix="search"
            emptyText="没有找到匹配结果"
          />
        </div>
      ) : null}
    </div>
  )
}
