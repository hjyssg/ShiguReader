/**
 * 文件类型判断工具 — 前后端共用
 * 纯字符串操作，无任何运行时依赖
 */

export const IMAGE_SUFFIXES = [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".heic"]
export const VIDEO_SUFFIXES = [".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv"]
export const ARCHIVE_SUFFIXES = [".zip", ".cbz", ".rar", ".cbr", ".7z", ".tar", ".tar.gz", ".tgz"]
export const AUDIO_SUFFIXES = [".mp3", ".flac", ".wav", ".aac", ".ogg", ".m4a"]

const IMAGE_SET = new Set(IMAGE_SUFFIXES)
const VIDEO_SET = new Set(VIDEO_SUFFIXES)
const ARCHIVE_SET = new Set(ARCHIVE_SUFFIXES)
const AUDIO_SET = new Set(AUDIO_SUFFIXES)

/**
 * @param {string} filepath
 * @returns {string}
 */
function getExt(filepath) {
  const base = filepath.replace(/[/\\]+$/, "").split(/[/\\]/).pop() ?? ""
  const tarGz = base.match(/\.(tar\.gz|tgz)$/i)
  if (tarGz) return tarGz[0].toLowerCase()
  const dot = base.lastIndexOf(".")
  if (dot <= 0) return ""
  return base.slice(dot).toLowerCase()
}

/**
 * 从文件路径推断文件类型。无扩展名视为 "folder"。
 * @param {string} filepath
 * @returns {"image"|"video"|"archive"|"audio"|"folder"|"unknown"}
 */
export function getFileType(filepath) {
  const ext = getExt(filepath)
  if (!ext) return "folder"
  if (IMAGE_SET.has(ext)) return "image"
  if (VIDEO_SET.has(ext)) return "video"
  if (ARCHIVE_SET.has(ext)) return "archive"
  if (AUDIO_SET.has(ext)) return "audio"
  return "unknown"
}

/** @param {string} p */
export const isImage = (p) => getFileType(p) === "image"
/** @param {string} p */
export const isVideo = (p) => getFileType(p) === "video"
/** @param {string} p */
export const isArchive = (p) => getFileType(p) === "archive"
/** @param {string} p */
export const isAudio = (p) => getFileType(p) === "audio"
/** @param {string} p */
export const isFolder = (p) => getFileType(p) === "folder"
