import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import {
  ChevronLeft,
  ChevronRight,
  Folder,
  Home,
  Loader2,
  RotateCw,
  Scan,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { FilesystemService, OpenAPI } from "@/client"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/_layout/read")({
  component: ReadPage,
  validateSearch: (search: Record<string, unknown>) => ({
    path: (search.path as string) || "",
    page: Number(search.page) || 0,
  }),
  head: () => ({
    meta: [{ title: "Reader" }],
  }),
})

function ReadPage() {
  const { path, page } = Route.useSearch()
  const navigate = useNavigate()

  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

  const dragRef = useRef({ startX: 0, startY: 0, startTx: 0, startTy: 0 })

  const { data: listData, isLoading } = useQuery({
    queryKey: ["archive-list", path],
    queryFn: () => FilesystemService.listArchive({ path }),
    enabled: !!path,
  })

  const extractMutation = useMutation({
    mutationFn: (currentPage: number) =>
      FilesystemService.extractArchive({ path, page: currentPage }),
  })

  const imageEntries = useMemo(
    () => listData?.entries.filter((e) => e.file_type === "image") || [],
    [listData],
  )

  const totalPages = imageEntries.length
  const currentPage = Math.min(Math.max(0, page), Math.max(totalPages - 1, 0))
  const currentEntry = imageEntries[currentPage]

  const resetTransform = () => {
    setScale(1)
    setRotation(0)
    setTranslate({ x: 0, y: 0 })
  }

  const goToPage = (nextPage: number) => {
    const target = Math.min(Math.max(0, nextPage), Math.max(totalPages - 1, 0))
    navigate({ to: "/read", search: { path, page: target } })
  }

  const goNext = () => {
    if (currentPage < totalPages - 1) {
      goToPage(currentPage + 1)
    }
  }

  const goPrev = () => {
    if (currentPage > 0) {
      goToPage(currentPage - 1)
    }
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
    if (path) {
      extractMutation.mutate(currentPage)
    }
  }, [path, currentPage])

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
        navigate({ to: "/archive", search: { path } })
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

  if (isLoading) {
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

  const pathParts = path.split(/[/\\]/).filter(Boolean)
  const fileName = pathParts[pathParts.length - 1] || "Archive"
  const parentPath = pathParts.slice(0, -1).join("\\")

  const imageUrl = `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(currentEntry.entry_path)}`

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-2 text-sm">
        <Link to="/" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <Home className="size-4" />
          <span>Home</span>
        </Link>
        <ChevronRight className="size-4 text-muted-foreground" />
        {parentPath && (
          <>
            <Link to="/explorer" search={{ path: parentPath }} className="text-muted-foreground hover:text-foreground">
              <Folder className="size-4 inline mr-1" />Explorer
            </Link>
            <ChevronRight className="size-4 text-muted-foreground" />
          </>
        )}
        <Link to="/archive" search={{ path }} className="text-muted-foreground hover:text-foreground">
          {fileName}
        </Link>
      </nav>

      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground truncate">{currentEntry.name}</div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate({ to: "/read-overview", search: { path } })}>Overview</Button>
          <Button variant="outline" size="sm" onClick={() => navigate({ to: "/read-waterfall", search: { path } })}>Waterfall</Button>
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
          disabled={currentPage === 0}
        >
          <ChevronLeft className="size-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
          onClick={goNext}
          disabled={currentPage === totalPages - 1}
        >
          <ChevronRight className="size-6" />
        </Button>

        {extractMutation.isPending && (
          <div className="absolute right-3 top-3 rounded bg-background/80 px-2 py-1 text-xs flex items-center gap-1">
            <Loader2 className="size-3 animate-spin" /> extracting
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {currentPage + 1} / {totalPages}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={goPrev} disabled={currentPage === 0}>上一页</Button>
          <Button variant="outline" size="sm" onClick={goNext} disabled={currentPage === totalPages - 1}>下一页</Button>
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
