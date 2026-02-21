import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import path from "node:path";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { getDb } from "../db/client.js";
import { IndexRepository } from "../db/repository.js";
import { getFileType, getMimeType } from "../utils/fileType.js";
import { config } from "../config.js";
import {
  listEntries,
  extractEntries,
  stepwiseExtract,
  getExtractCacheDir,
  clearExtractCache as svcClearExtractCache,
  compressArchiveImages,
} from "../services/archiveService.js";
import { getOrGenerateThumb } from "../services/thumbService.js";
import { parseName } from "../utils/nameParser.js";
import trash from "trash";
import { getDiskInfo } from "node-disk-info";
import { refreshAllRecScores } from "../services/recService.js";

const execFileAsync = promisify(execFile);

// Module-level __dirname for ESM (same pattern as thumbService)
const __filename = fileURLToPath(import.meta.url);
const __routeDir = path.dirname(__filename);
const _TOOLS_DIR = path.resolve(__routeDir, "../../tools");

async function get7zBin(): Promise<string> {
  const bundled = path.join(_TOOLS_DIR, "7zip-lite/7z.exe");
  try {
    await fs.promises.access(bundled);
    return bundled;
  } catch {
    return "7z";
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function parseRoots(): string[] {
  if (!config.FS_ROOTS) return [];
  return config.FS_ROOTS.split(",").map(r => r.trim()).filter(Boolean);
}

function buildThumbUrl(filePath: string): string {
  const encoded = encodeURIComponent(filePath);
  return `${config.API_V1_STR}/fs/thumb?path=${encoded}`;
}

function getRepo(): IndexRepository {
  return new IndexRepository(getDb());
}

// ─── types ───────────────────────────────────────────────────────────────────

interface FileSystemItem {
  name: string;
  path: string;
  item_type: "file" | "folder";
  file_type: string | null;
  filesize: number | null;
  mtime: number | null;
  thumbnail_url: string | null;
  image_count: number | null;
  video_count: number | null;
  audio_count: number | null;
  avg_image_size: number | null;
  recommendation_score: number;
  is_missing: number;
  last_read_at: number | null;
}

// ─── route handlers ──────────────────────────────────────────────────────────

async function getRoots(_req: FastifyRequest, reply: FastifyReply) {
  const roots = parseRoots();
  return reply.send(
    roots.map(r => ({ path: r, dirname: path.basename(r) || r }))
  );
}

async function getFavorite(_req: FastifyRequest, reply: FastifyReply) {
  const dir = config.FAVORITE_DIR.trim();
  if (!dir) return reply.send(null);
  try {
    const stat = await fs.promises.stat(dir);
    if (!stat.isDirectory()) return reply.send(null);
    return reply.send({ path: dir, dirname: path.basename(dir) || dir });
  } catch {
    return reply.send(null);
  }
}

async function getAlreadyRead(_req: FastifyRequest, reply: FastifyReply) {
  const dir = config.ALREADY_READ_DIR.trim();
  if (!dir) return reply.send(null);
  try {
    const stat = await fs.promises.stat(dir);
    if (!stat.isDirectory()) return reply.send(null);
    return reply.send({ path: dir, dirname: path.basename(dir) || dir });
  } catch {
    return reply.send(null);
  }
}

async function listDirectory(
  req: FastifyRequest<{ Querystring: { path: string; sort_by?: string; sort_order?: string; has_video?: string; has_audio?: string } }>,
  reply: FastifyReply
) {
  const { path: dirPath, sort_by = "name", sort_order = "asc", has_video, has_audio } = req.query;
  const filterHasVideo = has_video === "true";
  const filterHasAudio = has_audio === "true";
  if (!dirPath) return reply.status(400).send({ error: "path is required" });

  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(dirPath);
  } catch {
    return reply.status(404).send({ error: "Path not found" });
  }
  if (!stat.isDirectory()) return reply.status(400).send({ error: "Path is not a directory" });

  const items: FileSystemItem[] = [];

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    // Parallel stat for all entries
    const statResults = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        try {
          const entryStat = await fs.promises.stat(fullPath);
          return { entry, fullPath, entryStat };
        } catch {
          return null; // skip unreadable entries
        }
      })
    );
    for (const result of statResults) {
      if (!result) continue;
      const { entry, fullPath, entryStat } = result;
      if (entry.isDirectory()) {
        items.push({
          name: entry.name, path: fullPath, item_type: "folder",
          file_type: null, filesize: null, mtime: Math.floor(entryStat.mtimeMs / 1000),
          thumbnail_url: null, image_count: null, video_count: null, audio_count: null,
          avg_image_size: null, recommendation_score: 0, is_missing: 0, last_read_at: null,
        });
      } else if (entry.isFile()) {
        const fileType = getFileType(entry.name);
        items.push({
          name: entry.name, path: fullPath, item_type: "file",
          file_type: fileType, filesize: entryStat.size, mtime: Math.floor(entryStat.mtimeMs / 1000),
          thumbnail_url: ["archive", "video", "image"].includes(fileType) ? buildThumbUrl(fullPath) : null,
          image_count: null, video_count: null, audio_count: null,
          avg_image_size: null, recommendation_score: 0, is_missing: 0, last_read_at: null,
        });
      }
    }
  } catch (e) {
    return reply.status(500).send({ error: `Failed to list directory: ${e}` });
  }

  // Enrich from DB
  try {
    const repo = getRepo();
    const fileItems = items.filter(i => i.item_type === "file");

    const fileDataMap = repo.getFileDataByFolder(dirPath);
    const archivePaths = fileItems.filter(i => i.file_type === "archive").map(i => i.path);
    const archiveMetaMap = archivePaths.length
      ? repo.getArchiveMetasByFolder(dirPath)
      : new Map();

    for (const item of items) {
      if (item.item_type !== "file") continue;
      const fd = fileDataMap.get(item.path);
      if (fd) {
        item.recommendation_score = fd.rec_score;
        item.last_read_at = fd.last_read_at;
      }
      if (item.file_type === "archive") {
        const meta = archiveMetaMap.get(item.path);
        if (meta) {
          item.image_count = meta.image_file_num;
          item.video_count = meta.video_file_num;
          item.audio_count = meta.music_file_num;
        }
      }
    }

    // Background upsert (fire-and-forget)
    setImmediate(() => {
      try {
        const r = getRepo();
        r.upsertFolder({ filepath: dirPath, dirname: path.basename(dirPath) || dirPath });
        for (const item of items) {
          if (item.item_type === "file" && item.filesize !== null && item.mtime !== null) {
            r.upsertFile({
              filepath: item.path,
              folderpath: dirPath,
              filename: item.name,
              mtime: item.mtime,
              filesize: item.filesize,
              file_type: item.file_type ?? "unknown",
              ext: path.extname(item.name).toLowerCase() || null,
              fingerprint: makeFingerprint(item.path, item.mtime, item.filesize),
            });
            const parsed = parseName(item.name);
            r.saveParsedMetadata(item.path, {
              title: parsed.title ?? undefined,
              authors: parsed.authors,
              cosers: parsed.cosers,
              groupName: parsed.groupName ?? undefined,
              rawTags: parsed.rawTags,
              event: parsed.event ?? undefined,
              dateTag: parsed.dateTag ?? undefined,
              mediaType: parsed.mediaType ?? undefined,
            });
          }
        }
        r.recordFolderOpen(dirPath);
      } catch { /* ignore bg errors */ }
    });
  } catch { /* ignore DB errors, still return FS data */ }

  // Apply has_video / has_audio filters (only applies to archive files)
  let filteredItems = items;
  if (filterHasVideo) {
    filteredItems = filteredItems.filter(i => i.item_type !== "file" || i.file_type !== "archive" || (i.video_count !== null && i.video_count > 0));
  }
  if (filterHasAudio) {
    filteredItems = filteredItems.filter(i => i.item_type !== "file" || i.file_type !== "archive" || (i.audio_count !== null && i.audio_count > 0));
  }

  // Sort
  const folders = filteredItems.filter(i => i.item_type === "folder").sort((a, b) => a.name.localeCompare(b.name));
  const files = filteredItems.filter(i => i.item_type === "file");
  const rev = sort_order === "desc" ? -1 : 1;
  files.sort((a, b) => {
    if (sort_by === "mtime") return rev * ((a.mtime ?? 0) - (b.mtime ?? 0));
    if (sort_by === "recommendation") return rev * (a.recommendation_score - b.recommendation_score);
    if (sort_by === "type") return rev * ((a.file_type ?? "").localeCompare(b.file_type ?? ""));
    if (sort_by === "image_count") return rev * ((a.image_count ?? 0) - (b.image_count ?? 0));
    return rev * a.name.localeCompare(b.name);
  });

  return reply.send({ items: [...folders, ...files] });
}

