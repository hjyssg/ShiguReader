import type { FastifyRequest, FastifyReply } from "fastify";
import path from "node:path";
import fs from "node:fs";
import { getFileType } from "../utils/fileType.js";
import { config } from "../config.js";
import { getRepo, buildThumbUrl } from "./_listUtils.js";
import { parseName } from "../utils/nameParser.js";
import { isHiddenFile } from "../utils/fileFilters.js";
import { fileExists } from "../utils/fsUtils.js";

// ─── types ───────────────────────────────────────────────────────────────────

export interface FileSystemItem {
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

// ─── helpers ─────────────────────────────────────────────────────────────────

export function parseRoots(): string[] {
  if (!config.FS_ROOTS) {
    return [];
  }
  return config.FS_ROOTS.split(",")
    .map((r) => r.trim())
    .filter(Boolean);
}

// ─── handlers ────────────────────────────────────────────────────────────────

export async function getRoots(_req: FastifyRequest, reply: FastifyReply) {
  const roots = parseRoots();
  return reply.send(roots.map((r) => ({ path: r, dirname: path.basename(r) || r })));
}

export async function getDrives(_req: FastifyRequest, reply: FastifyReply) {
  if (process.platform !== "win32") {
    return reply.send([{ path: "/", dirname: "/" }]);
  }
  const drives: { path: string; dirname: string }[] = [];
  for (let code = 65; code <= 90; code++) {
    const drivePath = `${String.fromCharCode(code)}:\\`;
    if (await fileExists(drivePath)) {
      drives.push({ path: drivePath, dirname: drivePath });
    }
  }
  return reply.send(drives);
}


export async function listDirectory(
  req: FastifyRequest<{
    Querystring: { path: string; sort_by?: string; sort_order?: string; has_video?: string; has_audio?: string };
  }>,
  reply: FastifyReply,
) {
  const rawDirPath = req.query.path;
  // Normalize Windows drive-letter-only paths: "D:" → "D:\"
  const dirPath = /^[A-Za-z]:$/.test(rawDirPath) ? rawDirPath + "\\" : rawDirPath;
  const { sort_by = "name", sort_order = "asc", has_video, has_audio } = req.query;
  const filterHasVideo = has_video === "true";
  const filterHasAudio = has_audio === "true";
  if (!dirPath) {
    return reply.status(400).send({ error: "path is required" });
  }

  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(dirPath);
  } catch {
    return reply.status(404).send({ error: "Path not found" });
  }
  if (!stat.isDirectory()) {
    return reply.status(400).send({ error: "Path is not a directory" });
  }

  const items: FileSystemItem[] = [];

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const visibleEntries = entries.filter((entry) => !isHiddenFile(entry.name));
    const statResults = await Promise.all(
      visibleEntries.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        try {
          const entryStat = await fs.promises.stat(fullPath);
          return { entry, fullPath, entryStat };
        } catch {
          return null;
        }
      }),
    );
    for (const result of statResults) {
      if (!result) {
        continue;
      }
      const { entry, fullPath, entryStat } = result;
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
          avg_image_size: null,
          recommendation_score: 0,
          is_missing: 0,
          last_read_at: null,
        });
      } else if (entry.isFile()) {
        const fileType = getFileType(entry.name);
        items.push({
          name: entry.name,
          path: fullPath,
          item_type: "file",
          file_type: fileType,
          filesize: entryStat.size,
          mtime: Math.floor(entryStat.mtimeMs / 1000),
          thumbnail_url: ["archive", "video", "image"].includes(fileType) ? buildThumbUrl(fullPath) : null,
          image_count: null,
          video_count: null,
          audio_count: null,
          avg_image_size: null,
          recommendation_score: 0,
          is_missing: 0,
          last_read_at: null,
        });
      }
    }
  } catch (e) {
    return reply.status(500).send({ error: `Failed to list directory: ${e}` });
  }

  // Enrich from DB
  try {
    const repo = getRepo();
    const fileItems = items.filter((i) => i.item_type === "file");
    const fileDataMap = repo.getFileDataByFolder(dirPath);
    const archivePaths = fileItems.filter((i) => i.file_type === "archive").map((i) => i.path);
    const archiveMetaMap = archivePaths.length ? repo.getArchiveMetasByFolder(dirPath) : new Map();

    for (const item of items) {
      if (item.item_type !== "file") {
        continue;
      }
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
          item.avg_image_size = meta.avg_image_size ?? null;
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
        const presentPaths = items.filter((i) => i.item_type === "file").map((i) => i.path);
        r.markMissingInFolder(dirPath, presentPaths);
        r.recordFolderOpen(dirPath);
      } catch {
        /* ignore bg errors */
      }
    });
  } catch {
    /* ignore DB errors, still return FS data */
  }

  // Apply has_video / has_audio filters
  let filteredItems = items;
  if (filterHasVideo) {
    filteredItems = filteredItems.filter(
      (i) => i.item_type !== "file" || i.file_type !== "archive" || (i.video_count !== null && i.video_count > 0),
    );
  }
  if (filterHasAudio) {
    filteredItems = filteredItems.filter(
      (i) => i.item_type !== "file" || i.file_type !== "archive" || (i.audio_count !== null && i.audio_count > 0),
    );
  }

  // Sort: folders first (by name), then files
  const folders = filteredItems.filter((i) => i.item_type === "folder").sort((a, b) => a.name.localeCompare(b.name));
  const files = filteredItems.filter((i) => i.item_type === "file");
  const rev = sort_order === "desc" ? -1 : 1;
  files.sort((a, b) => {
    if (sort_by === "mtime") {
      return rev * ((a.mtime ?? 0) - (b.mtime ?? 0));
    }
    if (sort_by === "recommendation") {
      return rev * (a.recommendation_score - b.recommendation_score);
    }
    if (sort_by === "type") {
      return rev * (a.file_type ?? "").localeCompare(b.file_type ?? "");
    }
    if (sort_by === "image_count") {
      return rev * ((a.image_count ?? 0) - (b.image_count ?? 0));
    }
    return rev * a.name.localeCompare(b.name);
  });

  return reply.send({ items: [...folders, ...files] });
}

export async function getLibraryOverview(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send(getRepo().getLibraryOverview());
}

export async function getRecentActivity(
  req: FastifyRequest<{ Querystring: { limit?: number; since_latest_startup?: string } }>,
  reply: FastifyReply,
) {
  const limit = Math.min(500, Math.max(1, req.query.limit ?? 200));
  const sinceStartup = req.query.since_latest_startup !== "false";
  const repo = getRepo();
  const rows = sinceStartup ? repo.listActivityLogsSinceLatestStartup(limit) : repo.listActivityLogs(limit);
  return reply.send({
    items: rows.map((r) => ({
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

export async function getTopOpenedFolders(
  req: FastifyRequest<{ Querystring: { limit?: number } }>,
  reply: FastifyReply,
) {
  const limit = Math.min(20, Math.max(1, req.query.limit ?? 5));
  return reply.send({ folder_ids: getRepo().listTopOpenedFolderIds(limit) });
}
