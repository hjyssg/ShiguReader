import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { ChevronLeft, ChevronRight, Folder, Home } from "lucide-react"
import { useEffect } from "react"

import { FilesystemService, OpenAPI } from "@/client"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_layout/reader")({
  component: Reader,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      path: (search.path as string) || "",
      page: Number(search.page) || 0,
    }
  },
  head: () => ({
    meta: [
      {
        title: "Image Reader",
      },
    ],
  }),
})

function Reader() {
  const { path, page } = Route.useSearch()
  const navigate = useNavigate()

  const { data: listData, isLoading } = useQuery({
    queryKey: ["archive-list", path],
    queryFn: () => FilesystemService.listArchive({ path }),
    enabled: !!path,
  })

  const imageEntries = listData?.entries.filter((e) => e.file_type === "image") || []
  const totalPages = imageEntries.length
  const currentPage = Math.min(Math.max(0, page), totalPages - 1)
  const currentEntry = imageEntries[currentPage]

  const goNext = () => {
    if (currentPage < totalPages - 1) {
      navigate({
        to: "/reader",
        search: { path, page: currentPage + 1 },
      })
    }
  }

  const goPrev = () => {
    if (currentPage > 0) {
      navigate({
        to: "/reader",
        search: { path, page: currentPage - 1 },
      })
    }
  }

  const goToPage = (newPage: number) => {
    navigate({
      to: "/reader",
      search: { path, page: newPage },
    })
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext()
      if (e.key === "ArrowLeft") goPrev()
      if (e.key === "Escape") {
        navigate({ to: "/archive", search: { path } })
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentPage, totalPages, path])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!currentEntry) {
    return <div>No images found</div>
  }

  // Parse breadcrumb
  const pathParts = path.split(/[/\\]/).filter(Boolean)
  const fileName = pathParts[pathParts.length - 1] || "Archive"
  const parentPath = pathParts.slice(0, -1).join("\\")

  const imageUrl = `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(currentEntry.entry_path)}`

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link
          to="/"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Home className="size-4" />
          <span>Home</span>
        </Link>
        <ChevronRight className="size-4 text-muted-foreground" />
        {parentPath && (
          <>
            <Link
              to="/explorer"
              search={{ path: parentPath }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Folder className="size-4 inline mr-1" />
              Explorer
            </Link>
            <ChevronRight className="size-4 text-muted-foreground" />
          </>
        )}
        <Link
          to="/archive"
          search={{ path }}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {fileName}
        </Link>
        <ChevronRight className="size-4 text-muted-foreground" />
        <span className="font-medium">Reader</span>
      </nav>

      {/* Image display */}
      <div className="relative bg-muted rounded-lg overflow-hidden flex items-center justify-center min-h-[600px]">
        <img
          src={imageUrl}
          alt={currentEntry.name}
          className="max-w-full max-h-[80vh] object-contain"
          loading="lazy"
        />

        {/* Navigation buttons */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
          onClick={goPrev}
          disabled={currentPage === 0}
        >
          <ChevronLeft className="size-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
          onClick={goNext}
          disabled={currentPage === totalPages - 1}
        >
          <ChevronRight className="size-6" />
        </Button>
      </div>

      {/* Page info */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{currentEntry.name}</p>
        <p className="text-sm text-muted-foreground">
          {currentPage + 1} / {totalPages}
        </p>
      </div>
    </div>
  )
}
