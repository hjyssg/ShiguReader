/**
 * 视频播放器 - 支持文件系统和压缩包内视频，自动保存/恢复播放进度
 */
import { MoreVertical, Pencil, Trash2 } from "lucide-react"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation } from "@/shims/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"

import { OpenAPI } from "@/client"
import { DownloadMenuItem } from "@/components/Files/DownloadMenuItem"
import { DeleteDialog } from "@/components/Files/dialogs/DeleteDialog"
import { RenameDialog } from "@/components/Files/dialogs/RenameDialog"
import { ReaderToolbar } from "@/components/Reader/ReaderToolbar"
import { useDocumentTitle } from "@/hooks/useDocumentTitle"
import { useFileOperations } from "@/hooks/useFileOperations"
import { getBaseName, getParentPath } from "@/lib/path-utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import "./video.css"

export const Route = createFileRoute("/_layout/video")({
  component: Video,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      path: (search.path as string) || "",
      entry: (search.entry as string) || undefined,
    }
  },
  head: () => ({
    meta: [{ title: "Video Player" }],
  }),
})

function Video() {
  const VIDEO_BASE_MAX_WIDTH = 1500
  const VIDEO_BASE_MAX_HEIGHT = 1000
  const VIDEO_SCALE_MIN = 0.4
  const VIDEO_SCALE_MAX = 1.4
  const VIDEO_SCALE_STEP = 0.05

  const { path, entry } = Route.useSearch()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const lastSavedAtRef = useRef(0)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [videoScale, setVideoScale] = useState(1)

  const { mutate: recordHistory } = useMutation({
    mutationFn: async (payload: { filepath: string }) => {
      await fetch(`${OpenAPI.BASE}/api/v1/history/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    },
  })

  // 确定视频 URL 和文件名
  let videoUrl: string
  let fileName: string

  if (entry) {
    videoUrl = `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(entry)}`
    fileName = entry.split(/[/\\]/).pop() || "Video"
  } else {
    videoUrl = `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(path)}`
    fileName = getBaseName(path, "Video")
  }

  useDocumentTitle(fileName)

  // 读取父目录元数据（用于底部 meta bar）
  const parentPath = entry ? path : getParentPath(path)
  const operations = useFileOperations(parentPath)

  // 播放进度持久化（localStorage）
  const progressStorageKey = useMemo(
    () => `media-progress:video:${path}:${entry ?? ""}`,
    [path, entry],
  )

  const restoreProgress = (element: HTMLMediaElement | null) => {
    if (!element) return
    const saved = localStorage.getItem(progressStorageKey)
    const savedTime = saved ? Number(saved) : NaN
    if (!Number.isFinite(savedTime) || savedTime <= 0) return
    const duration = element.duration
    if (!Number.isFinite(duration) || duration <= 0) return
    const target = Math.min(savedTime, Math.max(0, duration - 3))
    if (target > 0) element.currentTime = target
  }

  const saveProgress = (element: HTMLMediaElement | null) => {
    if (!element) return
    const now = Date.now()
    if (now - lastSavedAtRef.current < 2000) return
    lastSavedAtRef.current = now
    const current = element.currentTime
    if (Number.isFinite(current) && current > 0) {
      localStorage.setItem(progressStorageKey, String(current))
    }
  }

  const clearProgress = () => localStorage.removeItem(progressStorageKey)

  const downloadHref = entry
    ? `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(entry)}`
    : undefined

  const recordOpenedHistory = () => {
    if (!path) return
    recordHistory({ filepath: path })
  }

  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return
      }

      if (e.key === "+" || e.key === "=" || e.key === "Add") {
        e.preventDefault()
        setVideoScale((prev) => {
          const next = prev + VIDEO_SCALE_STEP
          return Math.min(VIDEO_SCALE_MAX, Math.max(VIDEO_SCALE_MIN, Number(next.toFixed(2))))
        })
        return
      }

      if (e.key === "-" || e.key === "Subtract") {
        e.preventDefault()
        setVideoScale((prev) => {
          const next = prev - VIDEO_SCALE_STEP
          return Math.min(VIDEO_SCALE_MAX, Math.max(VIDEO_SCALE_MIN, Number(next.toFixed(2))))
        })
      }
    }

    window.addEventListener("keydown", onKeydown)
    return () => window.removeEventListener("keydown", onKeydown)
  }, [VIDEO_SCALE_MAX, VIDEO_SCALE_MIN, VIDEO_SCALE_STEP])

  return (
    <div className="video-page">
      <ReaderToolbar
        sourcePath={path}
        actions={(
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
              <DownloadMenuItem
                path={entry ? undefined : path}
                href={downloadHref}
                name={fileName}
              />
              <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                <Pencil className="mr-2 size-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      {/* 视频播放区域 */}
      <div className="video-stage">
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          className="video-player"
          style={{
            maxWidth: `${Math.round(VIDEO_BASE_MAX_WIDTH * videoScale)}px`,
            maxHeight: `${Math.round(VIDEO_BASE_MAX_HEIGHT * videoScale)}px`,
          }}
          controlsList="nodownload"
          onLoadedMetadata={() => restoreProgress(videoRef.current)}
          onPlay={recordOpenedHistory}
          onTimeUpdate={() => saveProgress(videoRef.current)}
          onEnded={clearProgress}
        >
          Your browser does not support the video tag.
        </video>
        <div className="video-scale-indicator" aria-live="polite">
          {Math.round(videoScale * 100)}%
        </div>
      </div>

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
    </div>
  )
}
