import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ChevronRight, Folder, Home, Music4 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import AudioPlayer from "react-h5-audio-player"
import { useTranslation } from "react-i18next"
import "react-h5-audio-player/lib/styles.css"

import { FilesystemService, OpenAPI } from "@/client"
import { useDocumentTitle } from "@/hooks/useDocumentTitle"
import {
  getBaseName,
  getParentPath,
  joinPath,
  splitPath,
} from "@/lib/path-utils"

export const Route = createFileRoute("/_layout/audio")({
  component: AudioPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      path: (search.path as string) || "",
      entry: (search.entry as string) || undefined,
    }
  },
  head: () => ({
    meta: [
      {
        title: "Audio Player",
      },
    ],
  }),
})

function AudioPage() {
  const { t } = useTranslation()
  const { path, entry } = Route.useSearch()
  const isArchive = Boolean(entry)

  const [currentIndex, setCurrentIndex] = useState(0)

  const folderPath = useMemo(() => {
    if (isArchive) return path
    return getParentPath(path) || path
  }, [isArchive, path])

  const fileName = useMemo(() => {
    if (isArchive) {
      return getBaseName(path, "Audio")
    }
    return getBaseName(folderPath, "Audio")
  }, [isArchive, path, folderPath])

  useDocumentTitle(fileName)

  const archiveQuery = useQuery({
    queryKey: ["archive-list", path],
    queryFn: () => FilesystemService.listArchive({ path }),
    enabled: isArchive && !!path,
  })

  const folderQuery = useQuery({
    queryKey: ["fs-list", folderPath],
    queryFn: () => FilesystemService.listDirectory({ path: folderPath }),
    enabled: !isArchive && !!folderPath,
  })

  const tracks = useMemo(() => {
    if (isArchive) {
      const entries = archiveQuery.data?.entries || []
      return entries
        .filter((e) => e.file_type === "audio")
        .map((e) => ({
          name: e.name,
          sourcePath: e.entry_path,
          url: `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(e.entry_path)}`,
        }))
    }

    const items = folderQuery.data?.items || []
    return items
      .filter((i) => i.item_type === "file" && i.file_type === "audio")
      .map((i) => ({
        name: i.name,
        sourcePath: i.path,
        url: `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(i.path)}`,
      }))
  }, [isArchive, archiveQuery.data?.entries, folderQuery.data?.items, path])

  const coverUrl = useMemo(() => {
    if (isArchive) {
      const imageEntry = (archiveQuery.data?.entries || []).find(
        (e) => e.file_type === "image",
      )
      if (!imageEntry) return undefined
      return `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(imageEntry.entry_path)}`
    }

    const imageItem = (folderQuery.data?.items || []).find(
      (i) => i.item_type === "file" && i.file_type === "image",
    )
    if (!imageItem) return undefined
    return `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(imageItem.path)}`
  }, [isArchive, archiveQuery.data?.entries, folderQuery.data?.items, path])

  const isLoading = isArchive ? archiveQuery.isLoading : folderQuery.isLoading

  const pathParts = splitPath(isArchive ? path : folderPath)
  const dirCrumbs = pathParts.map((name, index) => ({
    name,
    path: joinPath(pathParts.slice(0, index + 1), path),
  }))

  const selectedTrack = tracks[currentIndex]

  useEffect(() => {
    if (tracks.length === 0) {
      setCurrentIndex(0)
      return
    }

    if (isArchive && entry) {
      const nextIndex = tracks.findIndex((t) => t.sourcePath === entry)
      if (nextIndex >= 0) {
        setCurrentIndex(nextIndex)
        return
      }
    }

    if (!isArchive && path) {
      const nextIndex = tracks.findIndex((t) => t.sourcePath === path)
      if (nextIndex >= 0) {
        setCurrentIndex(nextIndex)
        return
      }
    }

    if (currentIndex >= tracks.length) {
      setCurrentIndex(0)
    }
  }, [tracks, isArchive, entry, path, currentIndex])

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-4">
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
      </nav>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : (
        <>
          {coverUrl && (
            <div className="mx-auto w-full max-w-[520px] rounded-md overflow-hidden border bg-card">
              <img
                src={coverUrl}
                alt={fileName}
                className="w-full object-contain"
              />
            </div>
          )}

          <div className="space-y-2 rounded-md border bg-card p-4 max-h-[46vh] overflow-auto">
            {tracks.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                {t("audio.noAudioFiles")}
              </div>
            ) : (
              tracks.map((track, index) => (
                <button
                  key={track.sourcePath}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  className={`w-full text-left px-2 py-1.5 rounded transition-colors ${
                    index === currentIndex
                      ? "bg-primary/15 text-primary"
                      : "hover:bg-accent"
                  }`}
                >
                  <span className="inline-flex items-center gap-2 text-sm">
                    {index === currentIndex ? (
                      <Music4 className="size-4" />
                    ) : (
                      <span className="w-4" />
                    )}
                    {track.name}
                  </span>
                </button>
              ))
            )}
          </div>

          {selectedTrack && (
            <div className="rounded-lg border bg-card p-4">
              <AudioPlayer
                src={selectedTrack.url}
                autoPlay
                showSkipControls={false}
                showJumpControls={false}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
