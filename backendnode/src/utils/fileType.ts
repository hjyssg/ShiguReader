import path from "node:path";
import {
  IMAGE_SUFFIXES,
  VIDEO_SUFFIXES,
  ARCHIVE_SUFFIXES,
  AUDIO_SUFFIXES,
  MIME_TYPE_MAP,
  type FileType,
} from "../constants.js";

export function getExt(filepath: string): string {
  return path.extname(filepath).toLowerCase();
}

export function getFileType(filepath: string): FileType {
  const ext = getExt(filepath);
  if ((IMAGE_SUFFIXES as readonly string[]).includes(ext)) {
    return "image";
  }
  if ((VIDEO_SUFFIXES as readonly string[]).includes(ext)) {
    return "video";
  }
  if ((ARCHIVE_SUFFIXES as readonly string[]).includes(ext)) {
    return "archive";
  }
  if ((AUDIO_SUFFIXES as readonly string[]).includes(ext)) {
    return "audio";
  }
  return "unknown";
}

export function isImage(filepath: string): boolean {
  return getFileType(filepath) === "image";
}

export function isVideo(filepath: string): boolean {
  return getFileType(filepath) === "video";
}

export function isArchive(filepath: string): boolean {
  return getFileType(filepath) === "archive";
}

export function isAudio(filepath: string): boolean {
  return getFileType(filepath) === "audio";
}

export function getMimeType(filepath: string): string {
  const ext = getExt(filepath);
  return MIME_TYPE_MAP[ext] ?? "application/octet-stream";
}

/** Returns true if the file should be shown in the explorer (image/archive/video/audio). */
export function isDisplayable(filepath: string): boolean {
  return getFileType(filepath) !== "unknown";
}

/** Fingerprint a file by its path + mtime + size (cheap, no hashing). */
export function makeFingerprint(filepath: string, mtime: number, size: number): string {
  return `${filepath}|${mtime}|${size}`;
}
