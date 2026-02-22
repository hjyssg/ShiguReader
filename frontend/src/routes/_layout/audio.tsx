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
import { PathBreadcrumb } from "@/components/Common/PathBreadcrumb"
import { formatDateTime, formatFileSize } from "@/components/Files/utils"
import { useDocumentTitle } from "@/hooks/useDocumentTitle"
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

  // 确定文件夹路径和显示名
  const folderPath = useMemo(() => {
    if (isArchive) return path
    return getParentPath(path) || path
  }, [isArchive, path])

  const fileName = useMemo(() => {
    return isArchive ? getBaseName(path, "Audio") : getBaseName(folderPath, "Audio")
  }, [isArchive, path, folderPath])

  useDocumentTitle(fileName)

  // 数据获取
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

  // 父目录元数据（用于底部 meta bar）
  const parentPath = isArchive ? getParentPath(path) : getParentPath(folderPath)
  const { data: parentListData } = useQuery({
    queryKey: ["reader-parent-list", parentPath],
    queryFn: () => FilesystemService.listDirectory({ path: parentPath }),
    enabled: !!parentPath,
    retry: false,
  })
  const currentPathMeta = parentListData?.items?.find((item) => item.path === (isArchive ? path : folderPath))
  const mtimeText = currentPathMeta?.mtime ? formatDateTime(currentPathMeta.mtime) : "-"
  const sizeText = currentPathMeta?.filesize ? formatFileSize(currentPathMeta.filesize) : "-"

  // 构建音轨列表
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

  // 封面图
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

  // 根据 entry/path 参数定位初始曲目
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
      {/* 顶部工具栏 */}
      <nav className="reader-toolbar">
        <div className="reader-toolbar__left">
          <PathBreadcrumb
            as="div"
            sourcePath={isArchive ? path : folderPath}
            homeLabel={null}
            homeLinkClassName="reader-toolbar__home-link"
            homeIconClassName="size-3.5"
            dirItemClassName="reader-toolbar__crumb-item"
            dirLinkClassName="reader-toolbar__crumb-link"
            separatorClassName="size-3 text-muted-foreground/60"
            showFolderIcon={false}
            collapseDirCrumbsAfter={2}
            extraCrumbs={isArchive ? [{ label: "Archive", to: "/archive", search: { path } }] : []}
            currentLabel={fileName}
            currentClassName="reader-toolbar__current-link"
          />
        </div>
      </nav>

      {/* 主内容区域 */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl space-y-4 p-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <>
              {/* 封面图 */}
              {coverUrl && (
                <div className="mx-auto w-full max-w-[400px] rounded-md overflow-hidden border bg-card">
                  <img src={coverUrl} alt={fileName} className="w-full object-contain" />
                </div>
              )}

              {/* 播放列表 */}
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

              {/* 播放器控件 */}
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
