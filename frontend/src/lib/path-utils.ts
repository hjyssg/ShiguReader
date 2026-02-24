export function splitPath(path: string): string[] {
  return path.split(/[/\\]+/).filter(Boolean)
}

export function detectPathSeparator(path: string): "/" | "\\" {
  const lastSlash = path.lastIndexOf("/")
  const lastBackslash = path.lastIndexOf("\\")
  return lastBackslash > lastSlash ? "\\" : "/"
}

export function joinPath(parts: string[], originalPath: string): string {
  return parts.join(detectPathSeparator(originalPath))
}

export function getParentPath(path: string): string {
  const parts = splitPath(path)
  return joinPath(parts.slice(0, -1), path)
}

export function getBaseName(path: string, fallback = ""): string {
  const parts = splitPath(path)
  return parts[parts.length - 1] || fallback
}

export function buildPathBreadcrumbs(
  path: string,
): Array<{ name: string; path: string }> {
  const parts = splitPath(path)
  return parts.map((part, index) => ({
    name: part,
    path: joinPath(parts.slice(0, index + 1), path),
  }))
}

export function wrapPageIndex(index: number, total: number): number {
  if (total <= 0) return 0
  return ((index % total) + total) % total
}

export function buildDestPath(destDir: string, sourcePath: string): string {
  const fileName = getBaseName(sourcePath)
  const separator = detectPathSeparator(destDir || sourcePath)
  const normalizedDestDir = destDir.replace(/[\\/]+$/, "")
  return `${normalizedDestDir}${separator}${fileName}`
}

const ARCHIVE_EXTENSIONS = new Set([
  "zip", "cbz", "cbr", "rar", "7z", "tar", "gz", "bz2",
])

/**
 * 从 path 推断文件类型：
 * - `"archive"` — 有压缩包扩展名
 * - `"folder"`  — 无扩展名（目录）
 * - `"file"`    — 有扩展名但不是压缩包（图片、音频等普通文件）
 */
export function inferPathType(path: string): "archive" | "folder" | "file" {
  const base = getBaseName(path)
  const dotIndex = base.lastIndexOf(".")
  if (dotIndex <= 0) return "folder"  // 无扩展名视为目录
  const ext = base.slice(dotIndex + 1).toLowerCase()
  if (ARCHIVE_EXTENSIONS.has(ext)) return "archive"
  return "file"
}

export function buildReadUrl(
  path: string,
  options: { page?: number } = {},
): string {
  const { page = 0 } = options
  const params = new URLSearchParams({ path, page: String(page) })
  return `/read?${params.toString()}`
}
