import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import path from "node:path";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { getDb } from "../db/client.js";
import { IndexRepository } from "../db/repository.js";
import { getFileType, getMimeType, makeFingerprint } from "../utils/fileType.js";
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

const execFileAsync = promisify(execFile);

// Module-level __dirname for ESM (same pattern as thumbService)
const __filename = fileURLToPath(import.meta.url);
const __routeDir = path.dirname(__filename);
const _TOOLS_DIR = path.resolve(__routeDir, "../../tools");

function get7zBin(): string {
  const bundled = path.join(_TOOLS_DIR, "7zip-lite/7z.exe");
  return fs.existsSync(bundled) ? bundled : "7z";
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
  recommendation_score: number;
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
    const stat = fs.statSync(dir);
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
    const stat = fs.statSync(dir);
    if (!stat.isDirectory()) return reply.send(null);
    return reply.send({ path: dir, dirname: path.basename(dir) || dir });
  } catch {
    return reply.send(null);
  }
}

async function listDirectory(
  req: FastifyRequest<{ Querystring: { path: string; sort_by?: string; sort_order?: string } }>,
  reply: FastifyReply
) {
  const { path: dirPath, sort_by = "name", sort_order = "asc" } = req.query;
  if (!dirPath) return reply.status(400).send({ error: "path is required" });

  let stat: fs.Stats;
  try {
    stat = fs.statSync(dirPath);
  } catch {
    return reply.status(404).send({ error: "Path not found" });
  }
  if (!stat.isDirectory()) return reply.status(400).send({ error: "Path is not a directory" });

  const items: FileSystemItem[] = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        const entryStat = fs.statSync(fullPath);
        if (entry.isDirectory()) {
          items.push({
            name: entry.name,
            path: fullPath,
            item_type: "folder",
            file_type: null,
            filesize: null,
            mtime: Math.floor(entryStat.mtimeMs / 1000),
            thumbnail_url: null,
            image_count: null,
            video_count: null,
            audio_count: null,
            recommendation_score: 0,
            last_read_at: null,
          });
        } else if (entry.isFile()) {
          const fileType = getFileType(entry.name);
          const thumbUrl = ["archive", "video", "image"].includes(fileType)
            ? buildThumbUrl(fullPath)
            : null;
          items.push({
            name: entry.name,
            path: fullPath,
            item_type: "file",
            file_type: fileType,
            filesize: entryStat.size,
            mtime: Math.floor(entryStat.mtimeMs / 1000),
            thumbnail_url: thumbUrl,
            image_count: null,
            video_count: null,
            audio_count: null,
            recommendation_score: 0,
            last_read_at: null,
          });
        }
      } catch {
        // skip unreadable entries
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
          }
        }
        r.recordFolderOpen(dirPath);
      } catch { /* ignore bg errors */ }
    });
  } catch { /* ignore DB errors, still return FS data */ }

  // Sort
  const folders = items.filter(i => i.item_type === "folder").sort((a, b) => a.name.localeCompare(b.name));
  const files = items.filter(i => i.item_type === "file");
  const rev = sort_order === "desc" ? -1 : 1;
  files.sort((a, b) => {
    if (sort_by === "mtime") return rev * ((a.mtime ?? 0) - (b.mtime ?? 0));
    if (sort_by === "recommendation") return rev * (a.recommendation_score - b.recommendation_score);
    return rev * a.name.localeCompare(b.name);
  });

  return reply.send({ items: [...folders, ...files] });
}

async function getLibraryOverview(_req: FastifyRequest, reply: FastifyReply) {
  const repo = getRepo();
  return reply.send({
    archives: repo.countFilesByType("archive"),
    videos: repo.countFilesByType("video"),
    images: repo.countFilesByType("image"),
    audio: repo.countFilesByType("audio"),
    folders: repo.countFolders(),
  });
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
    stat = fs.statSync(dirPath);
  } catch {
    return reply.status(404).send({ error: "Path not found" });
  }
  if (!stat.isDirectory()) return reply.status(400).send({ error: "Path is not a directory" });

  // Fire-and-forget background scan
  setImmediate(() => {
    try {
      const repo = getRepo();
      const walk = (dir: string, recurse: boolean) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        repo.upsertFolder({ filepath: dir, dirname: path.basename(dir) || dir, scanned: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          try {
            const s = fs.statSync(full);
            if (entry.isDirectory() && recurse) {
              walk(full, true);
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
                scan_state: 1,
              });
            }
          } catch { /* skip */ }
        }
      };
      walk(dirPath, recursive);
      repo.logActivity("scan", `Scan completed: ${dirPath}`, "completed", `scan:${dirPath}`, dirPath);
    } catch (e) {
      try {
        getRepo().logActivity("scan", `Scan failed: ${dirPath}`, "failed", `scan:${dirPath}`, dirPath);
      } catch { /* ignore */ }
    }
  });

  return reply.send({ status: "started", message: "Scan task started", path: dirPath });
}

