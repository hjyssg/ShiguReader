import { Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { type FileSystemItem, OpenAPI } from "@/client"
import { useIsMobile } from "@/hooks/useMobile"
import { getParentPath } from "@/lib/path-utils"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { ItemCard, CardThumbnail, CardInfo } from "@/components/semantic/layout"

import { FileIcon } from "./FileIcon"
import { FileNameWithPreview } from "./FileNameWithPreview"
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
      <CardThumbnail className="file-thumbnail-error">
        <FileIcon fileType={fileType} isFolder={isFolder} />
      </CardThumbnail>
    )
  }

  return (
    <CardThumbnail className="file-thumbnail">
      {!isLoaded && <Skeleton className="absolute inset-0 size-full rounded-none" />}
      <img
        src={src}
        alt={alt}
        className={cn("size-full object-contain", !isLoaded && "opacity-0")}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />
    </CardThumbnail>
  )
}

export function FileItem({ item }: { item: FileSystemItem }) {
  const isMobile = useIsMobile()
  const isFolder = item.item_type === "folder"
  const isArchive = item.file_type === "archive"
  const isVideo = item.file_type === "video"
  const isAudio = item.file_type === "audio"
  const isImage = item.file_type === "image"
  const isClickable = isFolder || isArchive || isVideo || isAudio || isImage

  const content = (
    <ItemCard isClickable={isClickable} className="file-item-card">
      <CardThumbnail className="file-card-thumbnail">
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
      </CardThumbnail>

      <CardInfo className="file-item-info">
        <FileNameWithPreview
          filename={item.name}
          filepath={item.path}
          thumbnailUrl={item.thumbnail_url}
          className="text-sm"
        />
        {!isFolder && item.filesize && (
          <p className="text-xs text-muted-foreground">
            {formatFileSize(item.filesize)}
          </p>
        )}
      </CardInfo>
    </ItemCard>
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
      <Link to="/video" search={{ path: item.path, entry: undefined, media: "video" }}>
        {content}
      </Link>
    )
  }

  if (isAudio) {
    return (
      <Link to="/video" search={{ path: item.path, entry: undefined, media: "audio" }}>
        {content}
      </Link>
    )
  }

  if (isImage) {
    const parentPath = getParentPath(item.path)
    return (
      <Link
        to={isMobile ? "/read-mobile" : "/read"}
        search={{ path: parentPath, source: "folder", page: 0, filePath: item.path }}
      >
        {content}
      </Link>
    )
  }

  return content
}
