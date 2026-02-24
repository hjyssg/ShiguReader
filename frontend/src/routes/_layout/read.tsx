/**
 * 图片阅读器 - 支持压缩包和文件夹图片浏览，带缩放、旋转、拖拽功能 */
import { useMutation, useQuery } from "@/shims/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import {
  BookCheck,
  ChevronLeft,
  ChevronRight,
  FolderInput,
  ImageDown,
  MoreVertical,
  Music4,
  Package,
  Pencil,
  RotateCw,
  Scan,
  Star,
  Trash2,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import AudioPlayer from "react-h5-audio-player"
import { useTranslation } from "react-i18next"
import "react-h5-audio-player/lib/styles.css"

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
import "./read.css"

export const Route = createFileRoute("/_layout/read")({
  component: ReadPage,
  validateSearch: (search: Record<string, unknown>): {
    path: string
    page: number
    source: "archive" | "folder"
    sourceFolderPath: string
    mode?: "audio"
  } => ({
    path: (search.path as string) || "",
    page: Number(search.page) || 0,
    source: (search.source as "archive" | "folder") || "archive",
    // sourceFolderPath: 仅 source=folder 时有效。 用于从外部（如 explorer 点击某张图片）跳转到阅读器时定位到特定图片。 解析后会被 replace 成对应的 page 数字，之后 sourceFolderPath 置空。
    sourceFolderPath: (search.sourceFolderPath as string) || "",
    mode: (search.mode as "audio") || undefined,
  }),
  head: () => ({
    meta: [{ title: "Reader" }],
  }),
})

