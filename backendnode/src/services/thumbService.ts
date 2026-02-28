/**
 * Thumbnail service — generates and caches thumbnails.
 * - Archives: 7z extract first image → imagemagick resize
 * - Videos:   ffmpeg frame capture
 * - Images:   imagemagick resize (or serve directly if small)
 *
 * Tool resolution order: bundled backend/tools/ → PATH
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import pLimit from "p-limit";
import { config } from "../config.js";
import { getFileType, isImage } from "../utils/fileType.js";
import { get7z, getMagick, getFfmpeg } from "../utils/tools.js";
import { fileExists } from "../utils/fsUtils.js";
import { listEntries } from "./archiveService.js";

const execFileAsync = promisify(execFile);

// Limit concurrent thumbnail generation to avoid HDD thrashing
const thumbLimit = pLimit(config.THUMB_CONCURRENCY);

// ── cache helpers ────────────────────────────────────────────────────────────

function thumbCacheDir(): string {
  return path.resolve(config.THUMB_CACHE_DIR);
}

export function getCachedThumbPath(filePath: string): string {
  const hash = crypto.createHash("md5").update(filePath).digest("hex");
  return path.join(thumbCacheDir(), `${hash}.jpg`);
}

async function isCached(p: string): Promise<boolean> {
  try {
    return (await fs.promises.stat(p)).size > 0;
  } catch {
    return false;
  }
}

// ── archive thumbnail ────────────────────────────────────────────────────────

async function generateArchiveThumb(archivePath: string, outputPath: string): Promise<void> {
  // Step 1: 复用 archiveService.listEntries() 获取已排序的图片条目，避免重复解析 7z 输出
  const entries = await listEntries(archivePath);
  const firstImageEntry = entries.find((e) => e.file_type === "image");
  if (!firstImageEntry) {
    return;
  }

  // Step 2: Extract only that one file using a temp list file to avoid encoding issues
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "shiguthumb-"));
  try {
    const listFile = path.join(os.tmpdir(), `shiguthumb-list-${Date.now()}.txt`);
    try {
      await fs.promises.writeFile(listFile, firstImageEntry.entry_path, "utf8");
      await execFileAsync(get7z(), ["x", archivePath, `-o${tmpDir}`, "-y", "-scsUTF-8", `@${listFile}`], {
        timeout: config.THUMB_TIMEOUT_SEC * 1000,
      });
    } finally {
      await fs.promises.unlink(listFile).catch(() => {});
    }

    // Step 3: Find the extracted file (7z x preserves directory structure)
    const extracted = await findFirstImageInDir(tmpDir);
    if (!extracted) {
      throw new Error(`Extraction succeeded but image not found in ${tmpDir}`);
    }

    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    await execFileAsync(
      getMagick(),
      [extracted, "-resize", `x${config.THUMB_HEIGHT}`, "-quality", String(config.THUMB_JPEG_QUALITY), outputPath],
      { timeout: config.THUMB_TIMEOUT_SEC * 1000 },
    );
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
}

async function findFirstImageInDir(dir: string): Promise<string | null> {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const sorted = entries.slice().sort((a, b) => a.name.localeCompare(b.name));
    for (const e of sorted) {
      const full = path.join(dir, e.name);
      if (e.isFile() && isImage(e.name)) {
        return full;
      }
      if (e.isDirectory()) {
        const found = await findFirstImageInDir(full);
        if (found) return found;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

// ── video thumbnail ──────────────────────────────────────────────────────────

async function generateVideoThumb(videoPath: string, outputPath: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  const timeout = config.THUMB_TIMEOUT_SEC * 1000;

  // try at 3s first, fallback to first frame
  const attempts = [
    ["-y", "-ss", "3", "-i", videoPath, "-frames:v", "1", outputPath],
    ["-y", "-i", videoPath, "-vf", "select=eq(n\\,0)", "-vframes", "1", outputPath],
  ];

  for (const args of attempts) {
    try {
      await execFileAsync(getFfmpeg(), args, { timeout });
      const stat = await fs.promises.stat(outputPath).catch(() => null);
      if (stat && stat.size > 0) {
        return;
      }
    } catch {
      // try next
    }
  }
  throw new Error("ffmpeg failed to generate video thumbnail");
}

// ── image thumbnail ──────────────────────────────────────────────────────────

async function generateImageThumb(imagePath: string, outputPath: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await execFileAsync(
    getMagick(),
    [imagePath, "-resize", `x${config.THUMB_HEIGHT}`, "-quality", String(config.THUMB_JPEG_QUALITY), outputPath],
    { timeout: config.THUMB_TIMEOUT_SEC * 1000 },
  );
}

// ── public API ───────────────────────────────────────────────────────────────

/**
 * Generate (if needed) and return the cached thumbnail path.
 * Returns null if generation fails or file type is unsupported.
 */
export async function getOrGenerateThumb(filePath: string): Promise<string | null> {
  const outputPath = getCachedThumbPath(filePath);
  // Fast path: already cached, no need to acquire the limiter
  if (await isCached(outputPath)) {
    return outputPath;
  }

  return thumbLimit(async () => {
    // Double-check after acquiring slot (another request may have just generated it)
    if (await isCached(outputPath)) {
      return outputPath;
    }

    const fileType = getFileType(filePath);
    try {
      if (fileType === "archive") {
        await generateArchiveThumb(filePath, outputPath);
      } else if (fileType === "video") {
        await generateVideoThumb(filePath, outputPath);
      } else if (fileType === "image") {
        await generateImageThumb(filePath, outputPath);
      } else {
        return null;
      }
    } catch (e) {
      console.error(`[thumb] Failed to generate thumbnail for ${filePath}:`, e);
      return null;
    }

    return (await isCached(outputPath)) ? outputPath : null;
  });
}

/** Returns cached thumb path if it exists, null otherwise. */
export async function resolveCachedThumb(filePath: string): Promise<string | null> {
  const p = getCachedThumbPath(filePath);
  return (await isCached(p)) ? p : null;
}

/**
 * For image files the file itself can be served directly as a thumbnail.
 * Prefer getOrGenerateThumb for new code.
 */
export async function resolveThumbSource(filePath: string): Promise<string | null> {
  if (isImage(filePath)) {
    return (await fileExists(filePath, fs.constants.R_OK)) ? filePath : null;
  }
  return resolveCachedThumb(filePath);
}
