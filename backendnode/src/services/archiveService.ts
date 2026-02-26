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
import pLimit from "p-limit";
import { config } from "../config.js";
import { getFileType } from "../utils/fileType.js";
import { logger } from "../logger.js";
import { get7z, getMagick } from "../utils/tools.js";
import { isHiddenFile } from "../utils/fileFilters.js";

const execFileAsync = promisify(execFile);

// Limit concurrent archive extractions to avoid HDD thrashing
const extractLimit = pLimit(config.EXTRACT_CONCURRENCY);

// ── ignore rules ─────────────────────────────────────────────────────────────

const IGNORE_NAMES = new Set([".DS_Store", "Thumbs.db", "desktop.ini", ".gitkeep"]);
const IGNORE_PREFIXES = ["__MACOSX/", ".git/"];

function shouldIgnore(entryPath: string): boolean {
  const name = path.basename(entryPath);
  if (IGNORE_NAMES.has(name)) {
    return true;
  }
  if (isHiddenFile(name)) {
    return true;
  }
  for (const prefix of IGNORE_PREFIXES) {
    if (entryPath.startsWith(prefix) || entryPath.includes(`/${prefix}`)) {
      return true;
    }
  }
  return false;
}

// ── entry type detection ─────────────────────────────────────────────────────

export type EntryType = "image" | "video" | "audio" | "other";

export interface ArchiveEntry {
  name: string; // basename of entry
  entry_path: string; // full path inside archive
  index: number;
  file_type: EntryType;
  /** 文件大小（字节），7z -slt 解析得到，0 表示未知 */
  size: number;
  /** @deprecated use entry_path */
  path: string;
  /** @deprecated use file_type */
  type: EntryType;
}

function getEntryType(entryPath: string): EntryType {
  const t = getFileType(entryPath);
  if (t === "image") return "image";
  if (t === "video") return "video";
  if (t === "audio") return "audio";
  return "other";
}

// ── cache dir ────────────────────────────────────────────────────────────────

export function getExtractCacheDir(archivePath: string): string {
  const hash = crypto.createHash("sha256").update(archivePath).digest("hex").slice(0, 10);
  const base = path.resolve(config.EXTRACT_CACHE_DIR);
  return path.join(base, hash.slice(0, 2), hash.slice(2));
}

// ── list entries ─────────────────────────────────────────────────────────────

// In-memory cache for listEntries results (TTL: 60s)
const entriesCache = new Map<string, { entries: ArchiveEntry[]; expireAt: number }>();

/**
 * List all media entries in an archive, sorted, with index and file size.
 * Uses `7z l -ba -slt -scsUTF-8` to parse Path= and Size= lines per entry block.
 * Results are cached in memory for 60 seconds to avoid redundant 7z l calls.
 */
export async function listEntries(archivePath: string): Promise<ArchiveEntry[]> {
  const now = Date.now();
  const cached = entriesCache.get(archivePath);
  if (cached && cached.expireAt > now) {
    return cached.entries;
  }

  const { stdout } = await execFileAsync(get7z(), ["l", "-ba", "-slt", "-scsUTF-8", archivePath], {
    timeout: 30000,
    maxBuffer: 10 * 1024 * 1024,
  });

  // 7z -slt 输出每个 entry 的属性块，以空行分隔
  // 每块包含 Path = ... 和 Size = ... 等字段
  const rawEntries: { entryPath: string; size: number }[] = [];
  let currentPath: string | null = null;
  let currentSize = 0;

  for (const line of stdout.split(/\r?\n/)) {
    const pathMatch = line.match(/^Path = (.+)$/);
    const sizeMatch = line.match(/^Size = (\d+)$/);

    if (pathMatch) {
      // 新 entry 开始（Path 行总是在 Size 行之前）
      currentPath = pathMatch[1].trim();
      currentSize = 0;
    } else if (sizeMatch && currentPath !== null) {
      currentSize = parseInt(sizeMatch[1], 10);
    } else if (line.trim() === "" && currentPath !== null) {
      // 空行 = entry 块结束，提交
      rawEntries.push({ entryPath: currentPath, size: currentSize });
      currentPath = null;
      currentSize = 0;
    }
  }
  // 末尾没有空行时也提交最后一个 entry
  if (currentPath !== null) {
    rawEntries.push({ entryPath: currentPath, size: currentSize });
  }

  // Filter: keep only media files, skip ignored
  const mediaEntries = rawEntries.filter(({ entryPath }) => {
    if (shouldIgnore(entryPath)) {
      return false;
    }
    return getEntryType(entryPath) !== "other";
  });

  // Sort naturally by path
  mediaEntries.sort((a, b) =>
    a.entryPath.localeCompare(b.entryPath, undefined, { numeric: true, sensitivity: "base" }),
  );

  const result = mediaEntries.map(({ entryPath, size }, i) => {
    const t = getEntryType(entryPath);
    return {
      name: path.basename(entryPath),
      entry_path: entryPath,
      path: entryPath, // deprecated compat
      index: i,
      file_type: t,
      type: t, // deprecated compat
      size,
    };
  });

  entriesCache.set(archivePath, { entries: result, expireAt: Date.now() + 60_000 });
  return result;
}

