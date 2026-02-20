import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import path from "node:path";
import fs from "node:fs";
import { getDb } from "../db/client.js";
import { IndexRepository } from "../db/repository.js";
import { getFileType, getMimeType, isDisplayable, makeFingerprint } from "../utils/fileType.js";
import { config } from "../config.js";

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
    const filePaths = fileItems.map(i => i.path);

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

// ─── plugin ──────────────────────────────────────────────────────────────────

export async function fsRoutes(app: FastifyInstance) {
  app.get("/roots", getRoots);
  app.get("/favorite", getFavorite);
  app.get("/already-read", getAlreadyRead);
  app.get("/list", listDirectory);
  app.get("/library-overview", getLibraryOverview);
  app.get("/recent-activity", getRecentActivity);
  app.get("/top-opened-folders", getTopOpenedFolders);
  app.post("/scan", scanDirectory);
}
