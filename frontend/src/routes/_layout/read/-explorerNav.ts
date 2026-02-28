import { getParentPath } from "@/lib/path-utils"

export function getReadExplorerPath({
  path,
  isFolderSource,
  extractCacheDir,
}: {
  path: string
  isFolderSource: boolean
  extractCacheDir?: string
}) {
  if (isFolderSource) {
    return getParentPath(path)
  }
  return extractCacheDir || path
}

export function getReadExplorerSearch({
  path,
  isFolderSource,
  extractCacheDir,
}: {
  path: string
  isFolderSource: boolean
  extractCacheDir?: string
}) {
  return {
    path: getReadExplorerPath({ path, isFolderSource, extractCacheDir }),
    sortField: "name" as const,
    sortOrder: "asc" as const,
    viewMode: "table" as const,
  }
}
