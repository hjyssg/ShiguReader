/**
 * 视频/音频播放器 - 支持播放视频和音频文件，自动保存播放进度
 */
import { createFileRoute } from "@tanstack/react-router"
import { useMemo, useRef } from "react"

import { OpenAPI } from "@/client"
import { PathBreadcrumb } from "@/components/Common/PathBreadcrumb"
import { getBaseName } from "@/lib/path-utils"
import { useDocumentTitle } from "@/hooks/useDocumentTitle"

export const Route = createFileRoute("/_layout/video")({
  component: Video,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      path: (search.path as string) || "",
      entry: (search.entry as string) || undefined,
    }
  },
  head: () => ({
    meta: [
      {
        title: "Video Player",
      },
    ],
  }),
})

function Video() {
  const { path, entry } = Route.useSearch()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const lastSavedAtRef = useRef(0)

  // Determine video URL
  let videoUrl: string
  let fileName: string
  let sourcePath: string

  if (entry) {
    // Video from archive
    videoUrl = `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(entry)}`
    fileName = entry.split(/[/\\]/).pop() || "Video"
    sourcePath = path
  } else {
    // Video from filesystem
    videoUrl = `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(path)}`
    fileName = getBaseName(path, "Video")
    sourcePath = path
  }
  
  useDocumentTitle(fileName)

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

    // Avoid restoring to very end.
    const target = Math.min(savedTime, Math.max(0, duration - 3))
    if (target > 0) {
      element.currentTime = target
    }
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

  const clearProgress = () => {
    localStorage.removeItem(progressStorageKey)
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <PathBreadcrumb
        sourcePath={sourcePath}
        extraCrumbs={
          entry
            ? [
                {
                  label: "Archive",
                  to: "/archive",
                  search: { path },
                },
              ]
            : []
        }
        currentLabel={fileName}
      />

      <div className="overflow-hidden">
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          className="w-full max-h-[90vh]"
          controlsList="nodownload"
          onLoadedMetadata={() => restoreProgress(videoRef.current)}
          onTimeUpdate={() => saveProgress(videoRef.current)}
          onEnded={clearProgress}
        >
          Your browser does not support the video tag.
        </video>
      </div>

      {/*
      <div className="space-y-2">
        {entry && (
          <p className="text-sm text-muted-foreground">
            From archive: {path.split(/[/\\]/).pop()}
          </p>
        )}
      </div> */}
    </div>
  )
}
