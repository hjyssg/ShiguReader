/**
 * 阅读器主路由 — 支持 gallery / audio / mobile / waterfall 四种模式
 * mode 通过 URL search param 切换，默认为 gallery
 */
import { useMutation, useQuery } from "@/shims/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import {
  BookCheck,
  ChevronLeft,
  ChevronRight,
  FolderInput,
  ImageDown,
  MoreVertical,
  Package,
  Pencil,
  RotateCw,
  Scan,
  Star,
  Trash2,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { OpenAPI, ParseService } from "@/client"
import { FileNotFoundError } from "@/components/Common/FileNotFoundError"
import { PathBreadcrumb } from "@/components/Common/PathBreadcrumb"
import {
  type CompressAction,
  CompressDialog,
} from "@/components/Files/dialogs/CompressDialog"
import { ConfirmMoveDialog } from "@/components/Files/dialogs/ConfirmMoveDialog"
import { DownloadMenuItem } from "@/components/Files/DownloadMenuItem"
import { DeleteDialog } from "@/components/Files/dialogs/DeleteDialog"
import { MoveDialog } from "@/components/Files/dialogs/MoveDialog"
import { RenameDialog } from "@/components/Files/dialogs/RenameDialog"
import { formatDateTime, formatFileSize } from "@/components/Files/utils"
import { ExtractingIndicator } from "@/components/semantic/layout"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useArchiveExtract } from "@/hooks/useArchiveExtract"
import { useDocumentTitle } from "@/hooks/useDocumentTitle"
import { useFileOperations } from "@/hooks/useFileOperations"
import { useResolveMovedFile } from "@/hooks/useResolveMovedFile"
import { getBaseName, getParentPath, wrapPageIndex } from "@/lib/path-utils"

import { AudioModeView } from "./-AudioModeView"
import { MobileModeView } from "./-MobileModeView"
import { WaterfallModeView } from "./-WaterfallModeView"
import type { ReadMode } from "./-types"
import "./read.css"

export const Route = createFileRoute("/_layout/read/")({
  component: ReadPage,
  validateSearch: (search: Record<string, unknown>): {
    path: string
    page: number
    mode?: ReadMode
  } => ({
    path: (search.path as string) || "",
    page: Number(search.page) || 0,
    mode: (search.mode as ReadMode) || undefined,
  }),
  head: () => ({
    meta: [{ title: "Reader" }],
  }),
})

