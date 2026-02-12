import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import {
  ChevronRight,
  FileAudio,
  FileVideo,
  Folder,
  Home,
  Loader2,
} from "lucide-react"
import { useEffect } from "react"

import { FilesystemService, OpenAPI } from "@/client"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_layout/archive")({
  component: Archive,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      path: (search.path as string) || "",
    }
  },
  head: () => ({
    meta: [
      {
        title: "Archive Viewer",
      },
    ],
  }),
})

function Archive() {
  const { path } = Route.useSearch()
  const navigate = useNavigate()

  const { data: listData, isLoading: isListLoading } = useQuery({
    queryKey: ["archive-list", path],
    queryFn: () => FilesystemService.listArchive({ path }),
    enabled: !!path,
  })

  const extractMutation = useMutation({
    mutationFn: (page: number) =>
      FilesystemService.extractArchive({ path, page: 0 }),
  })

  useEffect(() => {
    if (listData && !extractMutation.data) {
      extractMutation.mutate(0)
    }
  }, [listData])

  // Check if pure image archive and redirect to reader
  useEffect(() => {
    if (listData) {
      const hasOnlyImages = listData.entries.every((e) => e.file_type === "image")
      if (hasOnlyImages && listData.entries.length > 0) {
        navigate({ to: "/reader", search: { path, page: 0 }, replace: true })
      }
    }
  }, [listData, path, navigate])

  if (isListLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!listData) {
    return <div>Failed to load archive</div>
  }

  const entries = listData.entries

  // Parse breadcrumb
  const pathParts = path.split(/[/\\]/).filter(Boolean)
  const fileName = pathParts[pathParts.length - 1] || "Archive"
  const parentPath = pathParts.slice(0, -1).join("\\")

  return (
    <div className="space-y-6">
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
        <span className="font-medium">{fileName}</span>
      </nav>

      {/* Content - Explorer Mode */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {entries.map((entry) => (
          <ArchiveEntryItem
            key={entry.entry_path}
            entry={entry}
            archivePath={path}
          />
        ))}
      </div>

      {/* Extraction status */}
      {extractMutation.isPending && (
        <div className="fixed bottom-4 right-4 bg-card border rounded-lg p-4 shadow-lg flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-sm">Extracting archive...</span>
        </div>
      )}
    </div>
  )
}

function ArchiveEntryItem({
  entry,
  archivePath,
}: {
  entry: { name: string; entry_path: string; file_type: string; index: number }
  archivePath: string
}) {
  const isVideo = entry.file_type === "video"
  const isAudio = entry.file_type === "audio"
  const isImage = entry.file_type === "image"
  const isClickable = isVideo || isImage

  const fileUrl = `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(archivePath)}&entry=${encodeURIComponent(entry.entry_path)}`

  const content = (
    <div
      className={cn(
        "group relative rounded-lg border bg-card transition-all",
        isClickable ? "cursor-pointer hover:border-primary hover:shadow-md" : ""
      )}
    >
      {/* Thumbnail/Icon */}
      <div className="aspect-square w-full overflow-hidden rounded-t-lg bg-muted flex items-center justify-center">
        {isImage ? (
          <img
            src={fileUrl}
            alt={entry.name}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : isVideo ? (
          <FileVideo className="size-12 text-muted-foreground" />
        ) : isAudio ? (
          <FileAudio className="size-12 text-muted-foreground" />
        ) : (
          <div className="size-12 text-muted-foreground" />
        )}
      </div>

      {/* Name */}
      <div className="p-2">
        <p className="text-sm truncate" title={entry.name}>
          {entry.name}
        </p>
      </div>
    </div>
  )

  if (isImage) {
    return (
      <Link
        to="/reader"
        search={{ path: archivePath, page: entry.index }}
      >
        {content}
      </Link>
    )
  }

  if (isVideo) {
    return (
      <Link
        to="/video"
        search={{ path: archivePath, entry: entry.entry_path }}
      >
        {content}
      </Link>
    )
  }

  return content
}
