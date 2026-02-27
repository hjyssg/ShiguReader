/**
 * 搜索页面 - 支持文件、作者、Coser、标签的多维度搜索，以及本地持有检查
 */
import { useQuery } from "@/shims/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ExternalLink, Search } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { OpenAPI, SearchService } from "@/client"
import { FileViewContainer } from "@/components/Files/FileViewContainer"
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

type Scope = "file" | "author" | "coser" | "tag"
type Mode = "exact" | "hybrid" | "local-check"
type PresenceFilter = "all" | "watched" | "scanned_recent"

export const Route = createFileRoute("/_layout/search")({
  component: SearchPage,
  validateSearch: (search: Record<string, unknown>) => {
    const q = typeof search.q === "string" ? search.q : ""
    const mode: Mode =
      search.mode === "exact"
        ? "exact"
        : search.mode === "local-check"
          ? "local-check"
          : "hybrid"
    const page = Math.max(1, Number(search.page) || 1)
    const presenceFilter: PresenceFilter =
      search.presenceFilter === "watched" ||
      search.presenceFilter === "scanned_recent"
        ? search.presenceFilter
        : "all"

    const rawScopes = search.scopes
    const validScope = (s: unknown): s is Scope =>
      s === "file" || s === "author" || s === "coser" || s === "tag"

    const scopesList: unknown[] = Array.isArray(rawScopes)
      ? rawScopes
      : typeof rawScopes === "string"
        ? (JSON.parse(rawScopes) as unknown[])
        : []

    const scopes: Scope[] = scopesList.length > 0
      ? scopesList.filter(validScope)
      : ["file", "author", "coser", "tag"]

    return {
      q,
      mode,
      page,
      presenceFilter,
      scopes,
    } as {
      q: string
      mode: Mode
      page: number
      scopes: Scope[]
      presenceFilter: PresenceFilter
    }
  },
  head: () => ({
    meta: [{ title: "Search" }],
  }),
})

type ScopeCheckboxProps = {
  value: Scope
  label: string
  checked: boolean
  onToggle: (scope: Scope, checked: boolean) => void
}

function ScopeCheckbox({ value, label, checked, onToggle }: ScopeCheckboxProps) {
  const checkboxId = `scope-${value}`
  return (
    <div className="flex items-center gap-1 text-sm">
      <Checkbox
        id={checkboxId}
        checked={checked}
        onCheckedChange={(checked) => onToggle(value, Boolean(checked))}
      />
      <Label htmlFor={checkboxId}>{label}</Label>
    </div>
  )
}

type ExternalSearchLinkProps = {
  label: string
  href: string
  disabled: boolean
}

function ExternalSearchLink({ label, href, disabled }: ExternalSearchLinkProps) {
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      disabled={disabled}
      className="h-8"
    >
      <a href={href} target="_blank" rel="noreferrer noopener">
        <ExternalLink className="size-3.5 mr-1" />
        {label}
      </a>
    </Button>
  )
}

const SCOPE_OPTIONS: Array<{ value: Scope; labelKey: string }> = [
  { value: "file", labelKey: "search.file" },
  { value: "author", labelKey: "search.author" },
  { value: "coser", labelKey: "search.coser" },
  { value: "tag", labelKey: "search.tag" },
]

const PAGE_SIZE_OPTIONS = [24, 48, 100] as const
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0]

type LocalCheckHit = {
  name: string
  path: string
  thumbnail_url: string | null
  match_level: "downloaded" | "likely" | "same_author" | "different"
  confidence: number
}

