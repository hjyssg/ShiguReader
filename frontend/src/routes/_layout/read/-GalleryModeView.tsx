/**
 * Gallery 单页模式 — 图片 100vh 占满视口，下方展示 meta/操作区
 */
import { Link, useNavigate } from "@tanstack/react-router"
import {
  ChevronLeft,
  ChevronRight,
  GalleryVertical,
  MoreVertical,
  RotateCw,
  Smartphone,
} from "lucide-react"
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { OpenAPI } from "@/client"
import { PathBreadcrumb } from "@/components/Common/PathBreadcrumb"
import { FileOperationMenuItems } from "@/components/Files/FileOperationMenuItems"
import { formatDateTime, formatFileSize } from "@/components/Files/utils"
import { ExtractingIndicator } from "@/components/semantic/layout"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { wrapPageIndex } from "@/lib/path-utils"

import type { AudioTrack, ImageEntry } from "./-types"

interface GalleryModeViewProps {
  path: string
  isFolderSource: boolean
  isArchiveSource: boolean
  currentPage: number
  imageEntries: ImageEntry[]
  imagesReady: boolean
  extractStatus: {
    cache_dir?: string
    status?: "extracting" | "completed" | "error" | "started" | "already_running"
    entries?: { file_type: string }[]
    avg_image_size?: number
  } | null
  parseMeta: {
    authors?: string[]
    cosers?: string[]
    raw_tags?: string[]
  } | null
  mtime: number | null
  filesize: number | null
  settingsData: { favorite_dir?: string; already_read_dir?: string } | undefined
  audioTracks: AudioTrack[]
  fileOpDialogs: ReactNode
  openRename: (path: string) => void
  openDelete: (paths: string[]) => void
  openMove: (path: string, isFolder: boolean, destDir?: string, defaultMode?: "favorite") => void
  openCompress: (path: string, type: string) => void
  setMoveOpen: (open: boolean) => void
  onPageChange: (page: number) => void
}

