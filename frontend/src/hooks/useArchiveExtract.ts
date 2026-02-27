/**
 * 压缩包/文件夹加载 Hook — 封装 read 页面的数据加载逻辑
 *
 * 根据 path 自动推断数据源类型：
 * - 有压缩包扩展名（zip/cbz/cbr/rar/7z 等）→ archive 模式，调用 extractArchive
 * - 无扩展名（文件夹）→ folder 模式，调用 listDirectory(path)
 * - 图片/音频文件扩展名 → sibling 模式，调用 listDirectory(parentPath)
 */
import { useEffect, useMemo, useState } from "react"

import { FilesystemService, OpenAPI } from "@/client"
import type { ExtractStatus, ListResponse } from "@/client"
import { getFileType } from "@common/fileTypeUtil"
import { getParentPath } from "@/lib/path-utils"

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
  /** 图片已可请求（压缩包解压完成，或 folder/sibling source 无需等待） */
  imagesReady: boolean
  imageEntries: ImageEntry[]
  audioTracks: AudioTrack[]
  /** 文件修改时间（Unix 秒） */
  mtime: number | null
  /** 文件大小（字节） */
  filesize: number | null
  /**
   * 推断出的数据源类型：
   * - "archive"：压缩包，图片来自解压结果
   * - "folder"：文件夹，图片来自目录列表
   * - "sibling"：单张图片/音频/视频文件，图片来自父目录列表（兄弟文件）
   */
  source: "archive" | "folder" | "sibling"
}

type InternalSource = "archive" | "folder" | "sibling"

function inferInternalSource(path: string): InternalSource {
  const type = getFileType(path)
  if (type === "archive") return "archive"
  if (type === "folder") return "folder"
  return "sibling"  // image/audio/video/unknown → 列父目录
}

export function useArchiveExtract(
  path: string,
): ArchiveExtractResult {
  const parentPath = getParentPath(path)
  const internalSource = inferInternalSource(path)
  // source 直接透传 internalSource，让调用方能区分 sibling 模式
  const source = internalSource

  const [folderData, setFolderData] = useState<ListResponse | null>(null)
  const [extractStatus, setExtractStatus] = useState<ExtractStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [imagesReady, setImagesReady] = useState(internalSource !== "archive")

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!path) return

      setIsLoading(true)
      setLoadError(null)
      setFolderData(null)
      setExtractStatus(null)
      const src = inferInternalSource(path)
      setImagesReady(src !== "archive")

      try {
        if (src === "archive") {
          setImagesReady(false)
          const result = await FilesystemService.extractArchive({ path, page: 0 })
          if (!cancelled) {
            setExtractStatus(result)
            setImagesReady(true)
          }
        } else if (src === "folder") {
          const data = await FilesystemService.listDirectory({ path })
          if (!cancelled) setFolderData(data)
        } else {
          // sibling: list parent directory to get sibling files
          const data = await FilesystemService.listDirectory({ path: parentPath })
          if (!cancelled) setFolderData(data)
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error)
          setImagesReady(true)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [path, parentPath])

  const archiveEntries = extractStatus?.entries ?? []

  const imageEntries = useMemo<ImageEntry[]>(() => {
    if (internalSource === "archive") {
      return archiveEntries
        .filter((e) => e.file_type === "image")
        .map((entry, index) => ({ name: entry.name, index, entryPath: entry.entry_path }))
    }
    const items = folderData?.items ?? []
    const imageItems = items.filter((item) => item.item_type === "file" && item.file_type === "image")
    return imageItems.map((item, index) => ({ name: item.name, index, filePath: item.path }))
  }, [internalSource, folderData, archiveEntries])

  const audioTracks = useMemo<AudioTrack[]>(() => {
    if (internalSource === "archive") {
      return archiveEntries
        .filter((e) => e.file_type === "audio")
        .map((e) => ({
          name: e.name,
          sourcePath: e.entry_path,
          url: `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(e.entry_path)}`,
        }))
    }
    return (folderData?.items ?? [])
      .filter((item) => item.item_type === "file" && item.file_type === "audio")
      .map((item) => ({
        name: item.name,
        sourcePath: item.path,
        url: `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(item.path)}`,
      }))
  }, [internalSource, folderData, archiveEntries, path])

  const mtime: number | null =
    internalSource === "archive"
      ? (extractStatus?.mtime ?? null)
      : ((folderData?.items ?? []).find((item) => item.path === path || item.path === parentPath)?.mtime ?? null)

  const filesize: number | null =
    internalSource === "archive"
      ? (extractStatus?.filesize ?? null)
      : ((folderData?.items ?? []).find((item) => item.path === path)?.filesize ?? null)

  return {
    isLoading,
    loadError,
    extractStatus,
    folderData,
    imagesReady,
    imageEntries,
    audioTracks,
    mtime,
    filesize,
    source,
  }
}
