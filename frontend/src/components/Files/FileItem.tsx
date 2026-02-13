import { Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { type FileSystemItem, OpenAPI } from "@/client"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import { FileIcon } from "./FileIcon"
import { formatFileSize } from "./utils"

function ThumbnailImage({
  src,
  alt,
  fileType,
  isFolder,
}: {
  src: string
  alt: string
  fileType?: string | null
  isFolder: boolean
}) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setIsLoaded(false)
    setHasError(false)
  }, [src])

  if (hasError) {
    return (
      <div className="size-full flex items-center justify-center bg-muted">
        <FileIcon fileType={fileType} isFolder={isFolder} />
      </div>
    )
  }

  return (
    <div className="relative size-full">
      {!isLoaded && <Skeleton className="absolute inset-0 size-full rounded-none" />}
      <img
        src={src}
        alt={alt}
        className={cn("size-full object-cover", !isLoaded && "opacity-0")}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />
    </div>
  )
}

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
          <ThumbnailImage
            src={`${OpenAPI.BASE}${item.thumbnail_url}`}
            alt={item.name}
            fileType={item.file_type}
            isFolder={isFolder}
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
