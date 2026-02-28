import type { FileSystemItem } from "@/client"

/** 根据文件类型构建导航目标 */
export function buildNavigationTarget(item: FileSystemItem) {
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
      },
    }
  }
  return null
}

/** 构建完整 URL 用于新标签页打开 */
export function buildUrl(
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
