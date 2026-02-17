import { createFileRoute } from "@tanstack/react-router"
import { useMemo, useRef } from "react"
import AudioPlayer from "react-h5-audio-player"
import "react-h5-audio-player/lib/styles.css"

import { OpenAPI } from "@/client"
import { PathBreadcrumb } from "@/components/Common/PathBreadcrumb"
import { getBaseName } from "@/lib/path-utils"

export const Route = createFileRoute("/_layout/video")({
  component: Video,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      path: (search.path as string) || "",
      entry: (search.entry as string) || undefined,
      media: (search.media as "video" | "audio") || "video",
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
  const { path, entry, media } = Route.useSearch()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioPlayerRef = useRef<any>(null)
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
    fileName = getBaseName(path, media === "audio" ? "Audio" : "Video")
    sourcePath = path
  }

  const progressStorageKey = useMemo(
    () => `media-progress:${media}:${path}:${entry ?? ""}`,
    [media, path, entry],
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

      {media === "audio" ? (
        <div className="rounded-lg border bg-card p-4">
          <AudioPlayer
            ref={audioPlayerRef}
            src={videoUrl}
            showSkipControls={false}
            showJumpControls={false}
            onLoadedMetadata={() => {
              const audio = audioPlayerRef.current?.audio?.current as
                | HTMLAudioElement
                | undefined
              restoreProgress(audio ?? null)
            }}
            onListen={() => {
              const audio = audioPlayerRef.current?.audio?.current as
                | HTMLAudioElement
                | undefined
              saveProgress(audio ?? null)
            }}
            onEnded={clearProgress}
          />
        </div>
      ) : (
        <div className="bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            className="w-full max-h-[80vh]"
            controlsList="nodownload"
            onLoadedMetadata={() => restoreProgress(videoRef.current)}
            onTimeUpdate={() => saveProgress(videoRef.current)}
            onEnded={clearProgress}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      )}

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
