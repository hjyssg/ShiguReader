// 文件导航 Hook — 处理双击打开和新标签页打开
import { useNavigate } from "@tanstack/react-router"
import { useCallback } from "react"

import type { FileSystemItem } from "@/client"
import { useIsMobile } from "@/hooks/useMobile"
import { getParentPath } from "@/lib/path-utils"

/** 根据文件类型构建导航目标 */
export function buildNavigationTarget(item: FileSystemItem, isMobile: boolean) {
  const isFolder = item.item_type === "folder"
  const isArchive = item.file_type === "archive"
  const isVideo = item.file_type === "video"
  const isAudio = item.file_type === "audio"
  const isImage = item.file_type === "image"

  if (isFolder) {
    return {
      to: "/explorer" as const,
      search: { path: item.path, page: 1, pageSize: 48, sortField: "mtime" as const, sortOrder: "desc" as const },
    }
  }
  if (isArchive) {
    // archive: 跳转 explorer 并携带 archivePath，由 explorer 内部触发解压
    return {
      to: "/explorer" as const,
      search: { path: item.path, archivePath: item.path, page: 1, pageSize: 48, sortField: "mtime" as const, sortOrder: "desc" as const },
    }
  }
  if (isVideo) {
    return {
      to: "/video" as const,
      search: { path: item.path, entry: undefined },
    }
  }
  if (isAudio) {
    return {
      to: "/audio" as const,
      search: { path: item.path, entry: undefined },
    }
  }
  if (isImage) {
    const parentPath = getParentPath(item.path)
    const readRoute = isMobile ? "/read-mobile" : "/read"
    return {
      to: readRoute as "/read" | "/read-mobile",
      search: {
        path: parentPath,
        source: "folder" as const,
        page: 0,
        sourceFolderPath: item.path,
      },
    }
  }
  return null
}

/** 构建完整 URL 用于新标签页打开 */
function buildUrl(
  target: ReturnType<typeof buildNavigationTarget>,
): string | null {
  if (!target) return null
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(target.search)) {
    if (value !== undefined && value !== null) {
      params.set(key, String(value))
    }
  }
  return `${target.to}?${params.toString()}`
}

export function useFileNavigation() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  /** 当前标签页打开 */
  const openItem = useCallback(
    (item: FileSystemItem) => {
      const target = buildNavigationTarget(item, isMobile)
      if (target) {
        // TanStack Router's navigate requires exact route-specific search types;
        // the union from buildNavigationTarget is structurally correct but not narrowed per-route.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        navigate({ to: target.to as any, search: target.search as any })
      }
    },
    [navigate, isMobile],
  )

  /** 新标签页打开 */
  const openItemInNewTab = useCallback(
    (item: FileSystemItem) => {
      const target = buildNavigationTarget(item, isMobile)
      const url = buildUrl(target)
      if (url) {
        window.open(url, "_blank")
      }
    },
    [isMobile],
  )

  /** 判断文件是否可打开 */
  const isOpenable = useCallback(
    (item: FileSystemItem) => {
      return buildNavigationTarget(item, isMobile) !== null
    },
    [isMobile],
  )

  return { openItem, openItemInNewTab, isOpenable }
}
