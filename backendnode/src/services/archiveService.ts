/**
 * Archive service — list, extract, and manage archive files.
 * Uses 7z CLI for all archive formats (zip/7z/rar/tar).
 * Tool resolution: bundled backend/tools/7zip-lite/7z.exe → PATH fallback.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { IMAGE_SUFFIXES, VIDEO_SUFFIXES, AUDIO_SUFFIXES } from "../constants.js";

const execFileAsync = promisify(execFile);

// ── tool resolution ──────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = path.resolve(__dirname, "../../../backend/tools");

function get7z(): string {
  const bundled = path.join(TOOLS_DIR, "7zip-lite/7z.exe");
  return fs.existsSync(bundled) ? bundled : "7z";
}

function getMagick(): string {
  const bundled = path.join(TOOLS_DIR, "imagemagick/magick.exe");
  return fs.existsSync(bundled) ? bundled : "magick";
}

// ── ignore rules ─────────────────────────────────────────────────────────────

const IGNORE_NAMES = new Set([".DS_Store", "Thumbs.db", "desktop.ini", ".gitkeep"]);
const IGNORE_PREFIXES = ["__MACOSX/", ".git/"];

function shouldIgnore(entryPath: string): boolean {
  const name = path.basename(entryPath);
  if (IGNORE_NAMES.has(name)) return true;
  if (name.startsWith(".")) return true;
  for (const prefix of IGNORE_PREFIXES) {
    if (entryPath.startsWith(prefix) || entryPath.includes("/" + prefix)) return true;
  }
  return false;
}

// ── entry type detection ─────────────────────────────────────────────────────

const IMAGE_EXTS = new Set(IMAGE_SUFFIXES as readonly string[]);
const VIDEO_EXTS = new Set(VIDEO_SUFFIXES as readonly string[]);
const AUDIO_EXTS = new Set(AUDIO_SUFFIXES as readonly string[]);

export type EntryType = "image" | "video" | "audio" | "other";

export interface ArchiveEntry {
  path: string;       // path inside archive
  index: number;
  type: EntryType;
}

function getEntryType(entryPath: string): EntryType {
  const ext = path.extname(entryPath).toLowerCase();
  if (IMAGE_EXTS.has(ext)) return "image";
  if (VIDEO_EXTS.has(ext)) return "video";
  if (AUDIO_EXTS.has(ext)) return "audio";
  return "other";
}

// ── cache dir ────────────────────────────────────────────────────────────────

export function getExtractCacheDir(archivePath: string): string {
  const hash = crypto.createHash("sha256").update(archivePath).digest("hex");
  const base = path.resolve(config.EXTRACT_CACHE_DIR);
  return path.join(base, hash.slice(0, 2), hash.slice(2));
}

// ── list entries ─────────────────────────────────────────────────────────────

/**
 * List all media entries in an archive, sorted, with index.
 * Uses `7z l -ba -slt -scsUTF-8` to parse Path= lines.
 */
