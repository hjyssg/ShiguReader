import { createFileRoute, Link } from "@tanstack/react-router"
import { ChevronRight, Folder, Home } from "lucide-react"
import AudioPlayer from "react-h5-audio-player"
import "react-h5-audio-player/lib/styles.css"

import { OpenAPI } from "@/client"
import { getBaseName, joinPath, splitPath } from "@/lib/path-utils"

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

  const pathParts = splitPath(sourcePath)
  // 目录面包屑仅展示父目录，避免把文件名显示两次
  const targetParts = pathParts.slice(0, -1)
  const dirCrumbs = targetParts.map((name, index) => ({
    name,
    path: joinPath(targetParts.slice(0, index + 1), sourcePath),
  }))

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link
          to="/"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Home className="size-4" />
          <span>Home</span>
        </Link>
        {dirCrumbs.map((crumb) => (
          <div key={crumb.path} className="flex items-center gap-2">
            <ChevronRight className="size-4 text-muted-foreground" />
            <Link
              to="/explorer"
              search={{ path: crumb.path }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Folder className="size-4 inline mr-1" />
              {crumb.name}
            </Link>
          </div>
        ))}
        <ChevronRight className="size-4 text-muted-foreground" />
        {entry && (
          <>
            <Link
              to="/archive"
              search={{ path }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Archive
            </Link>
            <ChevronRight className="size-4 text-muted-foreground" />
          </>
        )}
        <span className="font-medium">{fileName}</span>
      </nav>

      {media === "audio" ? (
        <div className="rounded-lg border bg-card p-4">
          <AudioPlayer
            src={videoUrl}
            autoPlay
            showSkipControls={false}
            showJumpControls={false}
          />
        </div>
      ) : (
        <div className="bg-black rounded-lg overflow-hidden">
          <video
            src={videoUrl}
            controls
            autoPlay
            className="w-full max-h-[80vh]"
            controlsList="nodownload"
          >
            Your browser does not support the video tag.
          </video>
        </div>
      )}

      {/* Video Info */}
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">{fileName}</h2>
        {entry && (
          <p className="text-sm text-muted-foreground">
            From archive: {path.split(/[/\\]/).pop()}
          </p>
        )}
      </div>
    </div>
  )
}
