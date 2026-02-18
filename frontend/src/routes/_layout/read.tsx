import { useMutation, useQuery } from "@tanstack/react-query"
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

import { FilesystemService, OpenAPI, ParseService } from "@/client"
import { FileNotFoundError } from "@/components/Common/FileNotFoundError"
import { PathBreadcrumb } from "@/components/Common/PathBreadcrumb"
import {
  type CompressAction,
  CompressDialog,
} from "@/components/Files/dialogs/CompressDialog"
import { ConfirmMoveDialog } from "@/components/Files/dialogs/ConfirmMoveDialog"
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
import { useDocumentTitle } from "@/hooks/useDocumentTitle"
import { useFileOperations } from "@/hooks/useFileOperations"
import { useResolveMovedFile } from "@/hooks/useResolveMovedFile"
import { getBaseName, getParentPath, wrapPageIndex } from "@/lib/path-utils"
import "./read.css"

export const Route = createFileRoute("/_layout/read")({
  component: ReadPage,
  validateSearch: (search: Record<string, unknown>) => ({
    path: (search.path as string) || "",
    page: Number(search.page) || 0,
    source: (search.source as "archive" | "folder") || "archive",
    filePath: (search.filePath as string) || "",
  }),
  head: () => ({
    meta: [{ title: "Reader" }],
  }),
})

