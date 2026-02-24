// 压缩包/文件夹加载 Hook — 封装 read 页面的数据加载逻辑
import { useEffect, useMemo, useState } from "react"

import { FilesystemService, OpenAPI } from "@/client"
import type {
  ArchiveListResponse,
  ExtractStatus,
  ListResponse,
} from "@/client"
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
  listData: ArchiveListResponse | null
  folderData: ListResponse | null
  parentListData: ListResponse | null
  /** 压缩包图片已可请求（解压完成或 folder source） */
  archiveImageReady: boolean
  imageEntries: ImageEntry[]
  audioTracks: AudioTrack[]
  audioCoverUrl: string | undefined
}

export function useArchiveExtract(
  path: string,
  isFolderSource: boolean,
): ArchiveExtractResult {
  const parentPath = getParentPath(path)

  const [listData, setListData] = useState<ArchiveListResponse | null>(null)
  const [folderData, setFolderData] = useState<ListResponse | null>(null)
  const [parentListData, setParentListData] = useState<ListResponse | null>(null)
  const [extractStatus, setExtractStatus] = useState<ExtractStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [archiveImageReady, setArchiveImageReady] = useState(isFolderSource)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!path) return

      setIsLoading(true)
      setLoadError(null)
      setListData(null)
      setFolderData(null)
      setParentListData(null)
      setExtractStatus(null)
      setArchiveImageReady(isFolderSource)

      try {
        if (isFolderSource) {
          const data = await FilesystemService.listDirectory({ path })
          if (!cancelled) setFolderData(data)
        } else {
          setArchiveImageReady(false)
          const [extractResult, archiveData, parentData] = await Promise.all([
            FilesystemService.extractArchive({ path, page: 0 }),
            FilesystemService.listArchive({ path }),
            parentPath
              ? FilesystemService.listDirectory({ path: parentPath })
              : Promise.resolve(null),
          ])
          if (cancelled) return
          setExtractStatus(extractResult)
          setListData(archiveData)
          setParentListData(parentData)
          setArchiveImageReady(true)
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
  }, [path, isFolderSource, parentPath])

  const imageEntries = useMemo<ImageEntry[]>(() => {
    if (isFolderSource) {
      return (folderData?.items ?? [])
        .filter((item) => item.item_type === "file" && item.file_type === "image")
        .map((item, index) => ({ name: item.name, index, filePath: item.path }))
    }
    return (listData?.entries ?? [])
      .filter((e) => e.file_type === "image")
      .map((entry, index) => ({ name: entry.name, index, entryPath: entry.entry_path }))
  }, [isFolderSource, folderData, listData])

  const audioTracks = useMemo<AudioTrack[]>(() => {
    if (isFolderSource) return []
    return (listData?.entries ?? [])
      .filter((e) => e.file_type === "audio")
      .map((e) => ({
        name: e.name,
        sourcePath: e.entry_path,
        url: `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(e.entry_path)}`,
      }))
  }, [isFolderSource, listData, path])

  const audioCoverUrl = useMemo<string | undefined>(() => {
    if (isFolderSource) return undefined
    const imageEntry = (listData?.entries ?? []).find((e) => e.file_type === "image")
    if (!imageEntry) return undefined
    return `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(imageEntry.entry_path)}`
  }, [isFolderSource, listData, path])

  return {
    isLoading,
    loadError,
    extractStatus,
    listData,
    folderData,
    parentListData,
    archiveImageReady,
    imageEntries,
    audioTracks,
    audioCoverUrl,
  }
}
