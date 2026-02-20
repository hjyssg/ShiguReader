export const IMAGE_SUFFIXES = [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".heic"] as const;
export const VIDEO_SUFFIXES = [".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv"] as const;
export const ARCHIVE_SUFFIXES = [".zip", ".cbz", ".rar", ".cbr", ".7z", ".tar", ".tar.gz", ".tgz"] as const;
export const AUDIO_SUFFIXES = [".mp3", ".flac", ".wav", ".aac", ".ogg", ".m4a"] as const;

export type FileType = "image" | "video" | "archive" | "audio" | "unknown";

export const MIME_TYPE_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".heic": "image/heic",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".mov": "video/quicktime",
  ".flv": "video/x-flv",
  ".wmv": "video/x-ms-wmv",
  ".mp3": "audio/mpeg",
  ".flac": "audio/flac",
  ".wav": "audio/wav",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
};
