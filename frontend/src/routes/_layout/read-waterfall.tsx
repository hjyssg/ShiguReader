import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { ChevronRight, Folder, Home } from "lucide-react"
import { useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"

import { FilesystemService, OpenAPI } from "@/client"
import { ExtractingIndicator } from "@/components/semantic/layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useIsMobile } from "@/hooks/useMobile"
import { getBaseName, joinPath, splitPath } from "@/lib/path-utils"
import "./read.css"

export const Route = createFileRoute("/_layout/read-waterfall")({
  component: ReadWaterfallPage,
  validateSearch: (search: Record<string, unknown>) => ({
    path: (search.path as string) || "",
  }),
  head: () => ({
    meta: [{ title: "Read Waterfall" }],
  }),
})

function ReadWaterfallPage() {
  const { t } = useTranslation()
  const { path } = Route.useSearch()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const { data: listData, isLoading } = useQuery({
    queryKey: ["archive-list", path],
    queryFn: () => FilesystemService.listArchive({ path }),
    enabled: !!path,
  })

  const extractMutation = useMutation({
    mutationFn: () => FilesystemService.extractArchive({ path, page: 0 }),
  })

  useEffect(() => {
    if (path) {
      extractMutation.mutate()
    }
  }, [path])

  const imageEntries = useMemo(
    () => listData?.entries.filter((e) => e.file_type === "image") || [],
    [listData],
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[70vh] w-full" />
      </div>
    )
  }

  const pathParts = splitPath(path)
  const fileName = getBaseName(path, "Archive")
  const dirCrumbs = pathParts.slice(0, -1).map((name, index) => ({
    name,
    path: joinPath(pathParts.slice(0, index + 1), path),
  }))

  return (
    <div className="reader-waterfall-page">
      <nav className="reader-waterfall-breadcrumb">
        <Link to="/" className="reader-waterfall-breadcrumb__home-link">
          <Home className="size-4" />
          <span>Home</span>
        </Link>
        {dirCrumbs.map((crumb) => (
          <div key={crumb.path} className="reader-waterfall-breadcrumb__item">
            <ChevronRight className="size-4 text-muted-foreground" />
            <Link
              to="/explorer"
              search={{ path: crumb.path }}
              className="reader-waterfall-breadcrumb__link"
            >
              <Folder className="size-4 inline mr-1" />
              {crumb.name}
            </Link>
          </div>
        ))}
        <ChevronRight className="size-4 text-muted-foreground" />
        <Link
          to="/archive"
          search={{ path }}
          className="reader-waterfall-breadcrumb__link"
        >
          {fileName}
        </Link>
        <ChevronRight className="size-4 text-muted-foreground" />
        <span className="font-medium">Waterfall</span>
      </nav>

      <div className="reader-waterfall-actions">
        <Button
          onClick={() =>
            navigate({
              to: isMobile ? "/read-mobile" : "/read",
              search: { path, page: 0, source: "archive", filePath: "" },
            })
          }
        >
          {t("reader.openReader")}
        </Button>
        <ExtractingIndicator
          status={extractMutation.data?.status}
          variant="inline"
        />
      </div>

      <div className="reader-waterfall-list">
        {imageEntries.map((entry, index) => {
          const imageUrl = `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(entry.entry_path)}`
          return (
            <Link
              key={entry.entry_path}
              to={isMobile ? "/read-mobile" : "/read"}
              search={{ path, page: index, source: "archive", filePath: "" }}
              className="reader-waterfall-item"
            >
              <img
                src={imageUrl}
                alt={entry.name}
                className="reader-waterfall-item__image"
                loading="lazy"
              />
              <div className="reader-waterfall-item__caption">
                {index + 1}. {entry.name}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
