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
import { getParentPath, inferPathType } from "@/lib/path-utils"

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
  /** 压缩包图片已可请求（解压完成或 folder/sibling source） */
  archiveImageReady: boolean
  imageEntries: ImageEntry[]
  audioTracks: AudioTrack[]
  /** 文件修改时间（Unix 秒） */
  mtime: number | null
  /** 文件大小（字节） */
  filesize: number | null
  /** 推断出的数据源类型 */
  source: "archive" | "folder"
}

type InternalSource = "archive" | "folder" | "sibling"

function inferInternalSource(path: string): InternalSource {
  const type = inferPathType(path)
  if (type === "file") return "sibling"   // 图片/音频等普通文件 → 列父目录
  if (type === "archive") return "archive"
  return "folder"
}

export function useArchiveExtract(
  path: string,
): ArchiveExtractResult {
  const parentPath = getParentPath(path)
  const internalSource = inferInternalSource(path)
  const source = internalSource === "archive" ? "archive" : "folder"

  const [folderData, setFolderData] = useState<ListResponse | null>(null)
  const [extractStatus, setExtractStatus] = useState<ExtractStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [archiveImageReady, setArchiveImageReady] = useState(internalSource !== "archive")

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!path) return

      setIsLoading(true)
      setLoadError(null)
      setFolderData(null)
      setExtractStatus(null)
      const src = inferInternalSource(path)
      setArchiveImageReady(src !== "archive")

      try {
        if (src === "archive") {
          setArchiveImageReady(false)
          const result = await FilesystemService.extractArchive({ path, page: 0 })
          if (!cancelled) {
            setExtractStatus(result)
            setArchiveImageReady(true)
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
          setArchiveImageReady(true)
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
    archiveImageReady,
    imageEntries,
    audioTracks,
    mtime,
    filesize,
    source,
  }
}