function useLocalCheckQuery(q: string, presenceFilter: PresenceFilter) {
  return useQuery({
    queryKey: ["local-check", q, presenceFilter],
    queryFn: async () => {
      const res = await fetch(`${OpenAPI.BASE}/api/search/local-check-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queries: [q],
          limit: 10,
          presence_filter: presenceFilter,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { results: Array<{ q: string; hits: LocalCheckHit[] }> }
      return data.results[0]?.hits ?? []
    },
    enabled: q.trim().length > 0,
  })
}

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
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)

  useEffect(() => {
    setQ(search.q)
    setSubmittedQ(search.q)
    setScopes(search.scopes)
    setMode(search.mode)
    setPresenceFilter(search.presenceFilter)
  }, [search.mode, search.presenceFilter, search.q, search.scopes])

  // Normal file search
  const { data: fileData, isLoading: fileLoading } = useQuery({
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
    enabled: submittedQ.trim().length > 0 && mode !== "local-check",
  })

  // Local-check mode
  const { data: localCheckHits, isLoading: localCheckLoading } = useLocalCheckQuery(
    mode === "local-check" ? submittedQ : "",
    presenceFilter,
  )

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
    if (mode === "local-check") {
      return t("search.resultCount", { count: localCheckHits?.length ?? 0 })
    }
    return t("search.resultCount", { count: fileData?.total ?? 0 })
  }, [fileData?.total, localCheckHits?.length, mode, submittedQ, t])

  const goToPage = (nextPage: number) => {
    const target = Math.max(1, nextPage)
    if (target !== search.page) {
      navigate({
        to: "/search",
        search: { q: submittedQ, mode, scopes, page: target, presenceFilter },
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

  // Convert local-check hits to FileSystemItem for FileViewContainer
  const localCheckItems = useMemo(() => {
    if (!localCheckHits) return []
    return localCheckHits.map((h) => ({
      name: h.name,
      path: h.path,
      item_type: "file" as const,
      file_type: "archive" as const,
      filesize: null,
      mtime: null,
      thumbnail_url: h.thumbnail_url,
    }))
  }, [localCheckHits])

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
          {mode !== "local-check" && (
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-4">
                {SCOPE_OPTIONS.map((option) => (
                  <ScopeCheckbox
                    key={option.value}
                    value={option.value}
                    label={t(option.labelKey)}
                    checked={scopes.includes(option.value)}
                    onToggle={toggleScope}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Label className="text-sm">{t("search.mode")}</Label>
            <Select
              value={mode}
              onValueChange={(v) => {
                const newMode = v as Mode
                setMode(newMode)
                navigate({
                  to: "/search",
                  search: { q: submittedQ, mode: newMode, scopes, page: 1, presenceFilter },
                })
              }}
            >
              <SelectTrigger className="w-[160px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exact">{t("search.modeExact")}</SelectItem>
                <SelectItem value="hybrid">{t("search.modeHybrid")}</SelectItem>
                <SelectItem value="local-check">{t("search.modeLocalCheck")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm">{t("search.presence")}</Label>
            <Select
              value={presenceFilter}
              onValueChange={(v) => {
                const newFilter = v as PresenceFilter
                setPresenceFilter(newFilter)
                navigate({
                  to: "/search",
                  search: { q: submittedQ, mode, scopes, page: 1, presenceFilter: newFilter },
                })
              }}
            >
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("search.presenceAll")}</SelectItem>
                <SelectItem value="watched">{t("search.presenceWatched")}</SelectItem>
                <SelectItem value="scanned_recent">
                  {t("search.presenceScannedRecent")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {externalLinks.map((item) => (
            <ExternalSearchLink
              key={item.label}
              label={item.label}
              href={item.href}
              disabled={!trimmedQ}
            />
          ))}
        </div>
      </div>

      {submittedQ ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{totalText}</p>
          {mode === "local-check" ? (
            <FileViewContainer
              items={localCheckItems}
              isLoading={localCheckLoading}
              emptyText={t("search.noResults")}
            />
          ) : (
            <FileViewContainer
              items={fileData?.items ?? []}
              isLoading={fileLoading}
              pagination={{
                page: search.page,
                pageSize,
                onChange: ({ page }) => goToPage(page),
                onPageSizeChange: (nextPageSize) => {
                  setPageSize(nextPageSize)
                  if (search.page !== 1) {
                    goToPage(1)
                  }
                },
                pageSizeOptions: PAGE_SIZE_OPTIONS,
                pageSizeLabel: "Page size",
              }}
              emptyText={t("search.noResults")}
            />
          )}
        </div>
      ) : null}
    </div>
  )
}
