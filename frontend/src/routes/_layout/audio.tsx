/**
 * 音频播放器 - 支持文件夹和压缩包内音频，显示封面和播放列表
 */
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Music4 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import AudioPlayer from "react-h5-audio-player"
import { useTranslation } from "react-i18next"
import "react-h5-audio-player/lib/styles.css"

import { FilesystemService, OpenAPI } from "@/client"
import { ReaderMetaBar } from "@/components/Reader/ReaderMetaBar"
import { ReaderToolbar } from "@/components/Reader/ReaderToolbar"
import { useDocumentTitle } from "@/hooks/useDocumentTitle"
import { useParentMeta } from "@/hooks/useParentMeta"
import { getBaseName, getParentPath } from "@/lib/path-utils"
import "./read.css"

export const Route = createFileRoute("/_layout/audio")({
  component: AudioPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      path: (search.path as string) || "",
      entry: (search.entry as string) || undefined,
    }
  },
  head: () => ({
    meta: [{ title: "Audio Player" }],
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
    return isArchive ? getBaseName(path, "Audio") : getBaseName(folderPath, "Audio")
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

  const parentPath = isArchive ? getParentPath(path) : getParentPath(folderPath)
  const { mtimeText, sizeText } = useParentMeta(isArchive ? path : folderPath, parentPath)

  const tracks = useMemo(() => {
    if (isArchive) {
      return (archiveQuery.data?.entries || [])
        .filter((e) => e.file_type === "audio")
        .map((e) => ({
          name: e.name,
          sourcePath: e.entry_path,
          url: `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(e.entry_path)}`,
        }))
    }
    return (folderQuery.data?.items || [])
      .filter((i) => i.item_type === "file" && i.file_type === "audio")
      .map((i) => ({
        name: i.name,
        sourcePath: i.path,
        url: `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(i.path)}`,
      }))
  }, [isArchive, archiveQuery.data?.entries, folderQuery.data?.items, path])

  const coverUrl = useMemo(() => {
    if (isArchive) {
      const imageEntry = (archiveQuery.data?.entries || []).find((e) => e.file_type === "image")
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
  const selectedTrack = tracks[currentIndex]

  useEffect(() => {
    if (tracks.length === 0) { setCurrentIndex(0); return }
    if (isArchive && entry) {
      const idx = tracks.findIndex((t) => t.sourcePath === entry)
      if (idx >= 0) { setCurrentIndex(idx); return }
    }
    if (!isArchive && path) {
      const idx = tracks.findIndex((t) => t.sourcePath === path)
      if (idx >= 0) { setCurrentIndex(idx); return }
    }
    if (currentIndex >= tracks.length) setCurrentIndex(0)
  }, [tracks, isArchive, entry, path, currentIndex])

  return (
    <div className="reader-page">
      <ReaderToolbar
        sourcePath={isArchive ? path : folderPath}
        fileName={fileName}
        extraCrumbs={isArchive ? [{ label: "Archive", to: "/explorer", search: { path, archivePath: path, page: 1, pageSize: 48, sortField: "mtime", sortOrder: "desc" } }] : []}
      />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl space-y-4 p-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <>
              {coverUrl && (
                <div className="mx-auto w-full max-w-[400px] rounded-md overflow-hidden border bg-card">
                  <img src={coverUrl} alt={fileName} className="w-full object-contain" />
                </div>
              )}

              <div className="space-y-1 rounded-md border bg-card p-3 max-h-[40vh] overflow-auto">
                {tracks.length === 0 ? (
                  <div className="text-sm text-muted-foreground">{t("audio.noAudioFiles")}</div>
                ) : (
                  tracks.map((track, index) => (
                    <button
                      key={track.sourcePath}
                      type="button"
                      onClick={() => setCurrentIndex(index)}
                      className={`w-full text-left px-2 py-1.5 rounded transition-colors ${
                        index === currentIndex ? "bg-primary/15 text-primary" : "hover:bg-accent"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2 text-sm">
                        {index === currentIndex ? <Music4 className="size-4" /> : <span className="w-4" />}
                        {track.name}
                      </span>
                    </button>
                  ))
                )}
              </div>

              {selectedTrack && (
                <div className="rounded-lg border bg-card p-3">
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
      </div>

      <ReaderMetaBar
        left={
          <>
            <span title="修改时间" className="text-foreground cursor-default">{mtimeText}</span>
            <span title="文件大小" className="text-foreground cursor-default">{sizeText}</span>
          </>
        }
      />
    </div>
  )
}