/**
 * 计算 entries 中图片文件的平均大小（字节）。
 * 仅统计 size > 0 的条目，避免未解析到大小的条目拉低均值。
 * 返回 null 表示没有有效图片条目。
 */
export function calcAvgImageSize(entries: ArchiveEntry[]): number | null {
  const imageSizes = entries.filter((e) => e.file_type === "image" && e.size > 0).map((e) => e.size);
  if (!imageSizes.length) {
    return null;
  }
  return Math.round(imageSizes.reduce((a, b) => a + b, 0) / imageSizes.length);
}

// ── extract entries ──────────────────────────────────────────────────────────

/**
 * Extract specific entries from an archive to destDir.
 * Uses a temp list file to avoid command-line length limits and encoding issues.
 */
export async function extractEntries(archivePath: string, destDir: string, entries: string[]): Promise<void> {
  if (!entries.length) {
    return;
  }

  return extractLimit(async () => {
    fs.mkdirSync(destDir, { recursive: true });

    // Write entry list to a temp UTF-8 file
    const listFile = path.join(os.tmpdir(), `shigure-extract-${Date.now()}.txt`);
    try {
      fs.writeFileSync(listFile, entries.join("\n"), "utf8");
      await execFileAsync(get7z(), ["x", archivePath, `-o${destDir}`, "-aos", "-scsUTF-8", `@${listFile}`], {
        timeout: 120000,
        maxBuffer: 4 * 1024 * 1024,
      });
    } finally {
      try {
        fs.unlinkSync(listFile);
      } catch {
        /* ignore */
      }
    }
  });
}

// ── extract all ──────────────────────────────────────────────────────────────

/**
 * Extract the entire archive to destDir (fallback when stepwise fails).
 */
async function extractAll(archivePath: string, destDir: string): Promise<void> {
  return extractLimit(async () => {
    fs.mkdirSync(destDir, { recursive: true });
    await execFileAsync(get7z(), ["x", archivePath, `-o${destDir}`, "-aos", "-scsUTF-8"], {
      timeout: 3600000,
      maxBuffer: 64 * 1024 * 1024,
    });
  });
}

// ── stepwise extract ─────────────────────────────────────────────────────────

export interface StepwiseExtractResult {
  status: "started" | "already_running" | "completed";
  extracted_count: number;
  total_count: number;
  cache_dir: string;
  /** 压缩包内图片文件的平均大小（字节），用于前端展示 */
  avg_image_size: number | null;
  /** 压缩包内媒体文件列表，供前端直接使用，避免额外的 list 请求 */
  entries: ArchiveEntry[];
}

// Track in-progress extractions to avoid duplicate work
const inProgress = new Set<string>();

/**
 * Three-phase progressive extraction:
 *   Phase 1 (sync):  current page ± 2
 *   Phase 2 (async): ± 10 pages
 *   Phase 3 (async): remaining
 */
