import { Link } from "@tanstack/react-router"

import { type FileSystemItem, OpenAPI } from "@/client"
import { cn } from "@/lib/utils"

import { FileIcon } from "./FileIcon"
import { formatFileSize } from "./utils"

export function FileItem({ item }: { item: FileSystemItem }) {
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
          : "cursor-default",
      )}
    >
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
