import { Image as ImageIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { OpenAPI } from "@/client"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { ItemCard, CardThumbnail, CardInfo } from "@/components/semantic/layout"

export type EntityCardItem = {
  name: string
  thumbnail?: string | null
  file_count: number
}

function ThumbnailImage({ src, alt }: { src: string; alt: string }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setIsLoaded(false)
    setHasError(false)
  }, [src])

  if (hasError) {
    return (
      <CardThumbnail className="thumbnail-error">
        <ImageIcon className="size-10 text-muted-foreground" />
      </CardThumbnail>
    )
  }

  return (
    <CardThumbnail className="thumbnail-container">
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

export function EntityCard({
  item,
  onClick,
}: {
  item: EntityCardItem
  onClick?: () => void
}) {
  return (
    <ItemCard onClick={onClick} title={item.name} className="entity-card">
      {item.thumbnail ? (
        <ThumbnailImage src={`${OpenAPI.BASE}${item.thumbnail}`} alt={item.name} />
      ) : (
        <CardThumbnail className="thumbnail-placeholder">
          <ImageIcon className="size-10 text-muted-foreground" />
        </CardThumbnail>
      )}

      <CardInfo className="entity-info">
        <p className="text-sm truncate" title={item.name}>
          {item.name}
        </p>
        <p className="text-xs text-muted-foreground">{item.file_count} files</p>
      </CardInfo>
    </ItemCard>
  )
}
