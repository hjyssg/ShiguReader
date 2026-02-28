/**
 * 瀑布流模式 — 纵向排列所有图片，适合快速浏览
 */
import { Link, useNavigate } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { ReaderToolbar } from "@/components/Reader/ReaderToolbar"
import { ExtractingIndicator } from "@/components/semantic/layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { buildReadImageUrl } from "./-imageUrl"

import type { ImageEntry } from "./-types"

/** 单张瀑布流图片，进入视口才加载 */
function WaterfallImage({ src, alt }: { src: string; alt: string }) {
  const [isInView, setIsInView] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
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
  }, [])

  return (
    <div ref={containerRef} className="reader-waterfall-item__image-wrap">
      {!isLoaded && <Skeleton className="reader-waterfall-item__skeleton" />}
      {isInView && (
        <img
          src={src}
          alt={alt}
          className="reader-waterfall-item__image"
          onLoad={() => setIsLoaded(true)}
        />
      )}
    </div>
  )
}

interface WaterfallModeViewProps {
  path: string
  isFolderSource: boolean
  imageEntries: ImageEntry[]
  extractStatus: { cache_dir?: string; status?: "extracting" | "completed" | "error" | "started" | "already_running" } | null
}

export function WaterfallModeView({
  path,
  isFolderSource,
  imageEntries,
  extractStatus,
}: WaterfallModeViewProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="reader-page reader-page--waterfall">
      <ReaderToolbar
        sourcePath={path}
        actions={(
          <div className="reader-waterfall-actions">
            <Button
              onClick={() =>
                navigate({
                  to: "/read",
                  search: { path, page: 0, mode: undefined },
                  replace: true,
                })
              }
            >
              {t("reader.openReader")}
            </Button>
            <ExtractingIndicator
              status={extractStatus?.status}
              variant="inline"
            />
          </div>
        )}
      />

      <div className="reader-waterfall-page flex-1 overflow-auto">
        <div className="reader-waterfall-list">
          {imageEntries.map((entry, index) => {
            const imageUrl = buildReadImageUrl({ path, isFolderSource, entry })
            if (!imageUrl) return null
            return (
              <Link
                key={entry.entryPath || entry.filePath || `${index}`}
                to="/read"
                search={{ path, page: index, mode: "gallery" } as any}
                className="reader-waterfall-item"
              >
                <WaterfallImage src={imageUrl} alt={entry.name} />
                <div className="reader-waterfall-item__caption">
                  {index + 1}. {entry.name}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
