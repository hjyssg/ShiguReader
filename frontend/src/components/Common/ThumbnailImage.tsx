// 缩略图组件，支持加载状态和错误处理
// 使用 IntersectionObserver 实现视口内才加载，避免大量缩略图同时请求
import { useCallback, useEffect, useRef, useState } from "react"
import { CardThumbnail } from "@/components/semantic/layout"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type ThumbnailImageProps = {
  src: string
  alt: string
  fallback?: React.ReactNode
  className?: string
}

/**
 * 共享的缩略图组件，支持加载状态和错误处理
 * - 使用 IntersectionObserver 精确控制：只有进入视口附近才设置真实 src
 * - 使用 ref 缓存已加载的图片，避免重复加载
 * - 图片始终可见，Skeleton 只作为背景提示
 */
export function ThumbnailImage({
  src,
  alt,
  fallback,
  className,
}: ThumbnailImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const loadedSrcsRef = useRef<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  // IntersectionObserver：进入视口 200px 范围内才标记可见
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // 已加载过的 src 直接标记可见，跳过 observer
    if (loadedSrcsRef.current.has(src)) {
      setIsInView(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: "200px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [src])

  useEffect(() => {
    if (loadedSrcsRef.current.has(src)) {
      setIsLoaded(true)
      setHasError(false)
      return
    }
    setIsLoaded(false)
    setHasError(false)
  }, [src])

  // src 变化时重置 inView（新图片需要重新判断是否在视口内）
  useEffect(() => {
    if (loadedSrcsRef.current.has(src)) return
    setIsInView(false)
  }, [src])

  const handleLoad = useCallback(() => {
    setIsLoaded(true)
    loadedSrcsRef.current.add(src)
  }, [src])

  const handleError = useCallback(() => {
    setHasError(true)
  }, [])

  if (hasError) {
    return (
      <CardThumbnail className={cn("thumbnail-error", className)}>
        {fallback}
      </CardThumbnail>
    )
  }

  return (
    <CardThumbnail ref={containerRef} className={cn("thumbnail-container", className)}>
      {!isLoaded && (
        <Skeleton className="absolute inset-0 size-full rounded-none" />
      )}
      {isInView && (
        <img
          src={src}
          alt={alt}
          className="thumbnail-img size-full object-contain"
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </CardThumbnail>
  )
}
