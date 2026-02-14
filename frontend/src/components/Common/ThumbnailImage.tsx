// 缩略图组件，支持加载状态和错误处理
import { useEffect, useRef, useState } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { CardThumbnail } from "@/components/semantic/layout"

type ThumbnailImageProps = {
  src: string
  alt: string
  fallback?: React.ReactNode
  className?: string
}

/**
 * 共享的缩略图组件，支持加载状态和错误处理
 * - 使用 ref 缓存已加载的图片，避免重复加载
 * - 图片始终可见，Skeleton 只作为背景提示
 */
export function ThumbnailImage({ src, alt, fallback, className }: ThumbnailImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const loadedSrcsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    // 如果这个 src 已经加载过，直接标记为已加载
    if (loadedSrcsRef.current.has(src)) {
      setIsLoaded(true)
      setHasError(false)
      return
    }

    // 否则重置状态
    setIsLoaded(false)
    setHasError(false)
  }, [src])

  const handleLoad = () => {
    setIsLoaded(true)
    loadedSrcsRef.current.add(src)
  }

  const handleError = () => {
    setHasError(true)
  }

  if (hasError) {
    return (
      <CardThumbnail className={cn("thumbnail-error", className)}>
        {fallback}
      </CardThumbnail>
    )
  }

  return (
    <CardThumbnail className={cn("thumbnail-container", className)}>
      {!isLoaded && <Skeleton className="absolute inset-0 size-full rounded-none" />}
      <img
        src={src}
        alt={alt}
        className="size-full object-contain"
        loading="lazy"
        onLoad={handleLoad}
        onError={handleError}
      />
    </CardThumbnail>
  )
}