// ─── drives (Windows) ────────────────────────────────────────────────────────

async function getDrives(_req: FastifyRequest, reply: FastifyReply) {
  // On Windows, try A-Z; on other OS return root
  const drives: { path: string; label: string }[] = [];
  if (process.platform === "win32") {
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i);
      const drivePath = `${letter}:\\`;
      try {
        fs.accessSync(drivePath);
        drives.push({ path: drivePath, label: `${letter}:` });
      } catch { /* not available */ }
    }
  } else {
    drives.push({ path: "/", label: "/" });
  }
  return reply.send({ drives });
}

// ─── file operations ─────────────────────────────────────────────────────────

async function moveFile(
  req: FastifyRequest<{ Body: { src: string; dst: string } }>,
  reply: FastifyReply
) {
  const { src, dst } = req.body ?? {};
  if (!src || !dst) return reply.status(400).send({ error: "src and dst are required" });
  try {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.renameSync(src, dst);
    return reply.send({ status: "ok" });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

async function moveFolder(
  req: FastifyRequest<{ Body: { src: string; dst: string } }>,
  reply: FastifyReply
) {
  const { src, dst } = req.body ?? {};
  if (!src || !dst) return reply.status(400).send({ error: "src and dst are required" });
  try {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.renameSync(src, dst);
    return reply.send({ status: "ok" });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

async function deleteItem(
  req: FastifyRequest<{ Body: { path: string } }>,
  reply: FastifyReply
) {
  const { path: itemPath } = req.body ?? {};
  if (!itemPath) return reply.status(400).send({ error: "path is required" });
  try {
    fs.rmSync(itemPath, { recursive: true, force: true });
    return reply.send({ status: "ok" });
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
    fs.renameSync(itemPath, newPath);
    return reply.send({ status: "ok", new_path: newPath });
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
    fs.accessSync(filePath);
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
  try {
    fs.accessSync(filePath);
    const mime = getMimeType(filePath);
    return reply.type(mime).send(fs.createReadStream(filePath));
  } catch {
    return reply.status(404).send({ error: "File not found" });
  }
}

async function ensureDir(
  req: FastifyRequest<{ Body: { path: string } }>,
  reply: FastifyReply
) {
  const { path: dirPath } = req.body ?? {};
  if (!dirPath) return reply.status(400).send({ error: "path is required" });
  try {
    fs.mkdirSync(dirPath, { recursive: true });
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
    const stat = fs.statSync(resolved);
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
    fs.accessSync(archivePath);
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
    fs.accessSync(archivePath);
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
    fs.accessSync(resolved);
    const mime = getMimeType(resolved);
    return reply.type(mime).send(fs.createReadStream(resolved));
  } catch {
    return reply.status(404).send({ error: "File not found in extract cache" });
  }
}

async function clearExtractCache(_req: FastifyRequest, reply: FastifyReply) {
  try {
    const result = svcClearExtractCache();
    return reply.send({ status: "ok", ...result });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

async function compressImages(
  req: FastifyRequest<{ Body: { path: string; max_height?: number; quality?: number } }>,
  reply: FastifyReply
) {
  const { path: archivePath, max_height = 1600, quality = 85 } = req.body ?? {};
  if (!archivePath) return reply.status(400).send({ error: "path is required" });
  try {
    fs.accessSync(archivePath);
  } catch {
    return reply.status(404).send({ error: "File not found" });
  }
  try {
    const result = await compressArchiveImages(archivePath, max_height, quality);
    return reply.send({ status: "ok", ...result });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

async function zipFolder(
  req: FastifyRequest<{ Body: { path: string; dest?: string } }>,
  reply: FastifyReply
) {
  const { path: folderPath, dest } = req.body ?? {};
  if (!folderPath) return reply.status(400).send({ error: "path is required" });
  try {
    const stat = fs.statSync(folderPath);
    if (!stat.isDirectory()) return reply.status(400).send({ error: "path is not a directory" });
  } catch {
    return reply.status(404).send({ error: "Folder not found" });
  }
  const outputZip = dest ?? `${folderPath}.zip`;
  if (fs.existsSync(outputZip)) {
    return reply.status(409).send({ error: "Output zip already exists", path: outputZip });
  }
  try {
    // 7z a <output.zip> <folder>/* -y
    await execFileAsync(get7zBin(), ["a", "-tzip", outputZip, folderPath + path.sep + "*", "-y"], {
      timeout: 300000,
    });
    return reply.send({ status: "ok", output: outputZip });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

async function unzip(
  req: FastifyRequest<{ Body: { path: string; dest?: string } }>,
  reply: FastifyReply
) {
  const { path: archivePath, dest } = req.body ?? {};
  if (!archivePath) return reply.status(400).send({ error: "path is required" });
  try {
    fs.accessSync(archivePath);
  } catch {
    return reply.status(404).send({ error: "File not found" });
  }
  // Default dest: same-name directory next to archive
  const outputDir = dest ?? path.join(
    path.dirname(archivePath),
    path.basename(archivePath, path.extname(archivePath))
  );
  if (fs.existsSync(outputDir)) {
    return reply.status(409).send({ error: "Destination already exists", path: outputDir });
  }
  try {
    await execFileAsync(get7zBin(), ["x", archivePath, `-o${outputDir}`, "-y", "-scsUTF-8"], {
      timeout: 300000,
    });
    return reply.send({ status: "ok", output: outputDir });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

// ─── scan handlers ────────────────────────────────────────────────────────────

async function scanFavorite(_req: FastifyRequest, reply: FastifyReply) {
  const dir = config.FAVORITE_DIR.trim();
  if (!dir) return reply.send({ status: "skipped", message: "FAVORITE_DIR not configured" });
  return reply.send({ status: "started", path: dir });
}

async function backfill(
  req: FastifyRequest<{ Body: { path: string; fill_thumbnail?: boolean; fill_meta?: boolean } }>,
  reply: FastifyReply
) {
  const { path: dirPath, fill_thumbnail = true, fill_meta = true } = req.body ?? {};
  if (!dirPath) return reply.status(400).send({ error: "path is required" });
  try {
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) return reply.status(400).send({ error: "path is not a directory" });
  } catch {
    return reply.status(404).send({ error: "Directory not found" });
  }

  // Fire-and-forget background backfill
  setImmediate(async () => {
    try {
      const repo = getRepo();
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const fullPath = path.join(dirPath, entry.name);
        const fileType = getFileType(entry.name);
        if (fileType === "unknown") continue;

        try {
          const s = fs.statSync(fullPath);
          repo.upsertFile({
            filepath: fullPath,
            folderpath: dirPath,
            filename: entry.name,
            mtime: Math.floor(s.mtimeMs / 1000),
            filesize: s.size,
            file_type: fileType,
            ext: path.extname(entry.name).toLowerCase() || null,
            fingerprint: makeFingerprint(fullPath, Math.floor(s.mtimeMs / 1000), s.size),
            scan_state: 1,
          });

          if (fill_thumbnail && ["archive", "video", "image"].includes(fileType)) {
            getOrGenerateThumb(fullPath).catch(() => { /* ignore thumb errors */ });
          }

          if (fill_meta) {
            const parsed = parseName(entry.name);
            // Convert null → undefined to match saveParsedMetadata signature
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
  });

  return reply.send({ status: "started", message: "Backfill task started", path: dirPath });
}

// Simple in-memory watcher registry
const activeWatchers = new Map<string, fs.FSWatcher>();

async function scanWatch(
  req: FastifyRequest<{ Body: { path: string } }>,
  reply: FastifyReply
) {
  const { path: dirPath } = req.body ?? {};
  if (!dirPath) return reply.status(400).send({ error: "path is required" });
  try {
    const stat = fs.statSync(dirPath);
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
    return reply.send({ status: "started", path: dirPath });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

async function getScanStatus(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send({ running: false, progress: null });
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
}