async function getLibraryOverview(_req: FastifyRequest, reply: FastifyReply) {
  const repo = getRepo();
  return reply.send(repo.getLibraryOverview());
}

async function getRecentActivity(
  req: FastifyRequest<{ Querystring: { limit?: string; since_latest_startup?: string } }>,
  reply: FastifyReply
) {
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit ?? "200", 10) || 200));
  const sinceStartup = req.query.since_latest_startup !== "false";
  const repo = getRepo();
  const rows = sinceStartup
    ? repo.listActivityLogsSinceLatestStartup(limit)
    : repo.listActivityLogs(limit);
  return reply.send({
    items: rows.map(r => ({
      id: r.id,
      activity_type: r.activity_type,
      status: r.status,
      task_key: r.task_key,
      message: r.message,
      target_path: r.target_path,
      context: r.context_json ? JSON.parse(r.context_json) : null,
      created_at: r.created_at,
    })),
  });
}

async function getTopOpenedFolders(
  req: FastifyRequest<{ Querystring: { limit?: string } }>,
  reply: FastifyReply
) {
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit ?? "5", 10) || 5));
  const repo = getRepo();
  return reply.send({ folder_ids: repo.listTopOpenedFolderIds(limit) });
}

async function scanDirectory(
  req: FastifyRequest<{ Body: { path: string; recursive?: boolean } }>,
  reply: FastifyReply
) {
  const { path: dirPath, recursive = true } = req.body ?? {};
  if (!dirPath) return reply.status(400).send({ error: "path is required" });

  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(dirPath);
  } catch {
    return reply.status(404).send({ error: "Path not found" });
  }
  if (!stat.isDirectory()) return reply.status(400).send({ error: "Path is not a directory" });

  const startedAt = Math.floor(Date.now() / 1000);
  scanStatusMap.set(dirPath, {
    path: dirPath, status: "running", message: "Scan started",
    recursive, scanned_folders: 0, scanned_files: 0, parsed_files: 0,
    watcher_active: false, started_at: startedAt, finished_at: null,
  });

  // Fire-and-forget background scan (async)
  setImmediate(async () => {
    try {
      const repo = getRepo();
      let scannedFolders = 0;
      let scannedFiles = 0;
      const walk = async (dir: string, recurse: boolean) => {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        repo.upsertFolder({ filepath: dir, dirname: path.basename(dir) || dir });
        scannedFolders++;
        scanStatusMap.set(dirPath, { ...scanStatusMap.get(dirPath)!, scanned_folders: scannedFolders, scanned_files: scannedFiles });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          try {
            const s = await fs.promises.stat(full);
            if (entry.isDirectory() && recurse) {
              await walk(full, true);
            } else if (entry.isFile()) {
              repo.upsertFile({
                filepath: full,
                folderpath: dir,
                filename: entry.name,
                mtime: Math.floor(s.mtimeMs / 1000),
                filesize: s.size,
                file_type: getFileType(entry.name),
                ext: path.extname(entry.name).toLowerCase() || null,
                fingerprint: makeFingerprint(full, Math.floor(s.mtimeMs / 1000), s.size),
              });
              const parsed = parseName(entry.name);
              repo.saveParsedMetadata(full, {
                title: parsed.title ?? undefined,
                authors: parsed.authors,
                cosers: parsed.cosers,
                groupName: parsed.groupName ?? undefined,
                rawTags: parsed.rawTags,
                event: parsed.event ?? undefined,
                dateTag: parsed.dateTag ?? undefined,
                mediaType: parsed.mediaType ?? undefined,
              });
              scannedFiles++;
              scanStatusMap.set(dirPath, { ...scanStatusMap.get(dirPath)!, scanned_files: scannedFiles });
            }
          } catch { /* skip */ }
        }
      };
      await walk(dirPath, recursive);
      scanStatusMap.set(dirPath, { ...scanStatusMap.get(dirPath)!, status: "completed", message: `Scan completed: ${dirPath}`, finished_at: Math.floor(Date.now() / 1000) });
      repo.logActivity("scan", `Scan completed: ${dirPath}`, "completed", `scan:${dirPath}`, dirPath, { scanned_files: scannedFiles, scanned_folders: scannedFolders });
      // 扫描完成后异步重算 rec_score
      setImmediate(() => { try { refreshAllRecScores(); } catch { /* ignore */ } });
    } catch (e) {
      scanStatusMap.set(dirPath, { ...scanStatusMap.get(dirPath)!, status: "error", message: `Scan failed: ${dirPath}`, finished_at: Math.floor(Date.now() / 1000) });
      try {
        getRepo().logActivity("scan", `Scan failed: ${dirPath}`, "failed", `scan:${dirPath}`, dirPath);
      } catch { /* ignore */ }
    }
  });

  return reply.send({ status: "started", message: "Scan task started", path: dirPath });
}

