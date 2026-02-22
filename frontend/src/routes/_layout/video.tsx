/**
 * 视频播放器 - 支持文件系统和压缩包内视频，自动保存/恢复播放进度
 */
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useMemo, useRef } from "react"

import { FilesystemService, OpenAPI } from "@/client"
import { PathBreadcrumb } from "@/components/Common/PathBreadcrumb"
import { formatDateTime, formatFileSize } from "@/components/Files/utils"
import { getBaseName, getParentPath } from "@/lib/path-utils"
import { useDocumentTitle } from "@/hooks/useDocumentTitle"
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
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const lastSavedAtRef = useRef(0)

  // 确定视频 URL 和文件名
  let videoUrl: string
  let fileName: string
  const sourcePath = path

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
  const { data: parentListData } = useQuery({
    queryKey: ["reader-parent-list", parentPath],
    queryFn: () => FilesystemService.listDirectory({ path: parentPath }),
    enabled: !!parentPath,
    retry: false,
  })
  const currentPathMeta = parentListData?.items?.find((item) => item.path === (entry ? path : path))
  const mtimeText = currentPathMeta?.mtime ? formatDateTime(currentPathMeta.mtime) : "-"
  const sizeText = currentPathMeta?.filesize ? formatFileSize(currentPathMeta.filesize) : "-"

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

  return (
    <div className="reader-page">
      {/* 顶部工具栏 */}
      <nav className="reader-toolbar">
        <div className="reader-toolbar__left">
          <PathBreadcrumb
            as="div"
            sourcePath={sourcePath}
            homeLabel={null}
            homeLinkClassName="reader-toolbar__home-link"
            homeIconClassName="size-3.5"
            dirItemClassName="reader-toolbar__crumb-item"
            dirLinkClassName="reader-toolbar__crumb-link"
            separatorClassName="size-3 text-muted-foreground/60"
            showFolderIcon={false}
            collapseDirCrumbsAfter={2}
            extraCrumbs={entry ? [{ label: "Archive", to: "/archive", search: { path } }] : []}
            currentLabel={fileName}
            currentClassName="reader-toolbar__current-link"
          />
        </div>
      </nav>

      {/* 视频播放区域 */}
      <div className="reader-image-stage">
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          className="max-w-full max-h-full"
          controlsList="nodownload"
          onLoadedMetadata={() => restoreProgress(videoRef.current)}
          onTimeUpdate={() => saveProgress(videoRef.current)}
          onEnded={clearProgress}
        >
          Your browser does not support the video tag.
        </video>
      </div>

      {/* 底部 meta bar */}
      <div className="reader-meta-bar">
        <div className="reader-meta-bar__left">
          <div className="reader-meta-bar__row">
            <span title="修改时间" className="text-foreground cursor-default">{mtimeText}</span>
            <span title="文件大小" className="text-foreground cursor-default">{sizeText}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
