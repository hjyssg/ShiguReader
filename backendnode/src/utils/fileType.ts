/**
 * 文件类型判断工具 — 从 common 层 re-export，后端专用部分在此扩展
 */
import path from "node:path"
import { getFileType as _getFileType } from "../../../common/src/fileTypeUtil.js"
import { MIME_TYPE_MAP } from "../constants.js"

export {
  getFileType,
  isImage,
  isVideo,
  isArchive,
  isAudio,
  isFolder,
  IMAGE_SUFFIXES,
  VIDEO_SUFFIXES,
  ARCHIVE_SUFFIXES,
  AUDIO_SUFFIXES,
} from "../../../common/src/fileTypeUtil.js"

export type FileType = "image" | "video" | "archive" | "audio" | "folder" | "unknown"

export function getExt(filepath: string): string {
  return path.extname(filepath).toLowerCase()
}

export function getMimeType(filepath: string): string {
  const ext = getExt(filepath)
  return MIME_TYPE_MAP[ext] ?? "application/octet-stream"
}

/** Returns true if the file should be shown in the explorer (image/archive/video/audio). */
export function isDisplayable(filepath: string): boolean {
  const t = _getFileType(filepath)
  return t !== "unknown" && t !== "folder"
}

/** Fingerprint a file by its path + mtime + size (cheap, no hashing). */
export function makeFingerprint(filepath: string, mtime: number, size: number): string {
  return `${filepath}|${mtime}|${size}`
}