// ─── drives (Windows) ────────────────────────────────────────────────────────

async function getDrives(_req: FastifyRequest, reply: FastifyReply) {
  try {
    const disks = await getDiskInfo();
    const drives = disks.map(d => {
      // On Windows, node-disk-info returns mounted as "C:" — normalize to "C:\"
      let mountPath = d.mounted;
      if (process.platform === "win32" && /^[A-Za-z]:$/.test(mountPath)) {
        mountPath = mountPath + "\\";
      }
      return {
        path: mountPath,
        dirname: d.filesystem || d.mounted,
      };
    });
    return reply.send(drives);
  } catch {
    return reply.send(process.platform !== "win32" ? [{ path: "/", dirname: "/" }] : []);
  }
}

// ─── file operations ─────────────────────────────────────────────────────────

async function moveFile(
  req: FastifyRequest<{ Body: { source_path: string; dest_path: string } }>,
  reply: FastifyReply
) {
  const { source_path, dest_path } = req.body ?? {};
  if (!source_path || !dest_path) return reply.status(400).send({ error: "source_path and dest_path are required" });
  try {
    await fs.promises.mkdir(path.dirname(dest_path), { recursive: true });
    await fs.promises.rename(source_path, dest_path);
    try { getRepo().logActivity("move", `Moved file: ${source_path} → ${dest_path}`, "completed", `move:${source_path}`, source_path); } catch { /* ignore */ }
    return reply.send({ status: "ok", message: "File moved", path: source_path, dest_path });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

async function moveFolder(
  req: FastifyRequest<{ Body: { source_path: string; dest_path: string } }>,
  reply: FastifyReply
) {
  const { source_path, dest_path } = req.body ?? {};
  if (!source_path || !dest_path) return reply.status(400).send({ error: "source_path and dest_path are required" });
  try {
    await fs.promises.mkdir(path.dirname(dest_path), { recursive: true });
    await fs.promises.rename(source_path, dest_path);
    try { getRepo().logActivity("move", `Moved folder: ${source_path} → ${dest_path}`, "completed", `move:${source_path}`, source_path); } catch { /* ignore */ }
    return reply.send({ status: "ok", message: "Folder moved", path: source_path, dest_path });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

async function deleteItem(
  req: FastifyRequest<{ Body: { path: string; permanently?: boolean } }>,
  reply: FastifyReply
) {
  const { path: itemPath, permanently = false } = req.body ?? {};
  if (!itemPath) return reply.status(400).send({ error: "path is required" });
  try {
    if (permanently) {
      await fs.promises.rm(itemPath, { recursive: true, force: true });
    } else {
      await trash(itemPath);
    }
    try { getRepo().logActivity("delete", `Deleted: ${itemPath}`, "completed", `delete:${itemPath}`, itemPath); } catch { /* ignore */ }
    return reply.send({ status: "ok", message: permanently ? "Permanently deleted" : "Moved to trash", path: itemPath });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

async function renameItem(
  req: FastifyRequest<{ Body: { path: string; new_name: string } }>,
  reply: FastifyReply
) {
  const { path: itemPath, new_name } = req.body ?? {};
  if (!itemPath || !new_name) return reply.status(400).send({ error: "path and new_name are required" });
  const newPath = path.join(path.dirname(itemPath), new_name);
  try {
    await fs.promises.rename(itemPath, newPath);
    try { getRepo().logActivity("rename", `Renamed: ${itemPath} → ${newPath}`, "completed", `rename:${itemPath}`, itemPath); } catch { /* ignore */ }
    return reply.send({ status: "ok", message: "Renamed", path: itemPath, dest_path: newPath });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

async function downloadFile(
  req: FastifyRequest<{ Querystring: { path: string } }>,
  reply: FastifyReply
) {
  const { path: filePath } = req.query;
  if (!filePath) return reply.status(400).send({ error: "path is required" });
  try {
    await fs.promises.access(filePath);
    const mime = getMimeType(filePath);
    const filename = path.basename(filePath);
    reply.header("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    return reply.type(mime).send(fs.createReadStream(filePath));
  } catch (e) {
    return reply.status(404).send({ error: "File not found" });
  }
}

async function serveFile(
  req: FastifyRequest<{ Querystring: { path: string } }>,
  reply: FastifyReply
) {
  const { path: filePath } = req.query;
  if (!filePath) return reply.status(400).send({ error: "path is required" });

  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(filePath);
  } catch {
    return reply.status(404).send({ error: "File not found" });
  }

  const mime = getMimeType(filePath);
  const fileSize = stat.size;
  const rangeHeader = (req.raw as { headers?: Record<string, string> }).headers?.range
    ?? (req.headers as Record<string, string | undefined>)["range"];

  if (rangeHeader) {
    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    if (!match) return reply.status(416).send({ error: "Invalid Range header" });

    const start = match[1] ? parseInt(match[1], 10) : 0;
    const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

    if (start > end || end >= fileSize) {
      reply.header("Content-Range", `bytes */${fileSize}`);
      return reply.status(416).send({ error: "Range Not Satisfiable" });
    }

    const chunkSize = end - start + 1;
    reply.status(206);
    reply.header("Content-Range", `bytes ${start}-${end}/${fileSize}`);
    reply.header("Accept-Ranges", "bytes");
    reply.header("Content-Length", chunkSize);
    return reply.type(mime).send(fs.createReadStream(filePath, { start, end }));
  }

  reply.header("Accept-Ranges", "bytes");
  reply.header("Content-Length", fileSize);
  return reply.type(mime).send(fs.createReadStream(filePath));
}

async function ensureDir(
  req: FastifyRequest<{ Body: { path: string } }>,
  reply: FastifyReply
) {
  const { path: dirPath } = req.body ?? {};
  if (!dirPath) return reply.status(400).send({ error: "path is required" });
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
    return reply.send({ status: "ok" });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

async function resolvePath(
  req: FastifyRequest<{ Querystring: { path: string } }>,
  reply: FastifyReply
) {
  const { path: p } = req.query;
  if (!p) return reply.status(400).send({ error: "path is required" });
  const resolved = path.resolve(p);
  try {
    const stat = await fs.promises.stat(resolved);
    return reply.send({ path: resolved, exists: true, is_dir: stat.isDirectory() });
  } catch {
    return reply.send({ path: resolved, exists: false, is_dir: false });
  }
}

// ─── archive handlers ─────────────────────────────────────────────────────────

async function listArchive(
  req: FastifyRequest<{ Querystring: { path: string } }>,
  reply: FastifyReply
) {
  const { path: archivePath } = req.query;
  if (!archivePath) return reply.status(400).send({ error: "path is required" });
  try {
    await fs.promises.access(archivePath);
  } catch {
    return reply.status(404).send({ error: "File not found" });
  }
  try {
    const entries = await listEntries(archivePath);
    return reply.send({ entries, total: entries.length });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

async function extractArchive(
  req: FastifyRequest<{ Querystring: { path: string; page?: string } }>,
  reply: FastifyReply
) {
  const { path: archivePath, page: pageStr = "0" } = req.query;
  const page = parseInt(pageStr, 10) || 0;
  if (!archivePath) return reply.status(400).send({ error: "path is required" });
  try {
    await fs.promises.access(archivePath);
  } catch {
    return reply.status(404).send({ error: "File not found" });
  }
  try {
    const result = await stepwiseExtract(archivePath, page);
    return reply.send(result);
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

async function getArchiveFile(
  req: FastifyRequest<{ Querystring: { path: string; entry: string } }>,
  reply: FastifyReply
) {
  const { path: archivePath, entry } = req.query;
  if (!archivePath || !entry) return reply.status(400).send({ error: "path and entry are required" });
  const cacheDir = getExtractCacheDir(archivePath);
  const filePath = path.join(cacheDir, entry);
  // Security: ensure resolved path is within cacheDir
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(cacheDir))) {
    return reply.status(400).send({ error: "Invalid entry path" });
  }
  try {
    await fs.promises.access(resolved);
    const mime = getMimeType(resolved);
    return reply.type(mime).send(fs.createReadStream(resolved));
  } catch {
    return reply.status(404).send({ error: "File not found in extract cache" });
  }
}

async function clearExtractCache(_req: FastifyRequest, reply: FastifyReply) {
  try {
    const result = svcClearExtractCache();
    try { getRepo().logActivity("cache_cleanup", "Extract cache cleared", "completed", "cache_cleanup"); } catch { /* ignore */ }
    return reply.send({ status: "ok", ...result });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

async function compressImages(
  req: FastifyRequest<{ Body: { archive_path: string; output_path?: string | null; max_width?: number | null; max_height?: number | null; quality?: number | null; min_size?: number | null } }>,
  reply: FastifyReply
) {
  const { archive_path, max_height = 1600, quality = 85 } = req.body ?? {};
  if (!archive_path) return reply.status(400).send({ error: "archive_path is required" });
  try {
    await fs.promises.access(archive_path);
  } catch {
    return reply.status(404).send({ error: "File not found" });
  }
  try {
    const result = await compressArchiveImages(archive_path, max_height ?? 1600, quality ?? 85);
    try { getRepo().logActivity("minify_zip_images", `Compressed images: ${archive_path}`, "completed", `minify:${archive_path}`, archive_path); } catch { /* ignore */ }
    return reply.send(result);
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

async function zipFolder(
  req: FastifyRequest<{ Body: { folder_path: string; output_path?: string | null } }>,
  reply: FastifyReply
) {
  const { folder_path, output_path } = req.body ?? {};
  if (!folder_path) return reply.status(400).send({ error: "folder_path is required" });
  try {
    const stat = await fs.promises.stat(folder_path);
    if (!stat.isDirectory()) return reply.status(400).send({ error: "folder_path is not a directory" });
  } catch {
    return reply.status(404).send({ error: "Folder not found" });
  }
  const outputZip = output_path ?? `${folder_path}.zip`;
  try { await fs.promises.access(outputZip); return reply.status(409).send({ error: "Output zip already exists", path: outputZip }); } catch { /* doesn't exist, proceed */ }
  try {
    await execFileAsync(get7zBin(), ["a", "-tzip", outputZip, folder_path + path.sep + "*", "-y"], {
      timeout: 300000,
    });
    return reply.send({ status: "ok", message: "Zip created", path: folder_path, dest_path: outputZip });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

async function unzip(
  req: FastifyRequest<{ Body: { archive_path: string; output_dir?: string | null } }>,
  reply: FastifyReply
) {
  const { archive_path, output_dir } = req.body ?? {};
  if (!archive_path) return reply.status(400).send({ error: "archive_path is required" });
  try {
    await fs.promises.access(archive_path);
  } catch {
    return reply.status(404).send({ error: "File not found" });
  }
  const outputDir = output_dir ?? path.join(
    path.dirname(archive_path),
    path.basename(archive_path, path.extname(archive_path))
  );
  try { await fs.promises.access(outputDir); return reply.status(409).send({ error: "Destination already exists", path: outputDir }); } catch { /* doesn't exist, proceed */ }
  try {
    await execFileAsync(get7zBin(), ["x", archive_path, `-o${outputDir}`, "-y", "-scsUTF-8"], {
      timeout: 300000,
    });
    return reply.send({ status: "ok", message: "Unzipped", path: archive_path, dest_path: outputDir });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

// ─── scan handlers ────────────────────────────────────────────────────────────

async function scanFavorite(_req: FastifyRequest, reply: FastifyReply) {
  const dir = config.FAVORITE_DIR.trim();
  if (!dir) return reply.send({ status: "started", message: "FAVORITE_DIR not configured", path: "" });
  return reply.send({ status: "started", message: "Scan started", path: dir });
}

async function backfill(
  req: FastifyRequest<{ Body: { path: string; recursive?: boolean; fill_thumbnail?: boolean; fill_meta?: boolean } }>,
  reply: FastifyReply
) {
  const { path: dirPath, fill_thumbnail = true, fill_meta = true } = req.body ?? {};
  if (!dirPath) return reply.status(400).send({ error: "path is required" });
  try {
    const stat = await fs.promises.stat(dirPath);
    if (!stat.isDirectory()) return reply.status(400).send({ error: "path is not a directory" });
  } catch {
    return reply.status(404).send({ error: "Directory not found" });
  }

  // async backfill — returns actual stats matching BackfillResponse
  let scannedFiles = 0;
  let backfilledThumbnails = 0;
  let backfilledMeta = 0;

  try {
    const repo = getRepo();
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const fullPath = path.join(dirPath, entry.name);
      const fileType = getFileType(entry.name);
      if (fileType === "unknown") continue;

      try {
        const s = await fs.promises.stat(fullPath);
        repo.upsertFile({
          filepath: fullPath,
          folderpath: dirPath,
          filename: entry.name,
          mtime: Math.floor(s.mtimeMs / 1000),
          filesize: s.size,
          file_type: fileType,
          ext: path.extname(entry.name).toLowerCase() || null,
          fingerprint: makeFingerprint(fullPath, Math.floor(s.mtimeMs / 1000), s.size),
        });
        scannedFiles++;

        if (fill_thumbnail && ["archive", "video", "image"].includes(fileType)) {
          getOrGenerateThumb(fullPath)
            .then(() => { backfilledThumbnails++; })
            .catch(() => { /* ignore thumb errors */ });
        }

        if (fill_meta) {
          const parsed = parseName(entry.name);
          repo.saveParsedMetadata(fullPath, {
            title: parsed.title ?? undefined,
            authors: parsed.authors,
            cosers: parsed.cosers,
            groupName: parsed.groupName ?? undefined,
            rawTags: parsed.rawTags,
            event: parsed.event ?? undefined,
            dateTag: parsed.dateTag ?? undefined,
            mediaType: parsed.mediaType ?? undefined,
          });
          backfilledMeta++;

          if (fileType === "archive") {
            try {
              const archiveEntries = await listEntries(fullPath);
              const imageNum = archiveEntries.filter(e => e.type === "image").length;
              const videoNum = archiveEntries.filter(e => e.type === "video").length;
              const audioNum = archiveEntries.filter(e => e.type === "audio").length;
              const ext = path.extname(entry.name).toLowerCase().slice(1);
              repo.upsertArchiveMeta(fullPath, ext, archiveEntries.length, imageNum, videoNum, audioNum);
            } catch { /* skip if archive listing fails */ }
          }
        }
      } catch { /* skip individual file errors */ }
    }
    repo.logActivity("backfill", `Backfill completed: ${dirPath}`, "completed", `backfill:${dirPath}`, dirPath);
  } catch (e) {
    try {
      getRepo().logActivity("backfill", `Backfill failed: ${dirPath}`, "failed", `backfill:${dirPath}`, dirPath);
    } catch { /* ignore */ }
  }

  return reply.send({
    status: "ok",
    scanned_files: scannedFiles,
    backfilled_thumbnails: backfilledThumbnails,
    backfilled_meta: backfilledMeta,
    message: `Backfill completed: ${scannedFiles} files scanned`,
  });
}

// Simple in-memory watcher registry
const activeWatchers = new Map<string, fs.FSWatcher>();

async function scanWatch(
  req: FastifyRequest<{ Body: { path: string; recursive?: boolean } }>,
  reply: FastifyReply
) {
  const { path: dirPath } = req.body ?? {};
  if (!dirPath) return reply.status(400).send({ error: "path is required" });
  try {
    const stat = await fs.promises.stat(dirPath);
    if (!stat.isDirectory()) return reply.status(400).send({ error: "path is not a directory" });
  } catch {
    return reply.status(404).send({ error: "Directory not found" });
  }

  if (activeWatchers.has(dirPath)) {
    return reply.send({ status: "already_watching", path: dirPath });
  }

  try {
    const watcher = fs.watch(dirPath, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      const fullPath = path.join(dirPath, filename);
      setImmediate(() => {
        try {
          const s = fs.statSync(fullPath);
          const repo = getRepo();
          repo.upsertFile({
            filepath: fullPath,
            folderpath: dirPath,
            filename: path.basename(fullPath),
            mtime: Math.floor(s.mtimeMs / 1000),
            filesize: s.size,
            file_type: getFileType(fullPath),
            ext: path.extname(fullPath).toLowerCase() || null,
            fingerprint: makeFingerprint(fullPath, Math.floor(s.mtimeMs / 1000), s.size),
            scan_state: 1,
          });
        } catch { /* file may have been deleted */ }
      });
    });
    activeWatchers.set(dirPath, watcher);
    return reply.send({ status: "started", message: "Watch started", path: dirPath });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

// In-memory scan status registry (populated by scanDirectory)
const scanStatusMap = new Map<string, {
  path: string;
  status: "running" | "completed" | "error";
  message: string | null;
  recursive: boolean;
  scanned_folders: number;
  scanned_files: number;
  parsed_files: number;
  watcher_active: boolean;
  started_at: number | null;
  finished_at: number | null;
}>();

async function getScanStatus(
  req: FastifyRequest<{ Querystring: { path?: string } }>,
  reply: FastifyReply
) {
  const filterPath = req.query.path;
  const watcherPaths = new Set(activeWatchers.keys());
  const entries = filterPath
    ? (scanStatusMap.has(filterPath) ? [scanStatusMap.get(filterPath)!] : [])
    : [...scanStatusMap.values()];

  // Also include active watchers not in scan map
  if (!filterPath) {
    for (const wp of watcherPaths) {
      if (!scanStatusMap.has(wp)) {
        entries.push({
          path: wp,
          status: "completed",
          message: null,
          recursive: true,
          scanned_folders: 0,
          scanned_files: 0,
          parsed_files: 0,
          watcher_active: true,
          started_at: null,
          finished_at: null,
        });
      }
    }
  }

  return reply.send(entries.map(e => ({
    ...e,
    watcher_active: watcherPaths.has(e.path),
  })));
}

async function syncFileTable(_req: FastifyRequest, reply: FastifyReply) {
  const taskKey = "db_sync:manual";
  try { getRepo().logActivity("db_sync", "File table sync started", "started", taskKey); } catch { /* ignore */ }

  setImmediate(async () => {
    const repo = getRepo();
    try {
      const roots = parseRoots();
      let syncedFiles = 0;
      for (const root of roots) {
        try {
          const walk = async (dir: string) => {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            repo.upsertFolder({ filepath: dir, dirname: path.basename(dir) || dir });
            for (const entry of entries) {
              const full = path.join(dir, entry.name);
              try {
                const s = await fs.promises.stat(full);
                if (entry.isDirectory()) {
                  await walk(full);
                } else if (entry.isFile()) {
                  repo.upsertFile({
                    filepath: full, folderpath: dir, filename: entry.name,
                    mtime: Math.floor(s.mtimeMs / 1000), filesize: s.size,
                    file_type: getFileType(entry.name),
                    ext: path.extname(entry.name).toLowerCase() || null,
                    fingerprint: makeFingerprint(full, Math.floor(s.mtimeMs / 1000), s.size),
                  });
                  syncedFiles++;
                }
              } catch { /* skip */ }
            }
          };
          await walk(root);
        } catch { /* skip root */ }
      }
      repo.logActivity("db_sync", `File table sync completed: ${syncedFiles} files`, "completed", taskKey, undefined, { synced_files: syncedFiles });
    } catch (e) {
      try { repo.logActivity("db_sync", `File table sync failed: ${e}`, "failed", taskKey); } catch { /* ignore */ }
    }
  });

  return reply.send({ status: "started", message: "File table sync started" });
}

// ─── plugin ──────────────────────────────────────────────────────────────────

export async function fsRoutes(app: FastifyInstance) {
  app.get("/roots", getRoots);
  app.get("/drives", getDrives);
  app.get("/favorite", getFavorite);
  app.get("/already-read", getAlreadyRead);
  app.get("/list", listDirectory);
  app.get("/library-overview", getLibraryOverview);
  app.get("/recent-activity", getRecentActivity);
  app.get("/top-opened-folders", getTopOpenedFolders);
  app.post("/scan", scanDirectory);
  app.post("/scan-favorite", scanFavorite);
  app.post("/backfill", backfill);
  app.post("/scan-watch", scanWatch);
  app.get("/scan-status", getScanStatus);
  app.post("/move-file", moveFile);
  app.post("/move-folder", moveFolder);
  app.delete("/delete", deleteItem);
  app.post("/rename", renameItem);
  app.get("/download", downloadFile);
  app.get("/file", serveFile);
  app.post("/ensure-dir", ensureDir);
  app.get("/resolve-path", resolvePath);
  app.post("/zip-folder", zipFolder);
  app.post("/unzip", unzip);
  app.get("/archive/list", listArchive);
  app.post("/archive/extract", extractArchive);
  app.get("/archive/file", getArchiveFile);
  app.delete("/extract-cache", clearExtractCache);
  app.post("/archive/compress-images", compressImages);
  app.post("/sync-file-table", syncFileTable);
}
