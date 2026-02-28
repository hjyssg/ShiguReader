import { OpenAPI } from "@/client"

import type { ImageEntry } from "./-types"

interface BuildReadImageUrlParams {
  path: string
  isFolderSource: boolean
  entry?: ImageEntry
}

/**
 * 统一构建 read 页面图片 URL（folder/sibling 走 fs/file，archive 走 fs/archive/file）
 */
export function buildReadImageUrl({
  path,
  isFolderSource,
  entry,
}: BuildReadImageUrlParams): string | undefined {
  if (!entry) return undefined

  if (isFolderSource) {
    if (!entry.filePath) return undefined
    return `${OpenAPI.BASE}/api/v1/fs/file?path=${encodeURIComponent(entry.filePath)}`
  }

  if (!entry.entryPath) return undefined
  return `${OpenAPI.BASE}/api/v1/fs/archive/file?path=${encodeURIComponent(path)}&entry=${encodeURIComponent(entry.entryPath)}`
}
