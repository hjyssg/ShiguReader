import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  ChevronRight,
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileVideo,
  Folder,
  Home,
} from "lucide-react"

import { FilesystemService, type FileSystemItem, OpenAPI } from "@/client"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_layout/explorer")({
  component: Explorer,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      path: (search.path as string) || "",
    }
  },
  head: () => ({
    meta: [
      {
        title: "File Explorer",
      },
    ],
  }),
})

function Explorer() {
  const { path } = Route.useSearch()

  const { data, isLoading } = useQuery({
    queryKey: ["fs-list", path],
    queryFn: () => FilesystemService.listDirectory({ path }),
    enabled: !!path,
  })

  // Parse breadcrumb from path
  const pathParts = path.split(/[/\\]/).filter(Boolean)
  const breadcrumbs = pathParts.map((part, index) => {
    const fullPath = pathParts.slice(0, index + 1).join("\\")
    return { name: part, path: fullPath }
  })

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
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.path} className="flex items-center gap-2">
            <ChevronRight className="size-4 text-muted-foreground" />
            {index === breadcrumbs.length - 1 ? (
              <span className="font-medium">{crumb.name}</span>
            ) : (
              <Link
                to="/explorer"
                search={{ path: crumb.path }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {crumb.name}
              </Link>
            )}
          </div>
        ))}
      </nav>

      {/* File Grid */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {isLoading ? (
          <>
            {[...Array(12)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-square w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </>
        ) : (
          data?.items.map((item) => (
            <FileItem key={item.path} item={item} />
          ))
        )}
      </div>

      {!isLoading && data?.items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Folder className="size-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">This folder is empty</p>
        </div>
      )}
    </div>
  )
}

function FileItem({ item }: { item: FileSystemItem }) {
  const isFolder = item.item_type === "folder"
  const isArchive = item.file_type === "archive"
  const isVideo = item.file_type === "video"
  const isClickable = isFolder || isArchive || isVideo

  const content = (
    <div
      className={cn(
        "group relative rounded-lg border bg-card transition-all",
        isClickable
          ? "cursor-pointer hover:border-primary hover:shadow-md"
          : "cursor-default"
      )}
    >
      {/* Thumbnail/Icon */}
      <div className="aspect-square w-full overflow-hidden rounded-t-lg bg-muted flex items-center justify-center">
        {item.thumbnail_url ? (
          <img
            src={`${OpenAPI.BASE}${item.thumbnail_url}`}
            alt={item.name}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <FileIcon fileType={item.file_type} isFolder={isFolder} />
        )}
      </div>

      {/* Name */}
      <div className="p-2">
        <p className="text-sm truncate" title={item.name}>
          {item.name}
        </p>
        {!isFolder && item.filesize && (
          <p className="text-xs text-muted-foreground">
            {formatFileSize(item.filesize)}
          </p>
        )}
      </div>
    </div>
  )

  if (isFolder) {
    return (
      <Link to="/explorer" search={{ path: item.path }}>
        {content}
      </Link>
    )
  }

  if (isArchive) {
    return (
      <Link to="/archive" search={{ path: item.path }}>
        {content}
      </Link>
    )
  }

  if (isVideo) {
    return (
      <Link to="/video" search={{ path: item.path, entry: undefined }}>
        {content}
      </Link>
    )
  }

  return content
}

function FileIcon({
  fileType,
  isFolder,
}: {
  fileType?: string | null
  isFolder: boolean
}) {
  const iconClass = "size-12 text-muted-foreground"

  if (isFolder) {
    return <Folder className={iconClass} />
  }

  switch (fileType) {
    case "image":
      return <FileImage className={iconClass} />
    case "video":
      return <FileVideo className={iconClass} />
    case "archive":
      return <FileArchive className={iconClass} />
    case "audio":
      return <FileAudio className={iconClass} />
    default:
      return <File className={iconClass} />
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
