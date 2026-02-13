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
import { useIsMobile } from "@/hooks/useMobile"
import { getBaseName, joinPath, splitPath } from "@/lib/path-utils"
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
  const isMobile = useIsMobile()

  const { data: listData, isLoading: isListLoading } = useQuery({
    queryKey: ["archive-list", path],
    queryFn: () => FilesystemService.listArchive({ path }),
    enabled: !!path,
  })

  const extractMutation = useMutation({
    mutationFn: (page: number) => FilesystemService.extractArchive({ path, page }),
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
        navigate({
          to: isMobile ? "/read-mobile" : "/read",
          search: { path, page: 0, source: "archive", filePath: "" },
          replace: true,
        })
      }
    }
  }, [isMobile, listData, path, navigate])

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
  const pathParts = splitPath(path)
  const fileName = getBaseName(path, "Archive")
  const dirCrumbs = pathParts.slice(0, -1).map((name, index) => ({
    name,
    path: joinPath(pathParts.slice(0, index + 1), path),
  }))

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
        {dirCrumbs.map((crumb) => (
          <div key={crumb.path} className="flex items-center gap-2">
            <ChevronRight className="size-4 text-muted-foreground" />
            <Link
              to="/explorer"
              search={{ path: crumb.path }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Folder className="size-4 inline mr-1" />
              {crumb.name}
            </Link>
          </div>
        ))}
        <ChevronRight className="size-4 text-muted-foreground" />
        <span className="font-medium">{fileName}</span>
      </nav>

      {/* Content - Explorer Mode */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {entries.map((entry) => (
          <ArchiveEntryItem
            key={entry.entry_path}
            entry={entry}
            archivePath={path}
            imageReaderPath={isMobile ? "/read-mobile" : "/read"}
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
  imageReaderPath,
}: {
  entry: { name: string; entry_path: string; file_type: string; index: number }
  archivePath: string
  imageReaderPath: "/read" | "/read-mobile"
}) {
  const isVideo = entry.file_type === "video"
  const isAudio = entry.file_type === "audio"
  const isImage = entry.file_type === "image"
  const isClickable = isVideo || isImage || isAudio

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
        to={imageReaderPath}
        search={{ path: archivePath, page: entry.index, source: "archive", filePath: "" }}
      >
        {content}
      </Link>
    )
  }

  if (isVideo) {
    return (
      <Link
        to="/video"
        search={{ path: archivePath, entry: entry.entry_path, media: "video" }}
      >
        {content}
      </Link>
    )
  }

  if (isAudio) {
    return (
      <Link
        to="/video"
        search={{ path: archivePath, entry: entry.entry_path, media: "audio" }}
      >
        {content}
      </Link>
    )
  }

  return content
}