export async function stepwiseExtract(archivePath: string, currentPage: number): Promise<StepwiseExtractResult> {
  const cacheDir = getExtractCacheDir(archivePath);

  if (inProgress.has(archivePath)) {
    // Count already extracted; use cached entries if available (avoids extra 7z l)
    const extracted = countExtractedFiles(cacheDir);
    const cachedEntries = await listEntries(archivePath).catch(() => []);
    return {
      status: "already_running",
      extracted_count: extracted,
      total_count: cachedEntries.length,
      cache_dir: cacheDir,
      avg_image_size: calcAvgImageSize(cachedEntries),
      entries: cachedEntries,
    };
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
    return {
      status: "completed",
      extracted_count: 0,
      total_count: 0,
      cache_dir: cacheDir,
      avg_image_size: null,
      entries: [],
    };
  }

  // Phase 1: current page ± 2 (synchronous)
  const phase1Start = Math.max(0, currentPage - 2);
  const phase1End = Math.min(total - 1, currentPage + 2);
  const phase1Entries = entries.slice(phase1Start, phase1End + 1).filter((e) => !isAlreadyExtracted(cacheDir, e.path));

  inProgress.add(archivePath);
  try {
    await extractEntries(
      archivePath,
      cacheDir,
      phase1Entries.map((e) => e.path),
    );
  } catch {
    // Phase 1 stepwise failed → fallback to full extraction
    try {
      await extractAll(archivePath, cacheDir);
    } catch (e) {
      inProgress.delete(archivePath);
      throw e;
    }
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
        .filter((e) => !isAlreadyExtracted(cacheDir, e.path));
      if (phase2Entries.length) {
        await extractEntries(
          archivePath,
          cacheDir,
          phase2Entries.map((e) => e.path),
        );
      }

      // Phase 3: remaining (images first, then others)
      const remaining = entries.filter((e) => !isAlreadyExtracted(cacheDir, e.path));
      const images = remaining.filter((e) => e.type === "image");
      const others = remaining.filter((e) => e.type !== "image");
      const phase3Entries = [...images, ...others];
      if (phase3Entries.length) {
        await extractEntries(
          archivePath,
          cacheDir,
          phase3Entries.map((e) => e.path),
        );
      }
    } catch {
      // Phase 2/3 stepwise failed → fallback to full extraction
      try {
        await extractAll(archivePath, cacheDir);
      } catch {
        /* ignore */
      }
    } finally {
      inProgress.delete(archivePath);
    }
  });

  const avgImageSize = calcAvgImageSize(entries);
  return {
    status: "started",
    extracted_count: extracted,
    total_count: total,
    cache_dir: cacheDir,
    avg_image_size: avgImageSize,
    entries,
  };
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
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
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
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  // Only delete subdirectories (hash dirs), not the root itself
  try {
    const topDirs = fs.readdirSync(cacheBase, { withFileTypes: true });
    for (const d of topDirs) {
      if (!d.isDirectory()) {
        continue;
      }
      const fullDir = path.join(cacheBase, d.name);
      // Skip if currently being extracted
      if (inProgress.size > 0) {
        const activeDir = [...inProgress].some((ap) => getExtractCacheDir(ap).startsWith(fullDir));
        if (activeDir) {
          continue;
        }
      }
      countDir(fullDir);
      fs.rmSync(fullDir, { recursive: true, force: true });
    }
  } catch {
    /* ignore */
  }

  return {
    deleted_files: deletedFiles,
    freed_bytes: freedBytes,
    freed_size_readable: formatBytes(freedBytes),
  };
}

// ── compress images ───────────────────────────────────────────────────────────

export type CompressOutputMode = "new" | "replace";

export interface CompressArchiveImagesResult {
  processed: number;
  original_bytes: number;
  output_bytes: number;
  output_path: string;
  output_mode: CompressOutputMode;
  entries_matched: boolean;
  source_entry_count: number;
  output_entry_count: number;
  missing_entries: string[];
  extra_entries: string[];
}

/**
 * Compare entry path sets between two zip files.
 * Returns matched=true if both have identical entry path sets (order-insensitive).
 */
