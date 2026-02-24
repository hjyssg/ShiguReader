/**
 * 音频播放模式 — 单页翻图 + 音频列表 + 播放器
 */
import { OpenAPI } from "@/client"
import { PathBreadcrumb } from "@/components/Common/PathBreadcrumb"
import { buttonVariants } from "@/components/ui/button"
import { getParentPath } from "@/lib/path-utils"
import { Link } from "@tanstack/react-router"
import { ChevronLeft, ChevronRight, Music4 } from "lucide-react"
import { useEffect, useState } from "react"
import AudioPlayer from "react-h5-audio-player"
import { useTranslation } from "react-i18next"
import "react-h5-audio-player/lib/styles.css"

import type { AudioTrack, ImageEntry } from "./-types"

interface AudioModeViewProps {
  path: string
  source: "archive" | "folder"
  fileName: string
  audioTracks: AudioTrack[]
  imageEntries: ImageEntry[]
  extractStatus: { cache_dir?: string; status?: string } | null
  mtimeText: string
  sizeText: string
}

export function AudioModeView({
  path,
  source,
  fileName,
  audioTracks,
  imageEntries,
  extractStatus,
  mtimeText,
  sizeText,
}: AudioModeViewProps) {
  const { t } = useTranslation()
  const [audioIndex, setAudioIndex] = useState(0)
  const [imageIndex, setImageIndex] = useState(0)
  const selectedTrack = audioTracks[audioIndex]
  const parentPath = getParentPath(path)
  const isFolderSource = source === "folder"

  const totalImages = imageEntries.length
  const currentImageEntry = imageEntries[imageIndex]
  const currentImageSrc = currentImageEntry
    ? isFolderSource
      ? `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(currentImageEntry.filePath || "")}`
      : `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(currentImageEntry.entryPath || "")}`
    : undefined

  const goPrevImage = () => setImageIndex((i) => (i - 1 + totalImages) % totalImages)
  const goNextImage = () => setImageIndex((i) => (i + 1) % totalImages)

  useEffect(() => {
    if (totalImages === 0) return
    const onKeydown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key === "arrowright" || key === "d") {
        e.preventDefault()
        setImageIndex((i) => (i + 1) % totalImages)
      } else if (key === "arrowleft" || key === "a") {
        e.preventDefault()
        setImageIndex((i) => (i - 1 + totalImages) % totalImages)
      }
    }
    window.addEventListener("keydown", onKeydown)
    return () => window.removeEventListener("keydown", onKeydown)
  }, [totalImages])

  return (
    <div className="reader-page">
      <nav className="reader-toolbar">
        <div className="reader-toolbar__left">
          <PathBreadcrumb
            as="div"
            sourcePath={path}
            homeLabel={null}
            homeLinkClassName="reader-toolbar__home-link"
            homeIconClassName="size-3.5"
            dirItemClassName="reader-toolbar__crumb-item"
            dirLinkClassName="reader-toolbar__crumb-link"
            separatorClassName="size-3 text-muted-foreground/60"
            showFolderIcon={false}
            collapseDirCrumbsAfter={2}
            currentTo="/explorer"
            currentSearch={{ path: extractStatus?.cache_dir || path, page: 1, pageSize: 48, sortField: "name", sortOrder: "asc", viewMode: "table" }}
            currentLabel={fileName}
            currentClassName="reader-toolbar__current-link"
          />
        </div>
        <div className="reader-toolbar__right">
          <div className="reader-toolbar__actions">
            {imageEntries.length > 0 && (
              <Link
                to="/read"
                search={{ path, page: 0, source, sourceFolderPath: "", mode: "gallery" } as any}
                className={buttonVariants({ variant: "ghost", size: "sm", className: "reader-toolbar__text-button" })}
              >
                Images
              </Link>
            )}
            <Link
              to="/explorer"
              search={{ path: isFolderSource ? parentPath : (extractStatus?.cache_dir || parentPath), page: 1, pageSize: 48, sortField: "name", sortOrder: "asc", viewMode: "table" }}
              className={buttonVariants({ variant: "ghost", size: "sm", className: "reader-toolbar__text-button" })}
            >
              Explorer
            </Link>
          </div>
        </div>
      </nav>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl space-y-4 p-4">
          {/* 单页翻图区 — 高度比 gallery 小，留空间给音轨列表 */}
          {totalImages > 0 && currentImageSrc && (
            <div className="relative flex items-center justify-center rounded-md border bg-card overflow-hidden h-[35vh]">
              <img
                src={currentImageSrc}
                alt={currentImageEntry?.name}
                className="h-full w-full object-contain"
              />
                <>
                  <button
                    type="button"
                    onClick={goPrevImage}
                    className="reader-nav-button reader-nav-button--left"
                    aria-label={t("reader.prevPage")}
                  >
                    <ChevronLeft className="reader-nav-button__icon" />
                  </button>
                  <button
                    type="button"
                    onClick={goNextImage}
                    className="reader-nav-button reader-nav-button--right"
                    aria-label={t("reader.nextPage")}
                  >
                    <ChevronRight className="reader-nav-button__icon" />
                  </button>
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-white bg-black/50 rounded px-2 py-0.5 select-none">
                    {imageIndex + 1} / {totalImages}
                  </span>
                </>
            </div>
          )}

          {/* 音轨列表 */}
          <div className="space-y-1 rounded-md border bg-card p-3 max-h-[30vh] overflow-auto">
            {audioTracks.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t("audio.noAudioFiles")}</div>
            ) : (
              audioTracks.map((track, index) => (
                <button
                  key={track.sourcePath}
                  type="button"
                  onClick={() => setAudioIndex(index)}
                  className={`w-full text-left px-2 py-1.5 rounded transition-colors ${
                    index === audioIndex ? "bg-primary/15 text-primary" : "hover:bg-accent"
                  }`}
                >
                  <span className="inline-flex items-center gap-2 text-sm">
                    {index === audioIndex ? <Music4 className="size-4" /> : <span className="w-4" />}
                    {track.name}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* 播放器 */}
          {selectedTrack && (
            <div className="rounded-lg border bg-card p-3">
              <AudioPlayer
                src={selectedTrack.url}
                autoPlay={false}
                showSkipControls={false}
                showJumpControls={false}
              />
            </div>
          )}
        </div>
      </div>

      <div className="reader-meta-bar">
        <div className="reader-meta-bar__left">
          <div className="reader-meta-bar__row">
            <span title={t("reader.mtime")} className="text-foreground cursor-default">{mtimeText}</span>
            <span title={t("reader.size")} className="text-foreground cursor-default">{sizeText}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