function ReadPage() {
  type ImageEntry = {
    name: string
    index: number
    filePath?: string
    entryPath?: string
  }

  const { path, page, source, filePath } = Route.useSearch()
  const navigate = useNavigate()
  const isFolderSource = source === "folder"
  const { t } = useTranslation()

  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [archiveImageReady, setArchiveImageReady] = useState(isFolderSource)
  const [imageLoaded, setImageLoaded] = useState(false)

  // File operations state
  const parentPath = getParentPath(path)
  const operations = useFileOperations(parentPath)
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
  const lastExtractPathRef = useRef<string>("")

  const {
    data: listData,
    isLoading,
    error: listError,
  } = useQuery({
    queryKey: ["archive-list", path],
    queryFn: () => FilesystemService.listArchive({ path }),
    enabled: !!path && !isFolderSource,
    retry: false,
  })

  const {
    data: folderData,
    isLoading: isFolderLoading,
    error: folderError,
  } = useQuery({
    queryKey: ["fs-list", path],
    queryFn: () => FilesystemService.listDirectory({ path }),
    enabled: !!path && isFolderSource,
    retry: false,
  })

  const { data: parentListData } = useQuery({
    queryKey: ["reader-parent-list", parentPath],
    queryFn: () => FilesystemService.listDirectory({ path: parentPath }),
    enabled: !!parentPath,
    retry: false,
  })

  const { data: parseMeta } = useQuery({
    queryKey: ["reader-parse-meta", path],
    queryFn: async () => {
      try {
        return await ParseService.getParseResult({ filepath: path })
      } catch {
        return null
      }
    },
    enabled: !!path,
    retry: false,
  })

  const extractMutation = useMutation({
    mutationFn: (currentPage: number) =>
      FilesystemService.extractArchive({ path, page: currentPage }),
  })

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

  const imageEntries = useMemo<ImageEntry[]>(() => {
    if (isFolderSource) {
      return (folderData?.items || [])
        .filter(
          (item) => item.item_type === "file" && item.file_type === "image",
        )
        .map((item, index) => ({
          name: item.name,
          index,
          filePath: item.path,
        }))
    }

    return (listData?.entries || [])
      .filter((e) => e.file_type === "image")
      .map((entry, index) => ({
        name: entry.name,
        index,
        entryPath: entry.entry_path,
      }))
  }, [isFolderSource, folderData, listData])

  const resolvedPage = useMemo(() => {
    if (!isFolderSource || !filePath) return page
    const foundIndex = imageEntries.findIndex(
      (entry) => entry.filePath === filePath,
    )
    return foundIndex >= 0 ? foundIndex : page
  }, [isFolderSource, filePath, imageEntries, page])

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
      search: { path, page: target, source, filePath: "" },
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
    // setArchiveImageReady(isFolderSource) // Removed: keep the status instead of resetting to false immediately


    if (!path || isFolderSource) return

    // 仅在 path 变化时触发一次，避免翻页/重渲染导致重复请求
    if (lastExtractPathRef.current === path) {
      setArchiveImageReady(true)
      return
    }

    lastExtractPathRef.current = path
    extractMutation.mutate(0, {
      onSuccess: () => setArchiveImageReady(true),
      onError: () => setArchiveImageReady(true),
    })
  }, [path, isFolderSource])

  useEffect(() => {
    // When the actual image URL changes, we mark it as not loaded yet to trigger skeleton or overlay logic
    // But we don't necessarily want to hide the OLD image immediately if we want a smooth transition.
    // For now, let's keep it simple: only reset if the path actually changed significantly (e.g. entry path)
    setImageLoaded(false)
  }, [currentEntry?.entryPath, currentEntry?.filePath])

  // Preloading logic
  useEffect(() => {
    if (totalPages <= 1) return

    const preloadIndices = [
      wrapPageIndex(currentPage + 1, totalPages),
      wrapPageIndex(currentPage - 1, totalPages),
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
  }, [currentPage, totalPages, imageEntries, isFolderSource, path])


  useEffect(() => {
    if (!currentEntry || totalPages <= 0) return

    const historyFilepath = isFolderSource
      ? (currentEntry.filePath ?? "")
      : path
    if (!historyFilepath) return

    recordHistory({
      filepath: historyFilepath,
      page_current: currentPage + 1,
      page_total: totalPages,
    })
  }, [
    currentEntry,
    totalPages,
    isFolderSource,
    path,
    currentPage,
    recordHistory,
  ])

  useEffect(() => {
    if (!isFolderSource || !filePath || totalPages === 0) return
    if (resolvedPage !== page) {
      navigate({
        to: "/read",
        search: {
          path,
          source,
          page: wrapPageIndex(resolvedPage, totalPages),
          filePath: "",
        },
        replace: true,
      })
    }
  }, [
    isFolderSource,
    filePath,
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
        navigate({
          to: isFolderSource ? "/explorer" : "/archive",
          search: { path },
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
  const avgImageSizeText = currentPathMeta?.avg_image_size
    ? formatFileSize(currentPathMeta.avg_image_size)
    : "-"
  const archiveVideoCount = currentPathMeta?.video_count ?? 0
  const archiveAudioCount = currentPathMeta?.audio_count ?? 0
  const authors = parseMeta?.authors ?? []
  const cosers = parseMeta?.cosers ?? []
  const tags = parseMeta?.raw_tags ?? []

  // 文件被移动后自动跳转新路径
  const hasError = listError || folderError
  const { resolving, isNotFound, errorMessage } = useResolveMovedFile(
    path,
    hasError ? (listError || folderError) : null,
    (newPath) => {
      navigate({
        to: "/read",
        search: { path: newPath, page, source, filePath: "" },
        replace: true,
      })
    },
  )

  if (isLoading || isFolderLoading) {
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

  if (!currentEntry) {
    // 无图片提示
    return (
      <div className="reader-empty-page">
        <PathBreadcrumb
          sourcePath={path}
          homeLabel={t("common.home")}
          separatorClassName="size-4 text-muted-foreground"
          currentTo={isFolderSource ? "/explorer" : "/archive"}
          currentSearch={{ path }}
          currentLabel={fileName}
        />

        <div className="reader-empty-header">
          <div className="reader-empty-header__title">{fileName}</div>
          <div className="reader-empty-header__actions">
            {!isFolderSource && (
              <>
                <Link
                  to="/archive"
                  search={{ path }}
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

  const imageUrl = isFolderSource
    ? `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(currentEntry.filePath || "")}`
    : `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(currentEntry.entryPath || "")}`

  // 图片加载失败时的重试处理
  // 压缩包文件可能还在后台解压中，404 时自动重试（最多 5 次，递增延迟）
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setImageLoaded(false)
    const retryCount = Number(img.dataset.retry || 0)
    const maxRetries = 5
    if (retryCount < maxRetries) {
      img.dataset.retry = String(retryCount + 1)
      // 递增延迟：1s, 2s, 3s, 4s, 5s
      setTimeout(
        () => {
          img.src = `${imageUrl}${imageUrl.includes("?") ? "&" : "?"}_t=${Date.now()}`
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
  const showImagePlaceholder = !canRequestImage || !imageLoaded

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
      {/* 顶部工具栏 - 整合导航和工具 */}
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
            currentTo={isFolderSource ? "/explorer" : "/archive"}
            currentSearch={{ path }}
            currentLabel={fileName}
            currentClassName="reader-toolbar__current-link"
          />
        </div>

        {/* 右侧：工具 */}
        <div className="reader-toolbar__right">
          <div className="reader-toolbar__actions">
            {/* <Button
            variant="ghost"
            size="icon"
            className="reader-toolbar__icon-button"
            onClick={zoomOut}
            title={t("reader.zoomOut")}
          >
            <span className="reader-toolbar__button-symbol">−</span>
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
                  to="/archive"
                  search={{ path }}
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
                    Minify ZIP Images
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
                    Compress to ZIP
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

      {/* 图片区域 - 全屏化 */}
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

        <img
          key={imageUrl} // Use key to force re-render/smooth transition trigger if needed, though here we want content to swap

          src={canRequestImage ? imageUrl : undefined}
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
            status={extractMutation.data?.status}
            variant="overlay"
          />
        )}
      </div>

      <div className="reader-meta-bar">
        <div className="reader-meta-bar__left">
          <div className="reader-meta-bar__row">
            <span className="text-muted-foreground">
              {t("reader.mtime")}:{" "}
              <span className="text-foreground">{mtimeText}</span>
            </span>
            <span className="text-muted-foreground">
              {t("reader.size")}:{" "}
              <span className="text-foreground">{sizeText}</span>
            </span>
            <span className="text-muted-foreground">
              {t("reader.avgImageSize")}:{" "}
              <span className="text-foreground">{avgImageSizeText}</span>
            </span>
            <span className="text-muted-foreground">
              Video:{" "}
              <span
                className={
                  archiveVideoCount > 0
                    ? "text-orange-500 font-medium"
                    : "text-foreground"
                }
              >
                {archiveVideoCount}
              </span>
            </span>
            <span className="text-muted-foreground">
              Audio:{" "}
              <span
                className={
                  archiveAudioCount > 0
                    ? "text-orange-500 font-medium"
                    : "text-foreground"
                }
              >
                {archiveAudioCount}
              </span>
            </span>

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
                onSuccess: () => {
                  setMoveOpen(false)
                  navigate({ to: "/" })
                },
              },
            )
          } else {
            operations.moveFileMutation.mutate(
              { sourcePath: path, destPath },
              {
                onSuccess: () => {
                  setMoveOpen(false)
                  navigate({ to: "/" })
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
        showSubfolder
        onConfirm={(subfolder) => {
          operations.moveToFavoriteMutation.mutate(
            { sourcePath: path, isFolder: isFolderSource, subfolder },
            {
              onSuccess: () => {
                setConfirmFavOpen(false)
                navigate({ to: "/" })
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
        onConfirm={() => {
          operations.moveToAlreadyReadMutation.mutate(
            { sourcePath: path, isFolder: isFolderSource },
            {
              onSuccess: () => {
                setConfirmReadOpen(false)
                navigate({ to: "/" })
              },
            },
          )
        }}
        isPending={operations.moveToAlreadyReadMutation.isPending}
      />
    </div>
  )
}