async function compareZipEntries(
  srcPath: string,
  outPath: string,
): Promise<{
  matched: boolean;
  sourceCount: number;
  outputCount: number;
  missing: string[];
  extra: string[];
}> {
  const [srcEntries, outEntries] = await Promise.all([
    listEntries(srcPath),
    listEntries(outPath),
  ]);
  const srcSet = new Set(srcEntries.map((e) => e.entry_path));
  const outSet = new Set(outEntries.map((e) => e.entry_path));
  const missing = [...srcSet].filter((p) => !outSet.has(p));
  const extra = [...outSet].filter((p) => !srcSet.has(p));
  return {
    matched: missing.length === 0 && extra.length === 0,
    sourceCount: srcSet.size,
    outputCount: outSet.size,
    missing,
    extra,
  };
}

/**
 * Extract zip → compress large images → repack.
 * Supports two output modes:
 *   "new"     — write to <name>_compressed.<ext> (default, non-destructive)
 *   "replace" — write to a temp file, verify, then atomically replace original
 */
export async function compressArchiveImages(
  archivePath: string,
  maxHeight = 1600,
  quality = 85,
  outputMode: CompressOutputMode = "new",
): Promise<CompressArchiveImagesResult> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shigure-compress-"));
  const newOutputPath = archivePath.replace(/(\.[^.]+)$/, "_compressed$1");
  const tmpOutputPath = archivePath.replace(/(\.[^.]+)$/, `_tmp_${Date.now()}$1`);
  const finalOutputPath = outputMode === "replace" ? tmpOutputPath : newOutputPath;

  logger.compress(`Start [${outputMode}]: ${path.basename(archivePath)} → ${path.basename(finalOutputPath)}`);

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
        } else if (e.isFile() && getFileType(e.name) === "image") {
          const stat = fs.statSync(full);
          originalBytes += stat.size;
          try {
            await execFileAsync(getMagick(), [full, "-resize", `x${maxHeight}>`, "-quality", String(quality), full], {
              timeout: 30000,
            });
            outputBytes += fs.statSync(full).size;
            processed++;
          } catch {
            outputBytes += stat.size; // unchanged
          }
        }
      }
    };

    await walkAndCompress(tmpDir);

    // Repack to finalOutputPath
    await execFileAsync(get7z(), ["a", "-tzip", finalOutputPath, path.join(tmpDir, "*"), "-y"], {
      timeout: 300000,
    });

    // Verify output zip integrity
    try {
      await execFileAsync(get7z(), ["t", finalOutputPath], { timeout: 60000 });
    } catch (e) {
      try { fs.unlinkSync(finalOutputPath); } catch { /* ignore */ }
      throw new Error(`Output zip integrity check failed: ${e}`);
    }

    // Compare entries between source and output
    const cmp = await compareZipEntries(archivePath, finalOutputPath);

    // For replace mode: atomically overwrite original only after all checks pass
    let resolvedOutputPath = finalOutputPath;
    if (outputMode === "replace") {
      if (!cmp.matched) {
        try { fs.unlinkSync(finalOutputPath); } catch { /* ignore */ }
        throw new Error(
          `Entry mismatch — aborting replace. Missing: [${cmp.missing.join(", ")}], Extra: [${cmp.extra.join(", ")}]`,
        );
      }
      fs.renameSync(finalOutputPath, archivePath);
      resolvedOutputPath = archivePath;
      // Invalidate listEntries cache for the replaced file
      entriesCache.delete(archivePath);
    }

    const savedBytes = originalBytes - outputBytes;
    logger.compress(
      `Done [${outputMode}]: ${path.basename(archivePath)} — ${processed} images, saved ${formatBytes(savedBytes > 0 ? savedBytes : 0)}, entries ${cmp.matched ? "matched" : "MISMATCH"}`,
    );

    return {
      processed,
      original_bytes: originalBytes,
      output_bytes: outputBytes,
      output_path: resolvedOutputPath,
      output_mode: outputMode,
      entries_matched: cmp.matched,
      source_entry_count: cmp.sourceCount,
      output_entry_count: cmp.outputCount,
      missing_entries: cmp.missing,
      extra_entries: cmp.extra,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    // Clean up temp output if it still exists (e.g. replace mode failed before rename)
    if (outputMode === "replace" && fs.existsSync(tmpOutputPath)) {
      try { fs.unlinkSync(tmpOutputPath); } catch { /* ignore */ }
    }
  }
}
