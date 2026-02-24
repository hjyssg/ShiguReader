// 压缩包/文件夹加载 Hook — 封装 read 页面的数据加载逻辑
// source 四种模式：
//   "folder"  → listDirectory(path)
//   "archive" → extractArchive(path)，entries/mtime/filesize 内联返回
//   "image"   → listDirectory(parentPath)，从兄弟文件中找图片
//   "audio"   → listDirectory(parentPath)，从兄弟文件中找音频
import { useEffect, useMemo, useState } from "react"

import { FilesystemService, OpenAPI } from "@/client"
import type { ExtractStatus, ListResponse } from "@/client"
import { getBaseName, getParentPath } from "@/lib/path-utils"

export type ReadSource = "archive" | "folder" | "image" | "audio"

export type ImageEntry = {
  name: string
  index: number
  filePath?: string
  entryPath?: string
}

export type AudioTrack = {
  name: string
  sourcePath: string
  url: string
}

export interface ArchiveExtractResult {
  isLoading: boolean
  loadError: unknown
  extractStatus: ExtractStatus | null
  folderData: ListResponse | null
  /** 压缩包图片已可请求（解压完成或 folder/image/audio source） */
  archiveImageReady: boolean
  imageEntries: ImageEntry[]
  audioTracks: AudioTrack[]
  audioCoverUrl: string | undefined
  /** 文件修改时间（Unix 秒），archive 分支从 extractStatus 读，其余从 folderData 读 */
  mtime: number | null
  /** 文件大小（字节） */
  filesize: number | null
}

export function useArchiveExtract(
  path: string,
  source: ReadSource,
): ArchiveExtractResult {
  const parentPath = getParentPath(path)
  const isFolderSource = source === "folder"

  const [folderData, setFolderData] = useState<ListResponse | null>(null)
  const [extractStatus, setExtractStatus] = useState<ExtractStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [archiveImageReady, setArchiveImageReady] = useState(source !== "archive")

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!path) return

      setIsLoading(true)
      setLoadError(null)
      setFolderData(null)
      setExtractStatus(null)
      setArchiveImageReady(source !== "archive")

      try {
        if (source === "folder") {
          // folder: list the folder itself
          const data = await FilesystemService.listDirectory({ path })
          if (!cancelled) setFolderData(data)
        } else if (source === "archive") {
          // archive: extract returns entries + mtime + filesize inline
          setArchiveImageReady(false)
          const result = await FilesystemService.extractArchive({ path, page: 0 })
          if (!cancelled) {
            setExtractStatus(result)
            setArchiveImageReady(true)
          }
        } else {
          // image / audio: list parent directory to get sibling files
          const dir = parentPath || path
          const data = await FilesystemService.listDirectory({ path: dir })
          if (!cancelled) setFolderData(data)
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error)
          setArchiveImageReady(true)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [path, source, parentPath])

  const archiveEntries = extractStatus?.entries ?? []

  const imageEntries = useMemo<ImageEntry[]>(() => {
    if (source === "folder") {
      return (folderData?.items ?? [])
        .filter((item) => item.item_type === "file" && item.file_type === "image")
        .map((item, index) => ({ name: item.name, index, filePath: item.path }))
    }
    if (source === "archive") {
      return archiveEntries
        .filter((e) => e.file_type === "image")
        .map((entry, index) => ({ name: entry.name, index, entryPath: entry.entry_path }))
    }
    // image / audio: sibling image files from parent dir
    return (folderData?.items ?? [])
      .filter((item) => item.item_type === "file" && item.file_type === "image")
      .map((item, index) => ({ name: item.name, index, filePath: item.path }))
  }, [source, folderData, archiveEntries])

  const audioTracks = useMemo<AudioTrack[]>(() => {
    if (source === "folder") {
      return (folderData?.items ?? [])
        .filter((item) => item.item_type === "file" && item.file_type === "audio")
        .map((item) => ({
          name: item.name,
          sourcePath: item.path,
          url: `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(item.path)}`,
        }))
    }
    if (source === "archive") {
      return archiveEntries
        .filter((e) => e.file_type === "audio")
        .map((e) => ({
          name: e.name,
          sourcePath: e.entry_path,
          url: `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(e.entry_path)}`,
        }))
    }
    // image / audio: sibling audio files from parent dir
    return (folderData?.items ?? [])
      .filter((item) => item.item_type === "file" && item.file_type === "audio")
      .map((item) => ({
        name: item.name,
        sourcePath: item.path,
        url: `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(item.path)}`,
      }))
  }, [source, folderData, archiveEntries, path])

  const audioCoverUrl = useMemo<string | undefined>(() => {
    if (source === "archive") {
      const imageEntry = archiveEntries.find((e) => e.file_type === "image")
      if (!imageEntry) return undefined
      return `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(imageEntry.entry_path)}`
    }
    // folder / image / audio: first image from folderData
    const imageItem = (folderData?.items ?? []).find(
      (item) => item.item_type === "file" && item.file_type === "image",
    )
    if (!imageItem) return undefined
    return `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(imageItem.path)}`
  }, [source, folderData, archiveEntries, path])

  // mtime / filesize: archive from extractStatus, others from folderData current file
  const currentFileMeta = useMemo(() => {
    if (source === "archive") return null
    return (folderData?.items ?? []).find((item) => item.path === path) ?? null
  }, [source, folderData, path])

  const mtime: number | null =
    source === "archive"
      ? (extractStatus?.mtime ?? null)
      : (currentFileMeta?.mtime ?? null)

  const filesize: number | null =
    source === "archive"
      ? (extractStatus?.filesize ?? null)
      : (currentFileMeta?.filesize ?? null)

  return {
    isLoading,
    loadError,
    extractStatus,
    folderData,
    archiveImageReady,
    imageEntries,
    audioTracks,
    audioCoverUrl,
    mtime,
    filesize,
  }
}
