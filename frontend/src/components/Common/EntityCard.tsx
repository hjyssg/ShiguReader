import { Image as ImageIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { OpenAPI } from "@/client"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

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
      <div className="size-full flex items-center justify-center bg-muted">
        <ImageIcon className="size-10 text-muted-foreground" />
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

export function EntityCard({
  item,
  onClick,
}: {
  item: EntityCardItem
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative rounded-lg border bg-card transition-all w-full text-left cursor-pointer hover:border-primary hover:shadow-md"
      title={item.name}
    >
      <div className="aspect-square w-full overflow-hidden rounded-t-lg bg-muted flex items-center justify-center">
        {item.thumbnail ? (
          <ThumbnailImage src={`${OpenAPI.BASE}${item.thumbnail}`} alt={item.name} />
        ) : (
          <ImageIcon className="size-10 text-muted-foreground" />
        )}
      </div>

      <div className="p-2">
        <p className="text-sm truncate" title={item.name}>
          {item.name}
        </p>
        <p className="text-xs text-muted-foreground">{item.file_count} files</p>
      </div>
    </button>
  )
}
