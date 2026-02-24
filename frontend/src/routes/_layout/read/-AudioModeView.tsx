/**
 * 音频播放模式 — 展示音频列表 + 封面 + 播放器
 */
import { Link } from "@tanstack/react-router"
import { Music4 } from "lucide-react"
import { useState } from "react"
import AudioPlayer from "react-h5-audio-player"
import { useTranslation } from "react-i18next"
import "react-h5-audio-player/lib/styles.css"

import { PathBreadcrumb } from "@/components/Common/PathBreadcrumb"
import { buttonVariants } from "@/components/ui/button"

import type { AudioTrack, ImageEntry } from "./-types"

interface AudioModeViewProps {
  path: string
  source: "archive" | "folder"
  fileName: string
  audioTracks: AudioTrack[]
  audioCoverUrl: string | null | undefined
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
  audioCoverUrl,
  imageEntries,
  extractStatus,
  mtimeText,
  sizeText,
}: AudioModeViewProps) {
  const { t } = useTranslation()
  const [audioIndex, setAudioIndex] = useState(0)
  const selectedTrack = audioTracks[audioIndex]

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
        {imageEntries.length > 0 && (
          <div className="reader-toolbar__right">
            <div className="reader-toolbar__actions">
              <Link
                to="/read"
                search={{ path, page: 0, source, sourceFolderPath: "", mode: "gallery" } as any}
                className={buttonVariants({ variant: "ghost", size: "sm", className: "reader-toolbar__text-button" })}
              >
                Images
              </Link>
            </div>
          </div>
        )}
      </nav>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl space-y-4 p-4">
          {audioCoverUrl && (
            <div className="mx-auto w-full max-w-[400px] rounded-md overflow-hidden border bg-card">
              <img src={audioCoverUrl} alt={fileName} className="w-full object-contain" />
            </div>
          )}
          <div className="space-y-1 rounded-md border bg-card p-3 max-h-[40vh] overflow-auto">
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
