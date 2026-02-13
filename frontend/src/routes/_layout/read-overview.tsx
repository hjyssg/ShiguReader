import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { ChevronRight, Folder, Home, Loader2 } from "lucide-react"
import { useEffect, useMemo } from "react"

import { FilesystemService, OpenAPI } from "@/client"
import { useIsMobile } from "@/hooks/useMobile"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/_layout/read-overview")({
  component: ReadOverviewPage,
  validateSearch: (search: Record<string, unknown>) => ({
    path: (search.path as string) || "",
  }),
  head: () => ({
    meta: [{ title: "Read Overview" }],
  }),
})

function ReadOverviewPage() {
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
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 18 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full" />
          ))}
        </div>
      </div>
    )
  }

  const pathParts = path.split(/[/\\]/).filter(Boolean)
  const fileName = pathParts[pathParts.length - 1] || "Archive"
  const parentPath = pathParts.slice(0, -1).join("\\")

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-2 text-sm">
        <Link to="/" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <Home className="size-4" />
          <span>Home</span>
        </Link>
        <ChevronRight className="size-4 text-muted-foreground" />
        {parentPath && (
          <>
            <Link to="/explorer" search={{ path: parentPath }} className="text-muted-foreground hover:text-foreground">
              <Folder className="size-4 inline mr-1" />Explorer
            </Link>
            <ChevronRight className="size-4 text-muted-foreground" />
          </>
        )}
        <Link to="/archive" search={{ path }} className="text-muted-foreground hover:text-foreground">
          {fileName}
        </Link>
        <ChevronRight className="size-4 text-muted-foreground" />
        <span className="font-medium">Overview</span>
      </nav>

      <div className="flex items-center gap-2">
        <Button onClick={() => navigate({ to: isMobile ? "/read-mobile" : "/read", search: { path, page: 0 } })}>
          打开阅读器
        </Button>
        <Button variant="outline" onClick={() => navigate({ to: "/read-waterfall", search: { path } })}>
          Waterfall
        </Button>
        {extractMutation.isPending && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="size-3 animate-spin" /> extracting
          </span>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {imageEntries.map((entry, index) => {
          const imageUrl = `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(entry.entry_path)}`
          return (
            <Link
              key={entry.entry_path}
              to={isMobile ? "/read-mobile" : "/read"}
              search={{ path, page: index }}
              className="group rounded border bg-card overflow-hidden hover:border-primary"
            >
              <div className="aspect-[3/4] bg-muted overflow-hidden">
                <img
                  src={imageUrl}
                  alt={entry.name}
                  className="size-full object-cover group-hover:scale-105 transition-transform"
                  loading="lazy"
                />
              </div>
              <div className="px-2 py-1 text-xs text-muted-foreground truncate">
                {index + 1}. {entry.name}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
