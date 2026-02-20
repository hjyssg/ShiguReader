/**
 * Thumbnail service — serves existing thumbnails from thumb_cache.
 * Actual thumbnail generation (sharp / ffmpeg) is out of scope for the
 * minimal runnable backend; this module just resolves cached paths and
 * streams the file if it exists.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "../config.js";

function thumbCacheDir(): string {
  return path.resolve(config.THUMB_CACHE_DIR);
}

/** Derive the cached thumbnail path for a given source file path. */
export function getCachedThumbPath(filePath: string): string {
  const hash = crypto.createHash("md5").update(filePath).digest("hex");
  return path.join(thumbCacheDir(), `${hash}.jpg`);
}

/** Returns the cached thumb path if it exists on disk, otherwise null. */
export function resolveCachedThumb(filePath: string): string | null {
  const p = getCachedThumbPath(filePath);
  try {
    fs.accessSync(p, fs.constants.R_OK);
    return p;
  } catch {
    return null;
  }
}

/**
 * For image files: the file itself can be served directly as a thumbnail.
 * Returns the source path for images, cached thumb for archives/videos, null otherwise.
 */
export function resolveThumbSource(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  const imageExts = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"]);
  if (imageExts.has(ext)) {
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
      return filePath;
    } catch {
      return null;
    }
  }
  return resolveCachedThumb(filePath);
}
