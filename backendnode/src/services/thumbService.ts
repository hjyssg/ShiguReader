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
import { fileURLToPath } from "node:url";
import pLimit from "p-limit";
import { config } from "../config.js";
import { getFileType } from "../utils/fileType.js";
import { IMAGE_SUFFIXES } from "../constants.js";

const execFileAsync = promisify(execFile);

// Limit concurrent thumbnail generation to avoid HDD thrashing
const thumbLimit = pLimit(config.THUMB_CONCURRENCY);

// ── tool resolution ──────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// src/services/ → ../.. → backendnode/tools/
const TOOLS_DIR = path.resolve(__dirname, "../../tools");

function resolveTool(subpath: string, fallbackCmd: string): string {
  const bundled = path.join(TOOLS_DIR, subpath);
  if (fs.existsSync(bundled)) return bundled;
  // fallback: assume on PATH
  return fallbackCmd;
}

function get7z(): string {
  return resolveTool("7zip-lite/7z.exe", "7z");
}

function getFfmpeg(): string {
  return resolveTool("ffmpeg/ffmpeg.exe", "ffmpeg");
}

function getMagick(): string {
  return resolveTool("imagemagick/magick.exe", "magick");
}

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

async function listArchiveEntries(archivePath: string): Promise<string[]> {
  const { stdout } = await execFileAsync(get7z(), ["l", "-ba", "-slt", archivePath], {
    timeout: config.THUMB_TIMEOUT_SEC * 1000,
  });
  // parse "Path = ..." lines
  const entries: string[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const m = line.match(/^Path = (.+)$/);
    if (m) entries.push(m[1].trim());
  }
  return entries;
}

async function generateArchiveThumb(archivePath: string, outputPath: string): Promise<void> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shiguthumb-"));
  try {
    // Use wildcard extraction — avoids parsing 7z l output which has encoding issues
    // on Windows with non-ASCII filenames (Japanese etc.).
    // `7z e` extracts without directory structure (flat), `-y` auto-confirms.
    // We pass each image extension as a separate wildcard argument.
    const imageWildcards = [...IMAGE_EXTS].map(ext => `*${ext}`);
    await execFileAsync(
      get7z(),
      ["e", archivePath, `-o${tmpDir}`, "-y", "-r", ...imageWildcards],
      { timeout: config.THUMB_TIMEOUT_SEC * 1000 }
    );

    // Pick the first image file alphabetically from the flat tmpDir
    const extracted = findFirstImageInDir(tmpDir);
    if (!extracted) throw new Error(`No image found in archive after extraction to ${tmpDir}`);

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
