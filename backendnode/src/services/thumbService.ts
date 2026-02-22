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
import { getFileType } from "../utils/fileType.js";
import { IMAGE_SUFFIXES } from "../constants.js";
import { get7z, getMagick, getFfmpeg } from "../utils/tools.js";

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

const IMAGE_EXTS = new Set(IMAGE_SUFFIXES as readonly string[]);

async function generateArchiveThumb(archivePath: string, outputPath: string): Promise<void> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shiguthumb-"));
  try {
    // Strategy: list entries first via `7z l -slt -scsUTF-8`, find the first image,
    // then extract only that single file using a temp list file (@listfile).
    // This avoids wildcard extraction (slow for large archives) and command-line
    // encoding issues with non-ASCII filenames on Windows.

    // Step 1: List entries
    const { stdout } = await execFileAsync(
      get7z(),
      ["l", "-ba", "-slt", "-scsUTF-8", archivePath],
      { timeout: config.THUMB_TIMEOUT_SEC * 1000, maxBuffer: 10 * 1024 * 1024 }
    );

    // Parse 7z -slt output to find the first image entry path
    let firstImageEntry: string | null = null;
    let currentPath: string | null = null;
    for (const line of stdout.split(/\r?\n/)) {
      const pathMatch = line.match(/^Path = (.+)$/);
      if (pathMatch) {
        currentPath = pathMatch[1].trim();
      } else if (line.trim() === "" && currentPath !== null) {
        const ext = path.extname(currentPath).toLowerCase();
        if (IMAGE_EXTS.has(ext)) {
          firstImageEntry = currentPath;
          break;
        }
        currentPath = null;
      }
    }
    // Handle last entry without trailing blank line
    if (!firstImageEntry && currentPath !== null) {
      const ext = path.extname(currentPath).toLowerCase();
      if (IMAGE_EXTS.has(ext)) firstImageEntry = currentPath;
    }

    if (!firstImageEntry) throw new Error(`No image found in archive: ${archivePath}`);

    // Step 2: Extract only that one file using a temp list file to avoid encoding issues
    const listFile = path.join(os.tmpdir(), `shiguthumb-list-${Date.now()}.txt`);
    try {
      fs.writeFileSync(listFile, firstImageEntry, "utf8");
      await execFileAsync(
        get7z(),
        ["x", archivePath, `-o${tmpDir}`, "-y", "-scsUTF-8", `@${listFile}`],
        { timeout: config.THUMB_TIMEOUT_SEC * 1000 }
      );
    } finally {
      try { fs.unlinkSync(listFile); } catch { /* ignore */ }
    }

    // Step 3: Find the extracted file (7z x preserves directory structure)
    const extracted = findFirstImageInDir(tmpDir);
    if (!extracted) throw new Error(`Extraction succeeded but image not found in ${tmpDir}`);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    await execFileAsync(
      getMagick(),
      [extracted, "-resize", `x${config.THUMB_HEIGHT}`, "-quality", String(config.THUMB_JPEG_QUALITY), outputPath],
      { timeout: config.THUMB_TIMEOUT_SEC * 1000 }
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function findFirstImageInDir(dir: string): string | null {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    // Sort for deterministic "first" selection
    const sorted = entries.slice().sort((a, b) => a.name.localeCompare(b.name));
    for (const e of sorted) {
      const full = path.join(dir, e.name);
      if (e.isFile() && IMAGE_EXTS.has(path.extname(e.name).toLowerCase())) return full;
      if (e.isDirectory()) {
        const found = findFirstImageInDir(full);
        if (found) return found;
      }
    }
  } catch { /* ignore */ }
  return null;
}

// ── video thumbnail ──────────────────────────────────────────────────────────

async function generateVideoThumb(videoPath: string, outputPath: string): Promise<void> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const timeout = config.THUMB_TIMEOUT_SEC * 1000;

  // try at 3s first, fallback to first frame
  const attempts = [
    ["-y", "-ss", "3", "-i", videoPath, "-frames:v", "1", outputPath],
    ["-y", "-i", videoPath, "-vf", "select=eq(n\\,0)", "-vframes", "1", outputPath],
  ];

  for (const args of attempts) {
    try {
      await execFileAsync(getFfmpeg(), args, { timeout });
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) return;
    } catch {
      // try next
    }
  }
  throw new Error("ffmpeg failed to generate video thumbnail");
}

// ── image thumbnail ──────────────────────────────────────────────────────────

async function generateImageThumb(imagePath: string, outputPath: string): Promise<void> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await execFileAsync(
    getMagick(),
    [imagePath, "-resize", `x${config.THUMB_HEIGHT}`, "-quality", String(config.THUMB_JPEG_QUALITY), outputPath],
    { timeout: config.THUMB_TIMEOUT_SEC * 1000 }
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
  if (await isCached(outputPath)) return outputPath;

  return thumbLimit(async () => {
    // Double-check after acquiring slot (another request may have just generated it)
    if (await isCached(outputPath)) return outputPath;

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
  const ext = path.extname(filePath).toLowerCase();
  const imageExts = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"]);
  if (imageExts.has(ext)) {
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
      return filePath;
    } catch {
      return null;
    }
  }
  return resolveCachedThumb(filePath);
}