export async function listEntries(archivePath: string): Promise<ArchiveEntry[]> {
  const { stdout } = await execFileAsync(
    get7z(),
    ["l", "-ba", "-slt", "-scsUTF-8", archivePath],
    { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
  );

  const rawPaths: string[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const m = line.match(/^Path = (.+)$/);
    if (m) rawPaths.push(m[1].trim());
  }

  // Filter: keep only media files, skip ignored
  const mediaEntries = rawPaths.filter(p => {
    if (shouldIgnore(p)) return false;
    const type = getEntryType(p);
    return type !== "other";
  });

  // Sort naturally
  mediaEntries.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

  return mediaEntries.map((p, i) => ({
    path: p,
    index: i,
    type: getEntryType(p),
  }));
}

// ── extract entries ──────────────────────────────────────────────────────────

/**
 * Extract specific entries from an archive to destDir.
 * Uses a temp list file to avoid command-line length limits and encoding issues.
 */
export async function extractEntries(
  archivePath: string,
  destDir: string,
  entries: string[]
): Promise<void> {
  if (!entries.length) return;
  fs.mkdirSync(destDir, { recursive: true });

  // Write entry list to a temp UTF-8 file
  const listFile = path.join(os.tmpdir(), `shigure-extract-${Date.now()}.txt`);
  try {
    fs.writeFileSync(listFile, entries.join("\n"), "utf8");
    await execFileAsync(
      get7z(),
      ["x", archivePath, `-o${destDir}`, "-y", "-scsUTF-8", `@${listFile}`],
      { timeout: 120000, maxBuffer: 4 * 1024 * 1024 }
    );
  } finally {
    try { fs.unlinkSync(listFile); } catch { /* ignore */ }
  }
}

// ── stepwise extract ─────────────────────────────────────────────────────────

export interface StepwiseExtractResult {
  status: "started" | "already_running" | "completed";
  extracted_count: number;
  total_count: number;
  cache_dir: string;
}

// Track in-progress extractions to avoid duplicate work
const inProgress = new Set<string>();

/**
 * Three-phase progressive extraction:
 *   Phase 1 (sync):  current page ± 2
 *   Phase 2 (async): ± 10 pages
 *   Phase 3 (async): remaining
 */
export async function stepwiseExtract(
  archivePath: string,
  currentPage: number
): Promise<StepwiseExtractResult> {
  const cacheDir = getExtractCacheDir(archivePath);

  if (inProgress.has(archivePath)) {
    // Count already extracted
    const extracted = countExtractedFiles(cacheDir);
    return { status: "already_running", extracted_count: extracted, total_count: 0, cache_dir: cacheDir };
  }

  // Get full entry list
  let entries: ArchiveEntry[];
  try {
    entries = await listEntries(archivePath);
  } catch (e) {
    throw new Error(`Failed to list archive entries: ${e}`);
  }

  const total = entries.length;
  if (total === 0) {
    return { status: "completed", extracted_count: 0, total_count: 0, cache_dir: cacheDir };
  }

  // Phase 1: current page ± 2 (synchronous)
  const phase1Start = Math.max(0, currentPage - 2);
  const phase1End = Math.min(total - 1, currentPage + 2);
  const phase1Entries = entries.slice(phase1Start, phase1End + 1);

  inProgress.add(archivePath);
  try {
    await extractEntries(archivePath, cacheDir, phase1Entries.map(e => e.path));
  } catch (e) {
    inProgress.delete(archivePath);
    throw e;
  }

  const extracted = countExtractedFiles(cacheDir);

  // Phase 2 & 3: background
  setImmediate(async () => {
    try {
      // Phase 2: ± 10 pages
      const phase2Start = Math.max(0, currentPage - 10);
      const phase2End = Math.min(total - 1, currentPage + 10);
      const phase2Entries = entries
        .slice(phase2Start, phase2End + 1)
        .filter(e => !isAlreadyExtracted(cacheDir, e.path));
      if (phase2Entries.length) {
        await extractEntries(archivePath, cacheDir, phase2Entries.map(e => e.path));
      }

      // Phase 3: remaining (images first, then others)
      const remaining = entries.filter(e => !isAlreadyExtracted(cacheDir, e.path));
      const images = remaining.filter(e => e.type === "image");
      const others = remaining.filter(e => e.type !== "image");
      const phase3Entries = [...images, ...others];
      if (phase3Entries.length) {
        await extractEntries(archivePath, cacheDir, phase3Entries.map(e => e.path));
      }
    } catch { /* background errors are non-fatal */ }
    finally {
      inProgress.delete(archivePath);
    }
  });

  return { status: "started", extracted_count: extracted, total_count: total, cache_dir: cacheDir };
}

function countExtractedFiles(dir: string): number {
  try {
    return fs.readdirSync(dir, { recursive: true }).length;
  } catch {
    return 0;
  }
}

function isAlreadyExtracted(cacheDir: string, entryPath: string): boolean {
  // 7z x preserves directory structure
  return fs.existsSync(path.join(cacheDir, entryPath));
}

// ── clear extract cache ───────────────────────────────────────────────────────

export interface ClearCacheResult {
  deleted_files: number;
  freed_bytes: number;
  freed_size_readable: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function clearExtractCache(): ClearCacheResult {
  const cacheBase = path.resolve(config.EXTRACT_CACHE_DIR);
  let deletedFiles = 0;
  let freedBytes = 0;

  if (!fs.existsSync(cacheBase)) {
    return { deleted_files: 0, freed_bytes: 0, freed_size_readable: "0 B" };
  }

  // Walk and count before deleting
  function countDir(dir: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          countDir(full);
        } else if (e.isFile()) {
          try {
            freedBytes += fs.statSync(full).size;
            deletedFiles++;
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }

  // Only delete subdirectories (hash dirs), not the root itself
  try {
    const topDirs = fs.readdirSync(cacheBase, { withFileTypes: true });
    for (const d of topDirs) {
      if (!d.isDirectory()) continue;
      const fullDir = path.join(cacheBase, d.name);
      // Skip if currently being extracted
      if (inProgress.size > 0) {
        const activeDir = [...inProgress].some(ap => getExtractCacheDir(ap).startsWith(fullDir));
        if (activeDir) continue;
      }
      countDir(fullDir);
      fs.rmSync(fullDir, { recursive: true, force: true });
    }
  } catch { /* ignore */ }

  return {
    deleted_files: deletedFiles,
    freed_bytes: freedBytes,
    freed_size_readable: formatBytes(freedBytes),
  };
}

// ── compress images ───────────────────────────────────────────────────────────

/**
 * Extract zip → compress large images → repack.
 * Low priority feature.
 */
export async function compressArchiveImages(
  archivePath: string,
  maxHeight = 1600,
  quality = 85
): Promise<{ processed: number; original_bytes: number; output_bytes: number }> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shigure-compress-"));
  const outputPath = archivePath.replace(/(\.[^.]+)$/, "_compressed$1");

  try {
    // Extract all
    await execFileAsync(get7z(), ["x", archivePath, `-o${tmpDir}`, "-y", "-scsUTF-8"], {
      timeout: 300000,
    });

    // Find and compress images
    let processed = 0;
    let originalBytes = 0;
    let outputBytes = 0;

    const walkAndCompress = async (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          await walkAndCompress(full);
        } else if (e.isFile() && IMAGE_EXTS.has(path.extname(e.name).toLowerCase())) {
          const stat = fs.statSync(full);
          originalBytes += stat.size;
          try {
            await execFileAsync(
              getMagick(),
              [full, "-resize", `x${maxHeight}>`, "-quality", String(quality), full],
              { timeout: 30000 }
            );
            outputBytes += fs.statSync(full).size;
            processed++;
          } catch {
            outputBytes += stat.size; // unchanged
          }
        }
      }
    };

    await walkAndCompress(tmpDir);

    // Repack
    await execFileAsync(get7z(), ["a", "-tzip", outputPath, path.join(tmpDir, "*"), "-y"], {
      timeout: 300000,
    });

    // Verify output zip integrity
    try {
      await execFileAsync(get7z(), ["t", outputPath], { timeout: 60000 });
    } catch (e) {
      // Verification failed — remove corrupt output
      try { fs.unlinkSync(outputPath); } catch { /* ignore */ }
      throw new Error(`Output zip integrity check failed: ${e}`);
    }

    return { processed, original_bytes: originalBytes, output_bytes: outputBytes };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