function ReadPage() {
  const { path, page, mode } = Route.useSearch()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  // File operations state
  const parentPath = getParentPath(path)
  const operations = useFileOperations(parentPath)
  const { data: favoriteRoot } = useQuery({
    queryKey: ["fs-favorite"],
    queryFn: async (): Promise<{ path: string; dirname: string } | null> => {
      const response = await fetch(`${OpenAPI.BASE}/api/v1/fs/favorite-folder`)
      if (!response.ok) return null
      return response.json()
    },
  })
  const { data: alreadyReadRoot } = useQuery({
    queryKey: ["fs-already-read"],
    queryFn: async (): Promise<{ path: string; dirname: string } | null> => {
      const response = await fetch(`${OpenAPI.BASE}/api/v1/fs/already-read-folder`)
      if (!response.ok) return null
      return response.json()
    },
  })
  const navigateToMovedPath = (movedPath?: string | null) => {
    const nextPath = movedPath || path
    navigate({
      to: "/read",
      search: { path: nextPath, page: 0, mode: undefined },
      replace: true,
    })
  }
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [compressOpen, setCompressOpen] = useState(false)
  const [compressAction, setCompressAction] =
    useState<CompressAction>("zip-folder")
  const [confirmFavOpen, setConfirmFavOpen] = useState(false)
  const [confirmReadOpen, setConfirmReadOpen] = useState(false)

  const hasAutoSwitchedRef = useRef(false)
  useEffect(() => { hasAutoSwitchedRef.current = false }, [path])

  const dragRef = useRef({ startX: 0, startY: 0, startTx: 0, startTy: 0 })
  type ParseMetaData = Awaited<ReturnType<typeof ParseService.getParseResult>> | null

  const {
    isLoading,
    loadError,
    extractStatus,
    archiveImageReady,
    imageEntries,
    audioTracks,
    mtime,
    filesize,
    source,
    siblingInitialPage,
  } = useArchiveExtract(path)
  const isFolderSource = source === "folder"
  const isArchiveSource = source === "archive"

  const [parseMeta, setParseMeta] = useState<ParseMetaData>(null)

  // parseMeta: 独立加载，不阻塞主流程
  useEffect(() => {
    let cancelled = false
    if (!path) return
    setParseMeta(null)
    ParseService.getParseResult({ filepath: path })
      .then((parsed) => { if (!cancelled) setParseMeta(parsed) })
      .catch(() => { if (!cancelled) setParseMeta(null) })
    return () => { cancelled = true }
  }, [path])

  const { mutate: recordHistory } = useMutation({
    mutationFn: async (payload: {
      filepath: string
      page_current: number
      page_total: number
    }) => {
      await fetch(`${OpenAPI.BASE}/api/v1/history/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    },
  })

  // 自动进入 audio mode：仅首次打开时触发一次
  const shouldAutoAudio = !hasAutoSwitchedRef.current && !isLoading && audioTracks.length > 0 && mode !== "audio"

  useEffect(() => {
    if (shouldAutoAudio) {
      hasAutoSwitchedRef.current = true
      navigate({ to: "/read", search: { path, page: 0, mode: "audio" }, replace: true })
    }
  }, [shouldAutoAudio, navigate, path])

  // sibling 模式（path 指向具体图片/音频文件）：加载完目录后定位到该文件的 index
  const resolvedPage = siblingInitialPage !== null ? siblingInitialPage : page

  const totalPages = imageEntries.length
  const currentPage = wrapPageIndex(resolvedPage, totalPages)
  const currentEntry = imageEntries[currentPage]

  const goToPage = (nextPage: number) => {
    const target = wrapPageIndex(nextPage, totalPages)
    navigate({
      to: "/read",
      search: { path, page: target, mode: undefined },
    })
  }

  const goNext = () => goToPage(currentPage + 1)
  const goPrev = () => goToPage(currentPage - 1)

  const zoomIn = () => setScale((prev) => Math.min(5, prev * 1.1))
  const zoomOut = () => setScale((prev) => Math.max(0.2, prev / 1.1))
  const rotate = () => setRotation((prev) => (prev + 90) % 360)

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  }

  useEffect(() => {
    setScale(1)
    setRotation(0)
    setTranslate({ x: 0, y: 0 })
    setImageLoaded(false)
  }, [path, isFolderSource])

  // ── 快速翻页 debounce ──
  const [settledPage, setSettledPage] = useState(currentPage)
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current)
    settleTimerRef.current = setTimeout(() => {
      setSettledPage(currentPage)
    }, 50)
    return () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current)
    }
  }, [currentPage])

  const settledEntry = imageEntries[settledPage]
  const settledImageUrl = useMemo(() => {
    if (!settledEntry) return undefined
    return isFolderSource
      ? `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(settledEntry.filePath || ``)}`
      : `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(settledEntry.entryPath || ``)}`
  }, [settledEntry, isFolderSource, path])

  // Preloading
  useEffect(() => {
    if (totalPages <= 1 || !settledImageUrl) return
    const preloadIndices = [
      wrapPageIndex(settledPage + 1, totalPages),
      wrapPageIndex(settledPage - 1, totalPages),
    ]
    preloadIndices.forEach((idx) => {
      const entry = imageEntries[idx]
      if (!entry) return
      const url = isFolderSource
        ? `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(entry.filePath || ``)}`
        : `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(entry.entryPath || ``)}`
      const img = new Image()
      img.src = url
    })
  }, [settledPage, totalPages, imageEntries, isFolderSource, path, settledImageUrl])

  // 只在打开文件时记录一次阅读历史
  useEffect(() => {
    if (!path || totalPages <= 0) return
    recordHistory({ filepath: path, page_current: 1, page_total: totalPages })
  }, [path, totalPages, recordHistory])

  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      const isGallery = !mode || mode === "gallery"

      // mobile 模式不响应任何热键
      if (mode === "mobile") return

      // gallery-only 热键
      if (isGallery) {
        if (key === "arrowright" || key === "d") {
          e.preventDefault(); goNext(); return
        }
        if (key === "arrowleft" || key === "a") {
          e.preventDefault(); goPrev(); return
        }
        if (key === "+" || key === "=") {
          e.preventDefault(); zoomIn(); return
        }
        if (key === "-") {
          e.preventDefault(); zoomOut(); return
        }
        if (key === "enter") {
          e.preventDefault(); toggleFullscreen(); return
        }
        if (key === "g") {
          e.preventDefault()
          const value = Number(prompt(t("reader.jumpToPage")))
          if (!Number.isNaN(value) && value > 0) goToPage(value - 1)
          return
        }
        if (key === "v") {
          e.preventDefault(); setConfirmFavOpen(true); return
        }
        if (key === "x") {
          e.preventDefault(); setConfirmReadOpen(true); return
        }
        if (key === "m") {
          e.preventDefault(); setMoveOpen(true); return
        }
      }

      // 滚动：所有非 mobile 模式
      if (key === "w" || key === "arrowup") {
        window.scrollBy({ top: -80, behavior: "smooth" })
      } else if (key === "s" || key === "arrowdown") {
        window.scrollBy({ top: 80, behavior: "smooth" })
      }
    }
    window.addEventListener("keydown", onKeydown)
    return () => window.removeEventListener("keydown", onKeydown)
  }, [mode, path, extractStatus, goNext, goPrev, goToPage, isFolderSource, navigate, t, toggleFullscreen, zoomIn, zoomOut])

  const onMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    setIsDragging(true)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startTx: translate.x,
      startTy: translate.y,
    }
  }

  const onMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!isDragging) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setTranslate({
      x: dragRef.current.startTx + dx,
      y: dragRef.current.startTy + dy,
    })
  }

  const onMouseUp: React.MouseEventHandler<HTMLDivElement> = () => {
    setIsDragging(false)
  }

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault()
    if (e.deltaY < 0) zoomIn()
    else zoomOut()
  }

  // Computed values
  const fileName = getBaseName(path, isFolderSource ? "Folder" : "Archive")
  useDocumentTitle(fileName)
  const mtimeText = mtime ? formatDateTime(mtime) : "-"
  const sizeText = filesize ? formatFileSize(filesize) : "-"
  const avgImageSize = extractStatus?.avg_image_size ?? null
  const avgImageSizeText = avgImageSize != null ? formatFileSize(avgImageSize) : "-"
  const archiveVideoCount = (extractStatus?.entries ?? []).filter((e) => e.file_type === "video").length
  const archiveAudioCount = (extractStatus?.entries ?? []).filter((e) => e.file_type === "audio").length
  const authors = parseMeta?.authors ?? []
  const cosers = parseMeta?.cosers ?? []
  const tags = parseMeta?.raw_tags ?? []

  // 文件被移动后自动跳转新路径
  const hasError = loadError
  const { resolving, isNotFound, errorMessage } = useResolveMovedFile(
    path,
    hasError ? loadError : null,
    (newPath) => {
      navigate({
        to: "/read",
        search: { path: newPath, page, mode: undefined },
        replace: true,
      })
    },
  )

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[70vh] w-full" />
      </div>
    )
  }

  // ── Error state ──
  if (hasError) {
    if (resolving) {
      return (
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-[70vh] w-full" />
        </div>
      )
    }
    return (
      <FileNotFoundError
        path={path}
        fileName={fileName}
        errorMessage={errorMessage}
        isNotFound={isNotFound}
        parentPath={parentPath}
      />
    )
  }

  // ── Mode dispatch: audio / mobile / waterfall ──
  if (mode === "audio") {
    return (
      <AudioModeView
        path={path}
        fileName={fileName}
        audioTracks={audioTracks}
        imageEntries={imageEntries}
        extractStatus={extractStatus}
        mtimeText={mtimeText}
        sizeText={sizeText}
      />
    )
  }

  if (mode === "mobile") {
    return (
      <MobileModeView
        path={path}
        isFolderSource={isFolderSource}
        currentPage={currentPage}
        imageEntries={imageEntries}
        extractStatus={extractStatus}
        onPageChange={(p) => goToPage(p)}
      />
    )
  }

  if (mode === "waterfall") {
    return (
      <WaterfallModeView
        path={path}
        fileName={fileName}
        imageEntries={imageEntries}
        extractStatus={extractStatus}
      />
    )
  }

  // ── Gallery mode (default) — 无图片提示 ──
  if (!currentEntry) {
    return (
      <div className="reader-empty-page">
        <PathBreadcrumb
          sourcePath={path}
          homeLabel={t("common.home")}
          separatorClassName="size-4 text-muted-foreground"
          currentTo="/explorer"
          currentSearch={isFolderSource
            ? { path, page: 1, pageSize: 48, sortField: "name", sortOrder: "asc", viewMode: "table" }
            : { path: extractStatus?.cache_dir || path, page: 1, pageSize: 48, sortField: "name", sortOrder: "asc", viewMode: "table" }}
          currentLabel={fileName}
        />
        <div className="reader-empty-header">
          <div className="reader-empty-header__title">{fileName}</div>
          <div className="reader-empty-header__actions">
            {!isFolderSource && (
              <>
                <Link
                  to="/explorer"
                  search={{ path: extractStatus?.cache_dir || path, page: 1, pageSize: 48, sortField: "name", sortOrder: "asc", viewMode: "table" }}
                  className={buttonVariants({ variant: "default", size: "sm", className: "animate-pulse" })}
                >
                  {t("nav.explorer")}
                </Link>
                <Link
                  to="/read"
                  search={{ path, mode: "waterfall" } as any}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {t("reader.waterfall")}
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="reader-empty-body">
          <svg className="size-32 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            <line x1="4" y1="4" x2="20" y2="20" strokeWidth={1.5} strokeLinecap="round" />
          </svg>
          <div className="space-y-2">
            <h3 className="text-lg font-medium">{t("reader.archiveNoImages")}</h3>
            <p className="text-sm text-muted-foreground">{t("reader.explorerButton")}</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Gallery mode — 图片 URL 构建 ──
  const imageUrl = isFolderSource
    ? `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(currentEntry.filePath || ``)}`
    : `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(currentEntry.entryPath || ``)}`
  const actualImageSrc = settledImageUrl

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setImageLoaded(false)
    const retryCount = Number(img.dataset.retry || 0)
    const maxRetries = 5
    if (retryCount < maxRetries) {
      img.dataset.retry = String(retryCount + 1)
      const retryUrl = settledImageUrl || imageUrl
      setTimeout(() => {
        img.src = `${retryUrl}${retryUrl.includes(`?`) ? `&` : `?`}_t=${Date.now()}`
      }, 1000 * (retryCount + 1))
    }
  }

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.dataset.retry = "0"
    setImageLoaded(true)
  }

  const canRequestImage = isFolderSource || archiveImageReady
  const showImagePlaceholder = !canRequestImage

  const pagination = (
    <button
      type="button"
      className="reader-pagination"
      onClick={() => {
        const value = Number(prompt(t("reader.jumpToPage")))
        if (!Number.isNaN(value) && value > 0) goToPage(value - 1)
      }}
      title={t("reader.jumpPage")}
    >
      {currentPage + 1} / {totalPages}
    </button>
  )

  return (
    <div className="reader-page">
      {/* ── 顶部工具栏 ── */}
      <nav className="reader-toolbar">
        <div className="reader-toolbar__left">
          <PathBreadcrumb
            as="div"
            sourcePath={path}
            homeLabel={null}
            homeLinkClassName="reader-toolbar__home-link"
            homeIconClassName="size-3.5"
            dirItemClassName="reader-toolbar__crumb-item"
            dirLinkClassName="reader-toolbar__crumb-link"
            separatorClassName="size-3 text-muted-foreground/60"
            showFolderIcon={false}
            collapseDirCrumbsAfter={2}
            currentTo="/explorer"
            currentSearch={isFolderSource
              ? { path, page: 1, pageSize: 48, sortField: "name", sortOrder: "asc", viewMode: "table" }
              : { path: extractStatus?.cache_dir || path, page: 1, pageSize: 48, sortField: "name", sortOrder: "asc", viewMode: "table" }}
            currentLabel={fileName}
            currentClassName="reader-toolbar__current-link"
          />
        </div>
        <div className="reader-toolbar__right">
          <div className="reader-toolbar__actions">
            <Button variant="ghost" size="icon" className="reader-toolbar__icon-button" onClick={rotate} title={t("reader.rotate")}>
              <RotateCw className="size-3" />
            </Button>
            <Button variant="ghost" size="icon" className="reader-toolbar__icon-button" onClick={toggleFullscreen} title={t("reader.fullscreen")}>
              <Scan className="size-3" />
            </Button>
            {!isFolderSource && (
              <>
                <Link to="/explorer" search={{ path: extractStatus?.cache_dir || path, page: 1, pageSize: 48, sortField: "name", sortOrder: "asc", viewMode: "table" }} className={buttonVariants({ variant: "ghost", size: "sm", className: "reader-toolbar__text-button" })}>
                  {t("nav.explorer")}
                </Link>
                <Link to="/read" search={{ path, mode: "waterfall" } as any} className={buttonVariants({ variant: "ghost", size: "sm", className: "reader-toolbar__text-button" })}>
                  {t("reader.waterfall")}
                </Link>
                {audioTracks.length > 0 && (
                  <Link to="/read" search={{ path, page: 0, mode: "audio" } as any} className={buttonVariants({ variant: "ghost", size: "sm", className: "reader-toolbar__text-button" })}>
                    {t("file.audio")}
                  </Link>
                )}
              </>
            )}
            {/* File Operations Dropdown */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="reader-toolbar__icon-button" title={t("fileOps.title")}>
                  <MoreVertical className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DownloadMenuItem path={path} name={fileName} />
                <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                  <Pencil className="mr-2 size-4" />{t("fileOps.rename")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMoveOpen(true)}>
                  <FolderInput className="mr-2 size-4" />{t("fileOps.moveTo")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConfirmFavOpen(true)}>
                  <Star className="mr-2 size-4" />{t("fileOps.moveToFavorites")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConfirmReadOpen(true)}>
                  <BookCheck className="mr-2 size-4" />{t("fileOps.moveToAlreadyRead")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {isArchiveSource && (
                  <DropdownMenuItem onClick={() => { setCompressAction("minify-zip-images"); setCompressOpen(true) }}>
                    <ImageDown className="mr-2 size-4" />{t("fileOps.minifyZipImages")}
                  </DropdownMenuItem>
                )}
                {isFolderSource && (
                  <DropdownMenuItem onClick={() => { setCompressAction("zip-folder"); setCompressOpen(true) }}>
                    <Package className="mr-2 size-4" />{t("fileOps.compressToZip")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="mr-2 size-4" />{t("common.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>

      {/* ── 图片主舞台 ── */}
      <div className="reader-image-stage" onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onWheel={onWheel}>
        {showImagePlaceholder && (
          <div className={`reader-image-stage__placeholder${imageLoaded ? " reader-image-stage__placeholder--hidden" : ""}`} aria-hidden="true">
            <Skeleton className="reader-image-stage__skeleton" />
          </div>
        )}
        {canRequestImage && actualImageSrc && (
          <img
            src={actualImageSrc}
            alt={currentEntry.name}
            onMouseDown={onMouseDown}
            onError={handleImageError}
            onLoad={handleImageLoad}
            draggable={false}
            className={`reader-image-stage__image ${imageLoaded ? "reader-image-stage__image--loaded" : ""}`}
            style={{
              transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale}) rotate(${rotation}deg)`,
              cursor: isDragging ? "grabbing" : "grab",
              transition: isDragging ? "none" : "transform 120ms ease-out, opacity 0.3s ease-in-out",
            }}
          />
        )}
        <button type="button" className="reader-nav-button reader-nav-button--left" onClick={goPrev} aria-label={t("reader.prevPage")}>
          <ChevronLeft className="reader-nav-button__icon" />
        </button>
        <button type="button" className="reader-nav-button reader-nav-button--right" onClick={goNext} aria-label={t("reader.nextPage")}>
          <ChevronRight className="reader-nav-button__icon" />
        </button>
        {!isFolderSource && <ExtractingIndicator status={extractStatus?.status} variant="overlay" />}
      </div>

      {/* ── 底部 meta 栏 ── */}
      <div className="reader-meta-bar">
        <div className="reader-meta-bar__left">
          <div className="reader-meta-bar__row">
            <span title={t("reader.mtime")} className="text-foreground cursor-default">{mtimeText}</span>
            <span title={t("reader.size")} className="text-foreground cursor-default">{sizeText}</span>
            <span title={t("reader.avgImageSize")} className="text-foreground cursor-default">{avgImageSizeText}</span>
            {archiveVideoCount > 0 && <span title={t("file.video")} className="text-orange-500 font-medium cursor-default">{archiveVideoCount} {t("file.video")}</span>}
            {archiveAudioCount > 0 && <span title={t("file.audio")} className="text-orange-500 font-medium cursor-default">{archiveAudioCount} {t("file.audio")}</span>}
            <span className="text-muted-foreground">{t("reader.authors")}:</span>
            {authors.length > 0 ? (
              <div className="inline-flex items-center gap-1">
                {authors.map((author) => (
                  <Badge key={author} asChild className="h-5 px-1.5 text-[10px]">
                    <Link to="/search" search={{ q: author, scopes: ["author"], mode: "hybrid", page: 1, presenceFilter: "all" }}>{author}</Link>
                  </Badge>
                ))}
              </div>
            ) : <span className="text-muted-foreground">{t("reader.none")}</span>}
            <span className="text-muted-foreground">{t("reader.cosers")}:</span>
            {cosers.length > 0 ? (
              <div className="inline-flex items-center gap-1">
                {cosers.map((coser) => (
                  <Badge key={coser} asChild className="h-5 px-1.5 text-[10px]">
                    <Link to="/search" search={{ q: coser, scopes: ["coser"], mode: "hybrid", page: 1, presenceFilter: "all" }}>{coser}</Link>
                  </Badge>
                ))}
              </div>
            ) : <span className="text-muted-foreground">{t("reader.none")}</span>}
            <span className="text-muted-foreground">{t("reader.tags")}:</span>
            {tags.length > 0 ? (
              <div className="inline-flex items-center gap-1">
                {tags.map((tag) => (
                  <Badge key={tag} asChild variant="secondary" className="h-5 px-1.5 text-[10px]">
                    <Link to="/search" search={{ q: tag, scopes: ["tag"], mode: "hybrid", page: 1, presenceFilter: "all" }}>#{tag}</Link>
                  </Badge>
                ))}
              </div>
            ) : <span className="text-muted-foreground">{t("reader.none")}</span>}
          </div>
        </div>
        <div className="reader-meta-bar__right">{pagination}</div>
      </div>

      {/* ── File operation dialogs ── */}
      <RenameDialog open={renameOpen} onOpenChange={setRenameOpen} filePath={path} onConfirm={(newName) => { operations.renameMutation.mutate({ path, newName }, { onSuccess: () => { setRenameOpen(false); navigate({ to: "/" }) } }) }} isPending={operations.renameMutation.isPending} />
      <DeleteDialog open={deleteOpen} onOpenChange={setDeleteOpen} filePaths={[path]} onConfirm={() => { operations.deleteMutation.mutate({ path, permanently: false }, { onSuccess: () => { setDeleteOpen(false); navigate({ to: "/" }) } }) }} isPending={operations.deleteMutation.isPending} />
      <MoveDialog open={moveOpen} onOpenChange={setMoveOpen} filePaths={[path]} onConfirm={(destDir) => { const name = getBaseName(path); const destPath = `${destDir}/${name}`; if (isFolderSource) { operations.moveFolderMutation.mutate({ sourcePath: path, destPath }, { onSuccess: (resp) => { setMoveOpen(false); navigateToMovedPath(resp?.dest_path) } }) } else { operations.moveFileMutation.mutate({ sourcePath: path, destPath }, { onSuccess: (resp) => { setMoveOpen(false); navigateToMovedPath(resp?.dest_path) } }) } }} isPending={operations.moveFileMutation.isPending || operations.moveFolderMutation.isPending} />
      <CompressDialog open={compressOpen} onOpenChange={setCompressOpen} filePath={path} action={compressAction} onConfirm={() => { if (compressAction === "zip-folder") { operations.zipFolderMutation.mutate(path, { onSuccess: () => setCompressOpen(false) }) } else { operations.compressArchiveImagesMutation.mutate(path, { onSuccess: () => setCompressOpen(false) }) } }} isPending={operations.zipFolderMutation.isPending || operations.compressArchiveImagesMutation.isPending} />
      <ConfirmMoveDialog open={confirmFavOpen} onOpenChange={setConfirmFavOpen} filePaths={[path]} destination={t("home.favorite")} destinationPath={favoriteRoot?.path} showSubfolder onConfirm={(subfolder) => { operations.moveToFavoriteMutation.mutate({ sourcePath: path, isFolder: isFolderSource, subfolder }, { onSuccess: (resp) => { setConfirmFavOpen(false); navigateToMovedPath(resp?.dest_path) } }) }} isPending={operations.moveToFavoriteMutation.isPending} />
      <ConfirmMoveDialog open={confirmReadOpen} onOpenChange={setConfirmReadOpen} filePaths={[path]} destination={t("home.alreadyRead")} destinationPath={alreadyReadRoot?.path} onConfirm={() => { operations.moveToAlreadyReadMutation.mutate({ sourcePath: path, isFolder: isFolderSource }, { onSuccess: (resp) => { setConfirmReadOpen(false); navigateToMovedPath(resp?.dest_path) } }) }} isPending={operations.moveToAlreadyReadMutation.isPending} />
    </div>
  )
}
