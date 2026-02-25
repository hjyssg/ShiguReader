// 文件导航 Hook — 处理双击打开和新标签页打开
import { useNavigate } from "@tanstack/react-router"
import { useCallback } from "react"

import type { FileSystemItem } from "@/client"
import { getLinkTarget } from "@/constants/openBehavior"
import { useIsMobile } from "@/hooks/useMobile"
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
    return {
      to: "/read" as const,
      search: {
        path: item.path,
        page: 0,
        mode: isMobile ? ("mobile" as const) : undefined,
      },
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
      to: "/read" as const,
      search: {
        path: item.path,
        page: 0,
        mode: "audio" as const,
      },
    }
  }
  if (isImage) {
    return {
      to: "/read" as const,
      search: {
        path: item.path,
        page: 0,
        mode: isMobile ? ("mobile" as const) : undefined,
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

  /** 当前标签页打开（若 OPEN_FILE_IN_NEW_TAB=true 且非文件夹，则改为新标签页） */
  const openItem = useCallback(
    (item: FileSystemItem) => {
      const target = buildNavigationTarget(item, isMobile)
      if (!target) return
      if (getLinkTarget(item.path) !== undefined) {
        const url = buildUrl(target)
        if (url) window.open(url, "_blank")
      } else {
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
