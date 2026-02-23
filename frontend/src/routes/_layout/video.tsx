/**
 * 视频播放器 - 支持文件系统和压缩包内视频，自动保存/恢复播放进度
 */
import { MoreVertical, Pencil, Trash2 } from "lucide-react"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation } from "@/shims/react-query"
import { useMemo, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"

import { OpenAPI } from "@/client"
import { DownloadMenuItem } from "@/components/Files/DownloadMenuItem"
import { DeleteDialog } from "@/components/Files/dialogs/DeleteDialog"
import { RenameDialog } from "@/components/Files/dialogs/RenameDialog"
import { ReaderMetaBar } from "@/components/Reader/ReaderMetaBar"
import { ReaderToolbar } from "@/components/Reader/ReaderToolbar"
import { useDocumentTitle } from "@/hooks/useDocumentTitle"
import { useFileOperations } from "@/hooks/useFileOperations"
import { useParentMeta } from "@/hooks/useParentMeta"
import { getBaseName, getParentPath } from "@/lib/path-utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import "./read.css"

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
  const { path, entry } = Route.useSearch()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const lastSavedAtRef = useRef(0)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

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
  const { mtimeText, sizeText } = useParentMeta(entry ? path : path, parentPath)

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

  return (
    <div className="reader-page">
      <ReaderToolbar
        sourcePath={path}
        fileName={fileName}
        extraCrumbs={entry ? [{ label: "Archive", to: "/explorer", search: { path, page: 1, pageSize: 48, sortField: "mtime", sortOrder: "desc" } }] : []}
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
      <div className="reader-image-stage">
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          className="max-w-full max-h-full"
          controlsList="nodownload"
          onLoadedMetadata={() => restoreProgress(videoRef.current)}
          onPlay={recordOpenedHistory}
          onTimeUpdate={() => saveProgress(videoRef.current)}
          onEnded={clearProgress}
        >
          Your browser does not support the video tag.
        </video>
      </div>

      <ReaderMetaBar
        left={
          <>
            <span title="修改时间" className="text-foreground cursor-default">{mtimeText}</span>
            <span title="文件大小" className="text-foreground cursor-default">{sizeText}</span>
          </>
        }
      />

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