function ReadPage() {
  const { path, page, source, sourceFolderPath, mode } = Route.useSearch()
  const navigate = useNavigate()
  const isFolderSource = source === "folder"
  const { t } = useTranslation()
  const [audioIndex, setAudioIndex] = useState(0)

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
      search: { path: nextPath, page: 0, source, sourceFolderPath: "", mode: undefined },
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
  const isArchiveSource = !isFolderSource

  const dragRef = useRef({ startX: 0, startY: 0, startTx: 0, startTy: 0 })
  type ParseMetaData = Awaited<ReturnType<typeof ParseService.getParseResult>> | null

  const {
    isLoading,
    loadError,
    extractStatus,
    parentListData,
    archiveImageReady,
    imageEntries,
    audioTracks,
    audioCoverUrl,
  } = useArchiveExtract(path, isFolderSource)

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

  // 自动进入 audio mode：archive/list 里存在音频时
  const shouldAutoAudio = !isFolderSource && !isLoading && audioTracks.length > 0 && mode !== "audio"

  useEffect(() => {
    if (shouldAutoAudio) {
      navigate({ to: "/read", search: { path, page: 0, source, sourceFolderPath: "", mode: "audio" }, replace: true })
    }
  }, [shouldAutoAudio, navigate, path, source])

  const resolvedPage = useMemo(() => {
    if (!isFolderSource || !sourceFolderPath) return page
    const foundIndex = imageEntries.findIndex(
      (entry) => entry.filePath === sourceFolderPath,
    )
    return foundIndex >= 0 ? foundIndex : page
  }, [isFolderSource, sourceFolderPath, imageEntries, page])

  const totalPages = imageEntries.length
  const currentPage = wrapPageIndex(resolvedPage, totalPages)
  const currentEntry = imageEntries[currentPage]

  // const entryTitle =
  //   currentEntry?.name || getBaseName(path, t("reader.openReader"))
  // useDocumentTitle(fileName)


  const goToPage = (nextPage: number) => {
    const target = wrapPageIndex(nextPage, totalPages)
    navigate({
      to: "/read",
      search: { path, page: target, source, sourceFolderPath: "", mode: undefined },
    })
  }

  const goNext = () => {
    goToPage(currentPage + 1)
  }

  const goPrev = () => {
    goToPage(currentPage - 1)
  }

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

  // ── 快速翻页 debounce：页码立即更新，但图片 src 延迟 50ms 才设置 ──
  // 快速连续翻页时，中间页的图片请求会被跳过，只加载最终停下来的那一页
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

  // 构建当前应该加载的图片 URL（基于 debounced settledPage）
  const settledEntry = imageEntries[settledPage]
  const settledImageUrl = useMemo(() => {
    if (!settledEntry) return undefined
    return isFolderSource
      ? `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(settledEntry.filePath || "")}`
      : `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(settledEntry.entryPath || "")}`
  }, [settledEntry, isFolderSource, path])

  // Preloading logic — 也基于 settledPage，避免快速翻页时预加载中间页
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
        ? `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(entry.filePath || "")}`
        : `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(entry.entryPath || "")}`

      const img = new Image()
      img.src = url
    })
  }, [settledPage, totalPages, imageEntries, isFolderSource, path, settledImageUrl])


  // 只在打开文件时记录一次阅读历史，不再每翻一页都记录
  useEffect(() => {
    if (!path || totalPages <= 0) return

    const historyFilepath = isFolderSource ? path : path
    if (!historyFilepath) return

    recordHistory({
      filepath: historyFilepath,
      page_current: 1,
      page_total: totalPages,
    })
  }, [path, totalPages, isFolderSource, recordHistory])

  useEffect(() => {
    if (!isFolderSource || !sourceFolderPath || totalPages === 0) return
    if (resolvedPage !== page) {
      navigate({
        to: "/read",
        search: {
          path,
          source,
          page: wrapPageIndex(resolvedPage, totalPages),
          sourceFolderPath: "",
          mode: undefined,
        },
        replace: true,
      })
    }
  }, [
    isFolderSource,
    sourceFolderPath,
    resolvedPage,
    page,
    navigate,
    path,
    source,
    totalPages,
  ])

  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key === "arrowright" || key === "d") {
        e.preventDefault()
        goNext()
      } else if (key === "arrowleft" || key === "a") {
        e.preventDefault()
        goPrev()
      } else if (key === "+" || key === "=") {
        e.preventDefault()
        zoomIn()
      } else if (key === "-") {
        e.preventDefault()
        zoomOut()
      } else if (key === "enter") {
        e.preventDefault()
        toggleFullscreen()
      } else if (key === "g") {
        e.preventDefault()
        const value = Number(prompt(t("reader.jumpToPage")))
        if (!Number.isNaN(value) && value > 0) {
          goToPage(value - 1)
        }
      } else if (key === "w" || key === "arrowup") {
        window.scrollBy({ top: -80, behavior: "smooth" })
      } else if (key === "s" || key === "arrowdown") {
        window.scrollBy({ top: 80, behavior: "smooth" })
      } else if (key === "escape") {
        const targetPath = isFolderSource ? path : (extractStatus?.cache_dir || path)
        navigate({
          to: "/explorer",
          search: { path: targetPath, page: 1, pageSize: 48, sortField: "name", sortOrder: "asc", viewMode: "table" },
        })
      } else if (key === "v") {
        e.preventDefault()
        setConfirmFavOpen(true)
      } else if (key === "x") {
        e.preventDefault()
        setConfirmReadOpen(true)
      }
    }

    window.addEventListener("keydown", onKeydown)
    return () => window.removeEventListener("keydown", onKeydown)
  }, [
    path,
    extractStatus,
    goNext,
    goPrev,
    goToPage,
    isFolderSource,
    navigate,
    t,
    toggleFullscreen,
    zoomIn,
    zoomOut,
  ])

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
    if (e.deltaY < 0) {
      zoomIn()
    } else {
      zoomOut()
    }
  }

  // Must declare these before early returns
  const fileName = getBaseName(path, isFolderSource ? "Folder" : "Archive")
  useDocumentTitle(fileName)
  const currentPathMeta = parentListData?.items?.find(
    (item) => item.path === path,
  )
  const mtimeText = currentPathMeta?.mtime
    ? formatDateTime(currentPathMeta.mtime)
    : "-"
  const sizeText = currentPathMeta?.filesize
    ? formatFileSize(currentPathMeta.filesize)
    : "-"
  // 优先用 extractMutation 实时返回的值，fallback 到父目录列表的 DB 缓存
  const avgImageSize = extractStatus?.avg_image_size ?? currentPathMeta?.avg_image_size ?? null
  const avgImageSizeText = avgImageSize != null ? formatFileSize(avgImageSize) : "-"
  const archiveVideoCount = currentPathMeta?.video_count ?? 0
  const archiveAudioCount = currentPathMeta?.audio_count ?? 0
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
        search: { path: newPath, page, source, sourceFolderPath: "", mode: undefined },
        replace: true,
      })
    },
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[70vh] w-full" />
      </div>
    )
  }

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

  // ── Audio mode ──
  if (mode === "audio" && !isFolderSource) {
    const selectedTrack = audioTracks[audioIndex]
    return (
      <div className="reader-page">
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
              currentSearch={{ path: extractStatus?.cache_dir || path, page: 1, pageSize: 48, sortField: "name", sortOrder: "asc", viewMode: "table" }}
              currentLabel={fileName}
              currentClassName="reader-toolbar__current-link"
            />
          </div>
          {imageEntries.length > 0 && (
            <div className="reader-toolbar__right">
              <div className="reader-toolbar__actions">
                <Link
                  to="/read"
                  search={{ path, page: 0, source, sourceFolderPath: "", mode: undefined }}
                  className={buttonVariants({ variant: "ghost", size: "sm", className: "reader-toolbar__text-button" })}
                >
                  Images
                </Link>
              </div>
            </div>
          )}
        </nav>

        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-3xl space-y-4 p-4">
            {audioCoverUrl && (
              <div className="mx-auto w-full max-w-[400px] rounded-md overflow-hidden border bg-card">
                <img src={audioCoverUrl} alt={fileName} className="w-full object-contain" />
              </div>
            )}
            <div className="space-y-1 rounded-md border bg-card p-3 max-h-[40vh] overflow-auto">
              {audioTracks.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("audio.noAudioFiles")}</div>
              ) : (
                audioTracks.map((track, index) => (
                  <button
                    key={track.sourcePath}
                    type="button"
                    onClick={() => setAudioIndex(index)}
                    className={`w-full text-left px-2 py-1.5 rounded transition-colors ${
                      index === audioIndex ? "bg-primary/15 text-primary" : "hover:bg-accent"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 text-sm">
                      {index === audioIndex ? <Music4 className="size-4" /> : <span className="w-4" />}
                      {track.name}
                    </span>
                  </button>
                ))
              )}
            </div>
            {selectedTrack && (
              <div className="rounded-lg border bg-card p-3">
                <AudioPlayer
                  src={selectedTrack.url}
                  autoPlay
                  showSkipControls={false}
                  showJumpControls={false}
                />
              </div>
            )}
          </div>
        </div>

        <div className="reader-meta-bar">
          <div className="reader-meta-bar__left">
            <div className="reader-meta-bar__row">
              <span title={t("reader.mtime")} className="text-foreground cursor-default">{mtimeText}</span>
              <span title={t("reader.size")} className="text-foreground cursor-default">{sizeText}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!currentEntry) {
    // 无图片提示
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
                  className={buttonVariants({
                    variant: "default",
                    size: "sm",
                    className: "animate-pulse",
                  })}
                >
                  Explorer
                </Link>
                <Link
                  to="/read-waterfall"
                  search={{ path }}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Waterfall
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="reader-empty-body">
          <svg
            className="size-32 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
            <line
              x1="4"
              y1="4"
              x2="20"
              y2="20"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          </svg>
          <div className="space-y-2">
            <h3 className="text-lg font-medium">
              {t("reader.archiveNoImages")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("reader.explorerButton")}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // imageUrl 用于 key（立即切换 DOM），actualSrc 用于真正的 src（debounced）
  const imageUrl = isFolderSource
    ? `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(currentEntry.filePath || "")}`
    : `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(currentEntry.entryPath || "")}`

  // 实际传给 <img src> 的 URL：保持上一张图直到 settledPage 更新，避免翻页时中间闪烁
  const actualImageSrc = settledImageUrl

  // 图片加载失败时的重试处理
  // 压缩包文件可能还在后台解压中，404 时自动重试（最多 5 次，递增延迟）
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setImageLoaded(false)
    const retryCount = Number(img.dataset.retry || 0)
    const maxRetries = 5
    if (retryCount < maxRetries) {
      img.dataset.retry = String(retryCount + 1)
      const retryUrl = settledImageUrl || imageUrl
      setTimeout(
        () => {
          img.src = `${retryUrl}${retryUrl.includes("?") ? "&" : "?"}_t=${Date.now()}`
        },
        1000 * (retryCount + 1),
      )
    }
  }

  // 图片加载成功时重置重试计数
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.dataset.retry = "0"
    setImageLoaded(true)
  }

  const canRequestImage = isFolderSource || archiveImageReady
  // 仅在压缩包尚未可请求时显示占位，翻页过程中不再显示 skeleton
  const showImagePlaceholder = !canRequestImage

  const pagination = (
    <button
      type="button"
      className="reader-pagination"
      onClick={() => {
        const value = Number(prompt(t("reader.jumpToPage")))
        if (!Number.isNaN(value) && value > 0) {
          goToPage(value - 1)
        }
      }}
      title={t("reader.jumpPage")}
    >
      {currentPage + 1} / {totalPages}
    </button>
  )

  return (
    <div className="reader-page">
      {/* ── 顶部工具栏：面包屑导航 + 旋转/全屏/模式切换/文件操作菜单 ── */}
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

        {/* 右侧：工具栏 */}
        <div className="reader-toolbar__right">
          <div className="reader-toolbar__actions">
            {/* <Button
            variant="ghost"
            size="icon"
            className="reader-toolbar__icon-button"
            onClick={zoomOut}
            title={t("reader.zoomOut")}
          >
            <span className="reader-toolbar__button-symbol">�?/span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="reader-toolbar__icon-button"
            onClick={zoomIn}
            title={t("reader.zoomIn")}
          >
            <span className="reader-toolbar__button-symbol">+</span>
          </Button> */}
            <Button
              variant="ghost"
              size="icon"
              className="reader-toolbar__icon-button"
              onClick={rotate}
              title={t("reader.rotate")}
            >
              <RotateCw className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="reader-toolbar__icon-button"
              onClick={toggleFullscreen}
              title={t("reader.fullscreen")}
            >
              <Scan className="size-3" />
            </Button>
            {/* <Button
            variant="ghost"
            size="sm"
            className="reader-toolbar__text-button"
            onClick={() => {
              const value = Number(prompt(t("reader.jumpToPage")))
              if (!Number.isNaN(value) && value > 0) {
                goToPage(value - 1)
              }
            }}
          >
            {t("reader.jumpPage")}
          </Button> */}
            {/* <Button
            variant="ghost"
            size="sm"
            className="reader-toolbar__text-button"
            onClick={resetTransform}
          >
            {t("reader.reset")}
          </Button> */}
            {!isFolderSource && (
              <>
                <Link
                  to="/explorer"
                  search={{ path: extractStatus?.cache_dir || path, page: 1, pageSize: 48, sortField: "name", sortOrder: "asc", viewMode: "table" }}
                  className={buttonVariants({
                    variant: "ghost",
                    size: "sm",
                    className: "reader-toolbar__text-button",
                  })}
                >
                  Explorer
                </Link>
                <Link
                  to="/read-waterfall"
                  search={{ path }}
                  className={buttonVariants({
                    variant: "ghost",
                    size: "sm",
                    className: "reader-toolbar__text-button",
                  })}
                >
                  Waterfall
                </Link>
                {audioTracks.length > 0 && (
                  <Link
                    to="/read"
                    search={{ path, page: 0, source, sourceFolderPath: "", mode: "audio" }}
                    className={buttonVariants({
                      variant: "ghost",
                      size: "sm",
                      className: "reader-toolbar__text-button",
                    })}
                  >
                    Audio
                  </Link>
                )}
              </>
            )}
            {/* File Operations Dropdown */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="reader-toolbar__icon-button"
                  title="File operations"
                >
                  <MoreVertical className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DownloadMenuItem path={path} name={fileName} />
                <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                  <Pencil className="mr-2 size-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMoveOpen(true)}>
                  <FolderInput className="mr-2 size-4" />
                  Move to...
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConfirmFavOpen(true)}>
                  <Star className="mr-2 size-4" />
                  Move to Favorites
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConfirmReadOpen(true)}>
                  <BookCheck className="mr-2 size-4" />
                  Move to Already Read
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {isArchiveSource && (
                  <DropdownMenuItem
                    onClick={() => {
                      setCompressAction("minify-zip-images")
                      setCompressOpen(true)
                    }}
                  >
                    <ImageDown className="mr-2 size-4" />
                    Minify Zip Images
                  </DropdownMenuItem>
                )}
                {isFolderSource && (
                  <DropdownMenuItem
                    onClick={() => {
                      setCompressAction("zip-folder")
                      setCompressOpen(true)
                    }}
                  >
                    <Package className="mr-2 size-4" />
                    Compress to Zip
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>

      {/* ── 图片主舞台：支持鼠标拖拽平移、滚轮缩放、左右翻页按钮、解压进度指示 ── */}
      <div
        className="reader-image-stage"
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      >
        {showImagePlaceholder && (
          <div
            className={`reader-image-stage__placeholder ${imageLoaded ? "reader-image-stage__placeholder--hidden" : ""}`}
            aria-hidden="true"
          >
            <Skeleton className="reader-image-stage__skeleton" />
          </div>
        )}

        {canRequestImage && actualImageSrc && (
          <img
            // key={actualImageSrc}
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


        <button
          type="button"
          className="reader-nav-button reader-nav-button--left"
          onClick={goPrev}
          aria-label={t("reader.prevPage")}
        >
          <ChevronLeft className="reader-nav-button__icon" />
        </button>
        <button
          type="button"
          className="reader-nav-button reader-nav-button--right"
          onClick={goNext}
          aria-label={t("reader.nextPage")}
        >
          <ChevronRight className="reader-nav-button__icon" />
        </button>

        {!isFolderSource && (
          <ExtractingIndicator
            status={extractStatus?.status}
            variant="overlay"
          />
        )}
      </div>

      {/* ── 底部 meta 栏：文件信息（时间/大小/均图大小/视频音频数）+ 作者/coser/tag 可点击跳搜索 + 页码 ── */}
      <div className="reader-meta-bar">
        <div className="reader-meta-bar__left">
          <div className="reader-meta-bar__row">
            {/* 文件元数据：hover title 显示 label，只展示值 */}
            <span title={t("reader.mtime")} className="text-foreground cursor-default">{mtimeText}</span>
            <span title={t("reader.size")} className="text-foreground cursor-default">{sizeText}</span>
            <span title={t("reader.avgImageSize")} className="text-foreground cursor-default">{avgImageSizeText}</span>
            {archiveVideoCount > 0 && (
              <span title="Video" className="text-orange-500 font-medium cursor-default">{archiveVideoCount} video</span>
            )}
            {archiveAudioCount > 0 && (
              <span title="Audio" className="text-orange-500 font-medium cursor-default">{archiveAudioCount} audio</span>
            )}

            <span className="text-muted-foreground">
              {t("reader.authors")}:
            </span>
            {authors.length > 0 ? (
              <div className="inline-flex items-center gap-1">
                {authors.map((author) => (
                  <Badge
                    key={author}
                    asChild
                    className="h-5 px-1.5 text-[10px]"
                  >
                    <Link
                      to="/search"
                      search={{
                        q: author,
                        scopes: ["author"],
                        mode: "hybrid",
                        page: 1,
                        presenceFilter: "all",
                      }}
                    >
                      {author}
                    </Link>
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground">{t("reader.none")}</span>
            )}

            <span className="text-muted-foreground">{t("reader.cosers")}:</span>
            {cosers.length > 0 ? (
              <div className="inline-flex items-center gap-1">
                {cosers.map((coser) => (
                  <Badge key={coser} asChild className="h-5 px-1.5 text-[10px]">
                    <Link
                      to="/search"
                      search={{
                        q: coser,
                        scopes: ["coser"],
                        mode: "hybrid",
                        page: 1,
                        presenceFilter: "all",
                      }}
                    >
                      {coser}
                    </Link>
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground">{t("reader.none")}</span>
            )}

            <span className="text-muted-foreground">{t("reader.tags")}:</span>
            {tags.length > 0 ? (
              <div className="inline-flex items-center gap-1">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    asChild
                    variant="secondary"
                    className="h-5 px-1.5 text-[10px]"
                  >
                    <Link
                      to="/search"
                      search={{
                        q: tag,
                        scopes: ["tag"],
                        mode: "hybrid",
                        page: 1,
                        presenceFilter: "all",
                      }}
                    >
                      #{tag}
                    </Link>
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground">{t("reader.none")}</span>
            )}
          </div>
        </div>

        <div className="reader-meta-bar__right">{pagination}</div>
      </div>

      {/* File operation dialogs */}
      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        filePath={path}
        onConfirm={(newName) => {
          operations.renameMutation.mutate(
            { path, newName },
            {
              onSuccess: () => {
                setRenameOpen(false)
                navigate({ to: "/" })
              },
            },
          )
        }}
        isPending={operations.renameMutation.isPending}
      />
      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        filePaths={[path]}
        onConfirm={() => {
          operations.deleteMutation.mutate(
            { path, permanently: false },
            {
              onSuccess: () => {
                setDeleteOpen(false)
                navigate({ to: "/" })
              },
            },
          )
        }}
        isPending={operations.deleteMutation.isPending}
      />
      <MoveDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        filePaths={[path]}
        onConfirm={(destDir) => {
          const name = getBaseName(path)
          const destPath = `${destDir}/${name}`
          if (isFolderSource) {
            operations.moveFolderMutation.mutate(
              { sourcePath: path, destPath },
              {
                onSuccess: (resp) => {
                  setMoveOpen(false)
                  navigateToMovedPath(resp?.dest_path)
                },
              },
            )
          } else {
            operations.moveFileMutation.mutate(
              { sourcePath: path, destPath },
              {
                onSuccess: (resp) => {
                  setMoveOpen(false)
                  navigateToMovedPath(resp?.dest_path)
                },
              },
            )
          }
        }}
        isPending={
          operations.moveFileMutation.isPending ||
          operations.moveFolderMutation.isPending
        }
      />
      <CompressDialog
        open={compressOpen}
        onOpenChange={setCompressOpen}
        filePath={path}
        action={compressAction}
        onConfirm={() => {
          if (compressAction === "zip-folder") {
            operations.zipFolderMutation.mutate(path, {
              onSuccess: () => setCompressOpen(false),
            })
          } else {
            operations.compressArchiveImagesMutation.mutate(path, {
              onSuccess: () => setCompressOpen(false),
            })
          }
        }}
        isPending={
          operations.zipFolderMutation.isPending ||
          operations.compressArchiveImagesMutation.isPending
        }
      />
      <ConfirmMoveDialog
        open={confirmFavOpen}
        onOpenChange={setConfirmFavOpen}
        filePaths={[path]}
        destination="Favorites"
        destinationPath={favoriteRoot?.path}
        showSubfolder
        onConfirm={(subfolder) => {
          operations.moveToFavoriteMutation.mutate(
            { sourcePath: path, isFolder: isFolderSource, subfolder },
            {
              onSuccess: (resp) => {
                setConfirmFavOpen(false)
                navigateToMovedPath(resp?.dest_path)
              },
            },
          )
        }}
        isPending={operations.moveToFavoriteMutation.isPending}
      />
      <ConfirmMoveDialog
        open={confirmReadOpen}
        onOpenChange={setConfirmReadOpen}
        filePaths={[path]}
        destination="Already Read"
        destinationPath={alreadyReadRoot?.path}
        onConfirm={() => {
          operations.moveToAlreadyReadMutation.mutate(
            { sourcePath: path, isFolder: isFolderSource },
            {
              onSuccess: (resp) => {
                setConfirmReadOpen(false)
                navigateToMovedPath(resp?.dest_path)
              },
            },
          )
        }}
        isPending={operations.moveToAlreadyReadMutation.isPending}
      />
    </div>
  )
}
