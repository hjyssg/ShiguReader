/**
 * 搜索页面 - 支持文件、作者、Coser、标签的多维度搜索
 */
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ExternalLink, Search } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { SearchService } from "@/client"
import { FileViewContainer } from "@/components/Files/FileViewContainer"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Scope = "file" | "author" | "coser" | "tag"
type Mode = "exact" | "hybrid"
type PresenceFilter = "all" | "watched" | "scanned_recent"

export const Route = createFileRoute("/_layout/search")({
  component: SearchPage,
  validateSearch: (search: Record<string, unknown>) => {
    const q = typeof search.q === "string" ? search.q : ""
    const mode: Mode = search.mode === "exact" ? "exact" : "hybrid"
    const page = Math.max(1, Number(search.page) || 1)
    const presenceFilter: PresenceFilter =
      search.presenceFilter === "watched" ||
      search.presenceFilter === "scanned_recent"
        ? search.presenceFilter
        : "all"

    const rawScopes = search.scopes
    const scopes = Array.isArray(rawScopes)
      ? rawScopes.filter(
          (s): s is Scope =>
            s === "file" || s === "author" || s === "coser" || s === "tag",
        )
      : []

    return {
      q,
      mode,
      page,
      presenceFilter,
      scopes:
        scopes.length > 0
          ? scopes
          : (["file", "author", "coser", "tag"] as Scope[]),
    } as {
      q: string
      mode: Mode
      page: number
      scopes: Scope[]
      presenceFilter: PresenceFilter
    }
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
  const { t } = useTranslation()
  const search = Route.useSearch()
  const navigate = useNavigate()

  const [q, setQ] = useState(search.q)
  const [submittedQ, setSubmittedQ] = useState(search.q)
  const [scopes, setScopes] = useState<Scope[]>(search.scopes)
  const [mode, setMode] = useState<Mode>(search.mode)
  const [presenceFilter, setPresenceFilter] = useState<PresenceFilter>(
    search.presenceFilter,
  )
  const [jumpPage, setJumpPage] = useState("")

  const pageSize = 24

  useEffect(() => {
    setQ(search.q)
    setSubmittedQ(search.q)
    setScopes(search.scopes)
    setMode(search.mode)
    setPresenceFilter(search.presenceFilter)
  }, [search.mode, search.presenceFilter, search.q, search.scopes])

  const { data, isLoading } = useQuery({
    queryKey: ["search", submittedQ, scopes, mode, presenceFilter],
    queryFn: () =>
      SearchService.searchFiles({
        requestBody: {
          q: submittedQ,
          scopes,
          mode,
          presence_filter: presenceFilter,
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
    return t("search.resultCount", { count: data?.total ?? 0 })
  }, [data?.total, submittedQ, t])

  const paginatedItems = useMemo(() => {
    if (!data?.items) return []
    const startIndex = (search.page - 1) * pageSize
    const endIndex = startIndex + pageSize
    return data.items.slice(startIndex, endIndex)
  }, [data?.items, search.page])

  const totalPages = useMemo(() => {
    if (!data?.items) return 1
    return Math.max(1, Math.ceil(data.items.length / pageSize))
  }, [data?.items])

  const visiblePages = useMemo(() => {
    const out: number[] = []
    const start = Math.max(1, search.page - 2)
    const end = Math.min(totalPages, start + 4)
    for (let i = start; i <= end; i += 1) out.push(i)
    return out
  }, [totalPages, search.page])

  const goToPage = (nextPage: number) => {
    const target = Math.min(totalPages, Math.max(1, nextPage))
    if (target !== search.page) {
      navigate({
        to: "/search",
        search: {
          q: submittedQ,
          mode,
          scopes,
          page: target,
          presenceFilter,
        },
      })
    }
  }

  const trimmedQ = submittedQ.trim()
  const externalLinks = useMemo(
    () => [
      {
        label: "ExHentai",
        href: `https://exhentai.org/?f_search=${encodeURIComponent(trimmedQ)}`,
      },
      {
        label: "Sukebei",
        href: `https://sukebei.nyaa.si/?f=0&c=0_0&q=${encodeURIComponent(trimmedQ)}`,
      },
    ],
    [trimmedQ],
  )

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("search.title")}
        </h1>
        <p className="text-muted-foreground">{t("search.description")}</p>
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
            placeholder={t("search.placeholder")}
          />
          <Button onClick={() => setSubmittedQ(q.trim())} disabled={!q.trim()}>
            <Search className="size-4 mr-1" />
            {t("search.searchButton")}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-4">
            <Label className="text-sm">{t("search.scope")}</Label>
            <div className="flex items-center gap-3">
              {(
                [
                  ["file", t("search.file")],
                  ["author", t("search.author")],
                  ["coser", t("search.coser")],
                  ["tag", t("search.tag")],
                ] as [Scope, string][]
              ).map(([value, text]) => {
                const checkboxId = `scope-${value}`

                return (
                  <div key={value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id={checkboxId}
                      checked={scopes.includes(value)}
                      onCheckedChange={(checked) =>
                        toggleScope(value, Boolean(checked))
                      }
                    />
                    <Label htmlFor={checkboxId}>{text}</Label>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm">{t("search.mode")}</Label>
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

          <div className="flex items-center gap-2">
            <Label className="text-sm">Presence</Label>
            <Select
              value={presenceFilter}
              onValueChange={(v) => setPresenceFilter(v as PresenceFilter)}
            >
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="watched">Watched only</SelectItem>
                <SelectItem value="scanned_recent">
                  Scanned &lt; 10min
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

                <div className="flex flex-wrap items-center gap-2">
          {externalLinks.map((item) => (
            <Button
              key={item.label}
              asChild
              variant="outline"
              size="sm"
              disabled={!trimmedQ}
              className="h-8"
            >
              <a href={item.href} target="_blank" rel="noreferrer noopener">
                <ExternalLink className="size-3.5 mr-1" />
                {item.label}
              </a>
            </Button>
          ))}
        </div>
      </div>

      {submittedQ ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{totalText}</p>
          <FileViewContainer
            items={paginatedItems}
            isLoading={isLoading}
            storageKeyPrefix="search"
            emptyText={t("search.noResults")}
          />
          {(data?.total ?? 0) > pageSize && (
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
                      className={
                        search.page <= 1
                          ? "pointer-events-none opacity-50"
                          : undefined
                      }
                    />
                  </PaginationItem>

                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        goToPage(search.page - 1)
                      }}
                      className={
                        search.page <= 1
                          ? "pointer-events-none opacity-50"
                          : undefined
                      }
                    />
                  </PaginationItem>

                  {visiblePages.map((p) => (
                    <PaginationItem key={p}>
                      <PaginationLink
                        href="#"
                        isActive={p === search.page}
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
                        goToPage(search.page + 1)
                      }}
                      className={
                        search.page >= totalPages
                          ? "pointer-events-none opacity-50"
                          : undefined
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
                        search.page >= totalPages
                          ? "pointer-events-none opacity-50"
                          : undefined
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>

              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {t("search.goTo")}
                </span>
                <Input
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
                  className="h-8 w-20"
                  placeholder={`1-${totalPages}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const n = Number(jumpPage)
                    if (!Number.isNaN(n)) goToPage(n)
                  }}
                >
                  {t("search.confirm")}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