export function GalleryModeView({
  path,
  isFolderSource,
  isArchiveSource,
  currentPage,
  imageEntries,
  imagesReady,
  extractStatus,
  parseMeta,
  mtime,
  filesize,
  settingsData,
  audioTracks,
  fileOpDialogs,
  openRename,
  openDelete,
  openMove,
  openCompress,
  setMoveOpen,
  onPageChange,
}: GalleryModeViewProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const dragRef = useRef({ startX: 0, startY: 0, startTx: 0, startTy: 0 })
  const imgRef = useRef<HTMLImageElement>(null)

  const totalPages = imageEntries.length
  const currentEntry = imageEntries[currentPage]

  // Reset transform on page/source change
  useEffect(() => {
    setScale(1)
    setRotation(0)
    setTranslate({ x: 0, y: 0 })
    setImageLoaded(false)
  }, [path, isFolderSource, currentPage])

  // ── Debounced settled page for preloading ──
  const [settledPage, setSettledPage] = useState(currentPage)
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current)
    settleTimerRef.current = setTimeout(() => setSettledPage(currentPage), 50)
    return () => { if (settleTimerRef.current) clearTimeout(settleTimerRef.current) }
  }, [currentPage])

  const settledEntry = imageEntries[settledPage]
  const settledImageUrl = useMemo(() => {
    if (!settledEntry) return undefined
    return isFolderSource
      ? `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(settledEntry.filePath || "")}`
      : `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(settledEntry.entryPath || "")}`
  }, [settledEntry, isFolderSource, path])

  // Preload adjacent pages
  useEffect(() => {
    if (totalPages <= 1 || !settledImageUrl) return
    const preloadIndices = [
      wrapPageIndex(settledPage + 1, totalPages),
      wrapPageIndex(settledPage - 1, totalPages),
    ]
    for (const idx of preloadIndices) {
      const entry = imageEntries[idx]
      if (!entry) continue
      const url = isFolderSource
        ? `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(entry.filePath || "")}`
        : `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(entry.entryPath || "")}`
      const img = new Image()
      img.src = url
    }
  }, [settledPage, totalPages, imageEntries, isFolderSource, path, settledImageUrl])

  const goNext = () => onPageChange(wrapPageIndex(currentPage + 1, totalPages))
  const goPrev = () => onPageChange(wrapPageIndex(currentPage - 1, totalPages))
  const zoomIn = () => setScale((prev) => Math.min(5, prev * 1.1))
  const zoomOut = () => setScale((prev) => Math.max(0.2, prev / 1.1))
  const rotate = () => setRotation((prev) => (prev + 90) % 360)

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key === "arrowright" || key === "d") { e.preventDefault(); goNext(); return }
      if (key === "arrowleft" || key === "a") { e.preventDefault(); goPrev(); return }
      if (key === "+" || key === "=") { e.preventDefault(); zoomIn(); return }
      if (key === "-") { e.preventDefault(); zoomOut(); return }
      if (key === "g") {
        e.preventDefault()
        const value = Number(prompt(t("reader.jumpToPage")))
        if (!Number.isNaN(value) && value > 0) onPageChange(value - 1)
        return
      }
      if (key === "v" || key === "x" || key === "m") { e.preventDefault(); setMoveOpen(true); return }
      if (key === "w" || key === "arrowup") window.scrollBy({ top: -80, behavior: "smooth" })
      else if (key === "s" || key === "arrowdown") window.scrollBy({ top: 80, behavior: "smooth" })
    }
    window.addEventListener("keydown", onKeydown)
    return () => window.removeEventListener("keydown", onKeydown)
  }, [goNext, goPrev, zoomIn, zoomOut, onPageChange, setMoveOpen, t])

  // ── Mouse drag ──
  const onMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    setIsDragging(true)
    dragRef.current = { startX: e.clientX, startY: e.clientY, startTx: translate.x, startTy: translate.y }
  }
  const onMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!isDragging) return
    setTranslate({
      x: dragRef.current.startTx + (e.clientX - dragRef.current.startX),
      y: dragRef.current.startTy + (e.clientY - dragRef.current.startY),
    })
  }
  const onMouseUp: React.MouseEventHandler<HTMLDivElement> = () => setIsDragging(false)

  // ── Wheel zoom — 仅在鼠标悬停于图片元素时生效，阻止页面滚动 ──
  useEffect(() => {
    const el = imgRef.current
    if (!el) return
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.deltaY < 0) setScale((prev) => Math.min(5, prev * 1.1))
      else setScale((prev) => Math.max(0.2, prev / 1.1))
    }
    el.addEventListener("wheel", handleWheel, { passive: false })
    return () => el.removeEventListener("wheel", handleWheel)
  }, [imageLoaded])

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setImageLoaded(false)
    const retryCount = Number(img.dataset.retry || 0)
    if (retryCount < 5) {
      img.dataset.retry = String(retryCount + 1)
      const retryUrl = settledImageUrl || ""
      setTimeout(() => {
        img.src = `${retryUrl}${retryUrl.includes("?") ? "&" : "?"}_t=${Date.now()}`
      }, 1000 * (retryCount + 1))
    }
  }

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.dataset.retry = "0"
    setImageLoaded(true)
  }

  // ── Computed display values ──
  const mtimeText = mtime ? formatDateTime(mtime) : "-"
  const sizeText = filesize ? formatFileSize(filesize) : "-"
  const avgImageSize = extractStatus?.avg_image_size ?? null
  const avgImageSizeText = avgImageSize != null ? formatFileSize(avgImageSize) : "-"
  const archiveVideoCount = (extractStatus?.entries ?? []).filter((e) => e.file_type === "video").length
  const archiveAudioCount = (extractStatus?.entries ?? []).filter((e) => e.file_type === "audio").length
  const authors = parseMeta?.authors ?? []
  const cosers = parseMeta?.cosers ?? []
  const tags = parseMeta?.raw_tags ?? []

  const canRequestImage = isFolderSource || imagesReady
  const actualImageSrc = settledImageUrl

  // ── Pagination prompt ──
  const handlePaginationClick = () => {
    const value = Number(prompt(t("reader.jumpToPage")))
    if (!Number.isNaN(value) && value > 0) onPageChange(value - 1)
  }

  if (!currentEntry) return null

  return (
    <div className="gallery-page">
      {/* ── 图片舞台 100vh ── */}
      <div
        className="gallery-stage"
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {!canRequestImage && (
          <div className="gallery-stage__placeholder" aria-hidden="true">
            <Skeleton className="gallery-stage__skeleton" />
          </div>
        )}
        {canRequestImage && actualImageSrc && (
          <img
            ref={imgRef}
            src={actualImageSrc}
            alt={currentEntry.name}
            onMouseDown={onMouseDown}
            onError={handleImageError}
            onLoad={handleImageLoad}
            draggable={false}
            className="gallery-stage__image"
            style={{
              transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale}) rotate(${rotation}deg)`,
              cursor: isDragging ? "grabbing" : "grab",
              transition: isDragging ? "none" : "transform 120ms ease-out",
            }}
          />
        )}

        {/* 左右翻页按钮 */}
        <button type="button" className="reader-nav-button reader-nav-button--left" onClick={goPrev} aria-label={t("reader.prevPage")}>
          <ChevronLeft className="reader-nav-button__icon" />
        </button>
        <button type="button" className="reader-nav-button reader-nav-button--right" onClick={goNext} aria-label={t("reader.nextPage")}>
          <ChevronRight className="reader-nav-button__icon" />
        </button>

        {!isFolderSource && <ExtractingIndicator status={extractStatus?.status} variant="overlay" />}
      </div>

      {/* ── 页码指示器（固定右下角） ── */}
      <button type="button" className="reader-pagination" onClick={handlePaginationClick} title={t("reader.jumpPage")}>
        {currentPage + 1} / {totalPages}
      </button>

      {/* ── 下方 meta + 操作区 ── */}
      <div className="gallery-meta">
        {/* 面包屑 */}
        <PathBreadcrumb sourcePath={path} className="gallery-meta__breadcrumb" />

        {/* 文件信息行 */}
        <div className="gallery-meta__info-row">
          <span title={t("reader.mtime")}>{mtimeText}</span>
          <span className="gallery-meta__sep">·</span>
          <span title={t("reader.size")}>{sizeText}</span>
          <span className="gallery-meta__sep">·</span>
          <span title={t("reader.avgImageSize")}>{avgImageSizeText}</span>
          {archiveVideoCount > 0 && (
            <><span className="gallery-meta__sep">·</span>
            <span className="text-orange-500 font-medium">{archiveVideoCount} {t("file.video")}</span></>
          )}
          {archiveAudioCount > 0 && (
            <><span className="gallery-meta__sep">·</span>
            <span className="text-orange-500 font-medium">{archiveAudioCount} {t("file.audio")}</span></>
          )}
        </div>

        {/* Authors */}
        <div className="gallery-meta__tag-row">
          <span className="gallery-meta__label">{t("reader.authors")}:</span>
          {authors.length > 0 ? authors.map((a) => (
            <Badge key={a} asChild className="h-5 px-1.5 text-[10px]">
              <Link to="/search" search={{ q: a, scopes: ["author"], mode: "exact", page: 1, presenceFilter: "all" }}>{a}</Link>
            </Badge>
          )) : <span className="gallery-meta__empty">{t("reader.none")}</span>}
        </div>

        {/* Cosers */}
        <div className="gallery-meta__tag-row">
          <span className="gallery-meta__label">{t("reader.cosers")}:</span>
          {cosers.length > 0 ? cosers.map((c) => (
            <Badge key={c} asChild className="h-5 px-1.5 text-[10px]">
              <Link to="/search" search={{ q: c, scopes: ["coser"], mode: "exact", page: 1, presenceFilter: "all" }}>{c}</Link>
            </Badge>
          )) : <span className="gallery-meta__empty">{t("reader.none")}</span>}
        </div>

        {/* Tags */}
        <div className="gallery-meta__tag-row">
          <span className="gallery-meta__label">{t("reader.tags")}:</span>
          {tags.length > 0 ? tags.map((tag) => (
            <Badge key={tag} asChild variant="secondary" className="h-5 px-1.5 text-[10px]">
              <Link to="/search" search={{ q: tag, scopes: ["tag"], mode: "exact", page: 1, presenceFilter: "all" }}>#{tag}</Link>
            </Badge>
          )) : <span className="gallery-meta__empty">{t("reader.none")}</span>}
        </div>

        {/* 操作区 */}
        <div className="gallery-meta__actions">
          <Button variant="ghost" size="sm" onClick={rotate} title={t("reader.rotate")}>
            <RotateCw className="mr-1 size-3.5" />{t("reader.rotate")}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/read", search: { path, page: currentPage, mode: "mobile" } as any })}
          >
            <Smartphone className="mr-1 size-3.5" />{t("reader.mobileView")}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/read", search: { path, page: 0, mode: "waterfall" } as any })}
          >
            <GalleryVertical className="mr-1 size-3.5" />{t("reader.waterfall")}
          </Button>

          {!isFolderSource && (
            <Link
              to="/explorer"
              search={{ path: extractStatus?.cache_dir || path, sortField: "name", sortOrder: "asc", viewMode: "table" }}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {t("nav.explorer")}
            </Link>
          )}

          {audioTracks.length > 0 && (
            <Link
              to="/read"
              search={{ path, page: 0, mode: "audio" } as any}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {t("file.audio")}
            </Link>
          )}

          {/* 文件操作菜单 */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" title={t("fileOps.title")}>
                <MoreVertical className="mr-1 size-3.5" />{t("fileOps.title")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <FileOperationMenuItems
                filePath={path}
                fileName={currentEntry.name}
                isFolder={isFolderSource}
                isArchive={isArchiveSource}
                favoriteDir={settingsData?.favorite_dir?.trim()}
                alreadyReadDir={settingsData?.already_read_dir?.trim()}
                onRename={() => openRename(path)}
                onMove={() => openMove(path, isFolderSource)}
                onMoveToFavorite={() => openMove(path, isFolderSource, undefined, "favorite")}
                onMoveToAlreadyRead={() => {
                  const readDir = settingsData?.already_read_dir?.trim()
                  if (readDir) openMove(path, isFolderSource, readDir)
                }}
                onDelete={() => openDelete([path])}
                onCompressToZip={() => openCompress(path, "zip-folder")}
                onMinifyZipImages={() => openCompress(path, "minify-zip-images")}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {fileOpDialogs}
    </div>
  )
}
