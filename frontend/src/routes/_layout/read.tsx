import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import {
  ChevronLeft,
  ChevronRight,
  Folder,
  Home,
  RotateCw,
  Scan,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { FilesystemService, OpenAPI } from "@/client"
import { getBaseName, joinPath, splitPath, wrapPageIndex } from "@/lib/path-utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ExtractingIndicator } from "@/components/semantic/layout"

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

  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

  const dragRef = useRef({ startX: 0, startY: 0, startTx: 0, startTy: 0 })

  const { data: listData, isLoading } = useQuery({
    queryKey: ["archive-list", path],
    queryFn: () => FilesystemService.listArchive({ path }),
    enabled: !!path && !isFolderSource,
  })

  const { data: folderData, isLoading: isFolderLoading } = useQuery({
    queryKey: ["fs-list", path],
    queryFn: () => FilesystemService.listDirectory({ path }),
    enabled: !!path && isFolderSource,
  })

  const extractMutation = useMutation({
    mutationFn: (currentPage: number) =>
      FilesystemService.extractArchive({ path, page: currentPage }),
  })

  const historyMutation = useMutation({
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
        .filter((item) => item.item_type === "file" && item.file_type === "image")
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
    const foundIndex = imageEntries.findIndex((entry) => entry.filePath === filePath)
    return foundIndex >= 0 ? foundIndex : page
  }, [isFolderSource, filePath, imageEntries, page])

  const totalPages = imageEntries.length
  const currentPage = wrapPageIndex(resolvedPage, totalPages)
  const currentEntry = imageEntries[currentPage]

  const resetTransform = () => {
    setScale(1)
    setRotation(0)
    setTranslate({ x: 0, y: 0 })
  }

  const goToPage = (nextPage: number) => {
    const target = wrapPageIndex(nextPage, totalPages)
    navigate({ to: "/read", search: { path, page: target, source, filePath: "" } })
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
    resetTransform()
    if (path && !isFolderSource) {
      extractMutation.mutate(currentPage)
    }
  }, [path, currentPage, isFolderSource])

  useEffect(() => {
    if (!currentEntry || totalPages <= 0) return

    const historyFilepath = isFolderSource
      ? (currentEntry.filePath ?? "")
      : path
    if (!historyFilepath) return

    historyMutation.mutate({
      filepath: historyFilepath,
      page_current: currentPage + 1,
      page_total: totalPages,
    })
  }, [currentEntry, totalPages, isFolderSource, path, currentPage])

  useEffect(() => {
    if (!isFolderSource || !filePath || totalPages === 0) return
    if (resolvedPage !== page) {
      navigate({
        to: "/read",
        search: { path, source, page: wrapPageIndex(resolvedPage, totalPages), filePath: "" },
        replace: true,
      })
    }
  }, [isFolderSource, filePath, resolvedPage, page, navigate, path, source, totalPages])

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
        const value = Number(prompt("跳转到第几页？"))
        if (!Number.isNaN(value) && value > 0) {
          goToPage(value - 1)
        }
      } else if (key === "w" || key === "arrowup") {
        window.scrollBy({ top: -80, behavior: "smooth" })
      } else if (key === "s" || key === "arrowdown") {
        window.scrollBy({ top: 80, behavior: "smooth" })
      } else if (key === "escape") {
        navigate({ to: isFolderSource ? "/explorer" : "/archive", search: { path } })
      }
    }

    window.addEventListener("keydown", onKeydown)
    return () => window.removeEventListener("keydown", onKeydown)
  }, [currentPage, totalPages, path])

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

  if (isLoading || isFolderLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[70vh] w-full" />
      </div>
    )
  }

  if (!currentEntry) {
    return <div>未找到可阅读的图片</div>
  }

  const pathParts = splitPath(path)
  const fileName = getBaseName(path, isFolderSource ? "Folder" : "Archive")
  const dirCrumbs = pathParts.slice(0, -1).map((name, index) => ({
    name,
    path: joinPath(pathParts.slice(0, index + 1), path),
  }))

  const imageUrl = isFolderSource
    ? `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(currentEntry.filePath || "")}`
    : `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(currentEntry.entryPath || "")}`

  // 图片加载失败时的重试处理
  // 压缩包文件可能还在后台解压中，404 时自动重试（最多 5 次，递增延迟）
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    const retryCount = Number(img.dataset.retry || 0)
    const maxRetries = 5
    if (retryCount < maxRetries) {
      img.dataset.retry = String(retryCount + 1)
      // 递增延迟：1s, 2s, 3s, 4s, 5s
      setTimeout(() => {
        img.src = `${imageUrl}${imageUrl.includes("?") ? "&" : "?"}_t=${Date.now()}`
      }, 1000 * (retryCount + 1))
    }
  }

  // 图片加载成功时重置重试计数
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.dataset.retry = "0"
  }

  return (
    <div className="space-y-4 p-[10px]">
      <nav className="flex items-center gap-2 text-sm">
        <Link to="/" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <Home className="size-4" />
          <span>Home</span>
        </Link>
        {dirCrumbs.map((crumb) => (
          <div key={crumb.path} className="flex items-center gap-2">
            <ChevronRight className="size-4 text-muted-foreground" />
            <Link to="/explorer" search={{ path: crumb.path }} className="text-muted-foreground hover:text-foreground">
              <Folder className="size-4 inline mr-1" />{crumb.name}
            </Link>
          </div>
        ))}
        <ChevronRight className="size-4 text-muted-foreground" />
        <Link
          to={isFolderSource ? "/explorer" : "/archive"}
          search={{ path }}
          className="text-muted-foreground hover:text-foreground"
        >
          {fileName}
        </Link>
      </nav>

      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground truncate">{currentEntry.name}</div>
        <div className="flex items-center gap-2">
          {!isFolderSource && (
            <>
              <Button variant="outline" size="sm" onClick={() => navigate({ to: "/read-overview", search: { path } })}>Overview</Button>
              <Button variant="outline" size="sm" onClick={() => navigate({ to: "/read-waterfall", search: { path } })}>Waterfall</Button>
            </>
          )}
        </div>
      </div>

      <div
        className="relative bg-muted rounded-lg overflow-hidden min-h-[70vh] flex items-center justify-center"
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      >
        <img
          src={imageUrl}
          alt={currentEntry.name}
          onMouseDown={onMouseDown}
          onError={handleImageError}
          onLoad={handleImageLoad}
          draggable={false}
          className="max-w-full max-h-[80vh] object-contain select-none"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale}) rotate(${rotation}deg)`,
            cursor: isDragging ? "grabbing" : "grab",
            transition: isDragging ? "none" : "transform 120ms ease-out",
          }}
        />

        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
          onClick={goPrev}
        >
          <ChevronLeft className="size-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
          onClick={goNext}
        >
          <ChevronRight className="size-6" />
        </Button>

        {!isFolderSource && (
          <ExtractingIndicator status={extractMutation.data?.status} variant="overlay" />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {currentPage + 1} / {totalPages}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={goPrev}>上一页</Button>
          <Button variant="outline" size="sm" onClick={goNext}>下一页</Button>
          <Button variant="outline" size="sm" onClick={zoomOut}>-</Button>
          <Button variant="outline" size="sm" onClick={zoomIn}>+</Button>
          <Button variant="outline" size="icon" onClick={rotate} title="旋转">
            <RotateCw className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={toggleFullscreen} title="全屏">
            <Scan className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const value = Number(prompt("跳转到第几页？"))
              if (!Number.isNaN(value) && value > 0) {
                goToPage(value - 1)
              }
            }}
          >
            跳页
          </Button>
          <Button variant="ghost" size="sm" onClick={resetTransform}>重置视图</Button>
        </div>
      </div>
    </div>
  )
}
