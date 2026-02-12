import { createFileRoute, Link } from "@tanstack/react-router"
import { ChevronRight, Folder, Home } from "lucide-react"

import { OpenAPI } from "@/client"

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

  // Determine video URL
  let videoUrl: string
  let fileName: string
  let parentPath: string

  if (entry) {
    // Video from archive
    videoUrl = `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(entry)}`
    fileName = entry.split(/[/\\]/).pop() || "Video"
    const pathParts = path.split(/[/\\]/).filter(Boolean)
    parentPath = pathParts.slice(0, -1).join("\\")
  } else {
    // Video from filesystem
    videoUrl = `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(path)}`
    const pathParts = path.split(/[/\\]/).filter(Boolean)
    fileName = pathParts[pathParts.length - 1] || "Video"
    parentPath = pathParts.slice(0, -1).join("\\")
  }

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
        <ChevronRight className="size-4 text-muted-foreground" />
        {parentPath && (
          <>
            <Link
              to="/explorer"
              search={{ path: parentPath }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Folder className="size-4 inline mr-1" />
              Explorer
            </Link>
            <ChevronRight className="size-4 text-muted-foreground" />
          </>
        )}
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

      {/* Video Player */}
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
