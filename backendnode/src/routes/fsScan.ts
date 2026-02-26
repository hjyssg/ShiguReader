import type { FastifyRequest, FastifyReply } from "fastify";
import path from "node:path";
import fs from "node:fs";
import { getFileType } from "../utils/fileType.js";
import { getRepo } from "./_listUtils.js";
import { parseName } from "../utils/nameParser.js";
import { listEntries } from "../services/archiveService.js";
import { getOrGenerateThumb } from "../services/thumbService.js";
import { refreshAllRecScores } from "../services/recService.js";
import { config } from "../config.js";
import { logger } from "../logger.js";

// ─── in-memory state ──────────────────────────────────────────────────────────

export const scanStatusMap = new Map<
  string,
  {
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
  }
>();

export const activeWatchers = new Map<string, fs.FSWatcher>();

// ─── handlers ────────────────────────────────────────────────────────────────

// ─── shared scan logic ────────────────────────────────────────────────────────

export function startScanTask(dirPath: string, recursive: boolean): void {
  const startedAt = Math.floor(Date.now() / 1000);
  scanStatusMap.set(dirPath, {
    path: dirPath,
    status: "running",
    message: "Scan started",
    recursive,
    scanned_folders: 0,
    scanned_files: 0,
    parsed_files: 0,
    watcher_active: false,
    started_at: startedAt,
    finished_at: null,
  });

  logger.scan(`Started: ${dirPath} (recursive=${recursive})`);

  setImmediate(async () => {
    try {
      const repo = getRepo();
      let scannedFolders = 0;
      let scannedFiles = 0;
      const PROGRESS_INTERVAL = 500;

      const walk = async (dir: string, recurse: boolean) => {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        repo.upsertFolder({ filepath: dir, dirname: path.basename(dir) || dir });
        scannedFolders++;
        scanStatusMap.set(dirPath, {
          ...scanStatusMap.get(dirPath)!,
          scanned_folders: scannedFolders,
          scanned_files: scannedFiles,
        });
        const presentPaths: string[] = [];
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          try {
            const s = await fs.promises.stat(full);
            if (entry.isDirectory() && recurse) {
              await walk(full, true);
            } else if (entry.isFile()) {
              presentPaths.push(full);
              repo.upsertFile({
                filepath: full,
                folderpath: dir,
                filename: entry.name,
                mtime: Math.floor(s.mtimeMs / 1000),
                filesize: s.size,
                file_type: getFileType(entry.name),
                ext: path.extname(entry.name).toLowerCase() || null,
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
              if (scannedFiles % PROGRESS_INTERVAL === 0) {
                logger.scan(`Progress: ${scannedFiles} files, ${scannedFolders} folders — ${dirPath}`);
              }
            }
          } catch {
            /* skip */
          }
        }
        repo.markMissingInFolder(dir, presentPaths);
      };

      await walk(dirPath, recursive);
      logger.scan(`Completed: ${scannedFiles} files, ${scannedFolders} folders — ${dirPath}`);
      scanStatusMap.set(dirPath, {
        ...scanStatusMap.get(dirPath)!,
        status: "completed",
        message: `Scan completed: ${dirPath}`,
        finished_at: Math.floor(Date.now() / 1000),
      });
      repo.logActivity("scan", `Scan completed: ${dirPath}`, "completed", `scan:${dirPath}`, dirPath, {
        scanned_files: scannedFiles,
        scanned_folders: scannedFolders,
      });
      setImmediate(() => {
        try {
          refreshAllRecScores();
        } catch {
          /* ignore */
        }
      });
    } catch (e) {
      logger.scan(`Failed: ${dirPath} — ${e}`);
      scanStatusMap.set(dirPath, {
        ...scanStatusMap.get(dirPath)!,
        status: "error",
        message: `Scan failed: ${dirPath}`,
        finished_at: Math.floor(Date.now() / 1000),
      });
      try {
        getRepo().logActivity("scan", `Scan failed: ${dirPath}`, "failed", `scan:${dirPath}`, dirPath);
      } catch {
        /* ignore */
      }
    }
  });
}

export async function scanDirectory(
  req: FastifyRequest<{ Body: { path: string; recursive?: boolean } }>,
  reply: FastifyReply,
) {
  const { path: dirPath, recursive = true } = req.body ?? {};
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

  startScanTask(dirPath, recursive);
  return reply.send({ status: "started", message: "Scan task started", path: dirPath });
}

export async function scanFavorite(_req: FastifyRequest, reply: FastifyReply) {
  const dir = config.FAVORITE_DIR.trim();
  if (!dir) {
    return reply.send({ status: "started", message: "FAVORITE_DIR not configured", path: "" });
  }
  return reply.send({ status: "started", message: "Scan started", path: dir });
}

export async function getScanStatus(req: FastifyRequest<{ Querystring: { path?: string } }>, reply: FastifyReply) {
  const filterPath = req.query.path;
  const watcherPaths = new Set(activeWatchers.keys());
  const entries = filterPath
    ? scanStatusMap.has(filterPath)
      ? [scanStatusMap.get(filterPath)!]
      : []
    : [...scanStatusMap.values()];

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

  return reply.send(entries.map((e) => ({ ...e, watcher_active: watcherPaths.has(e.path) })));
}

export async function scanAndWatch(
  req: FastifyRequest<{ Body: { path: string; recursive?: boolean } }>,
  reply: FastifyReply,
) {
  const { path: dirPath, recursive = true } = req.body ?? {};
  if (!dirPath) {
    return reply.status(400).send({ error: "path is required" });
  }
  try {
    const stat = await fs.promises.stat(dirPath);
    if (!stat.isDirectory()) {
      return reply.status(400).send({ error: "path is not a directory" });
    }
  } catch {
    return reply.status(404).send({ error: "Directory not found" });
  }

  // 先触发扫描
  startScanTask(dirPath, recursive);

  // 再启动 watcher（已在监听则跳过）
  if (!activeWatchers.has(dirPath)) {
    try {
      const watcher = fs.watch(dirPath, { recursive: true }, (_event, filename) => {
        if (!filename) {
          return;
        }
        const fullPath = path.join(dirPath, filename);
        setImmediate(() => {
          try {
            const s = fs.statSync(fullPath);
            getRepo().upsertFile({
              filepath: fullPath,
              folderpath: dirPath,
              filename: path.basename(fullPath),
              mtime: Math.floor(s.mtimeMs / 1000),
              filesize: s.size,
              file_type: getFileType(fullPath),
              ext: path.extname(fullPath).toLowerCase() || null,
            });
          } catch {
            /* file may have been deleted */
          }
        });
      });
      activeWatchers.set(dirPath, watcher);
    } catch (e) {
      return reply.status(500).send({ error: String(e) });
    }
  }

  return reply.send({ status: "started", message: "Scan and watch started", path: dirPath });
}

export async function backfill(
  req: FastifyRequest<{ Body: { path: string; recursive?: boolean; fill_thumbnail?: boolean; fill_meta?: boolean } }>,
  reply: FastifyReply,
) {
  const { path: dirPath, fill_thumbnail = true, fill_meta = true } = req.body ?? {};
  if (!dirPath) {
    return reply.status(400).send({ error: "path is required" });
  }
  try {
    const stat = await fs.promises.stat(dirPath);
    if (!stat.isDirectory()) {
      return reply.status(400).send({ error: "path is not a directory" });
    }
  } catch {
    return reply.status(404).send({ error: "Directory not found" });
  }

  let scannedFiles = 0;
  let backfilledThumbnails = 0;
  let backfilledMeta = 0;

  try {
    const repo = getRepo();
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }
      const fullPath = path.join(dirPath, entry.name);
      const fileType = getFileType(entry.name);
      if (fileType === "unknown") {
        continue;
      }

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
        });
        scannedFiles++;

        if (fill_thumbnail && ["archive", "video", "image"].includes(fileType)) {
          getOrGenerateThumb(fullPath)
            .then((thumbPath) => {
              backfilledThumbnails++;
              if (thumbPath) {
                try {
                  getRepo().updateFileThumbnail(fullPath, thumbPath);
                } catch {
                  /* ignore */
                }
              }
            })
            .catch(() => {
              /* ignore thumb errors */
            });
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
              const imageNum = archiveEntries.filter((e) => e.file_type === "image").length;
              const videoNum = archiveEntries.filter((e) => e.file_type === "video").length;
              const audioNum = archiveEntries.filter((e) => e.file_type === "audio").length;
              const ext = path.extname(entry.name).toLowerCase().slice(1);
              repo.upsertArchiveMeta(fullPath, ext, archiveEntries.length, imageNum, videoNum, audioNum);
            } catch {
              /* skip if archive listing fails */
            }
          }
        }
      } catch {
        /* skip individual file errors */
      }
    }
    repo.logActivity("backfill", `Backfill completed: ${dirPath}`, "completed", `backfill:${dirPath}`, dirPath);
  } catch {
    try {
      getRepo().logActivity("backfill", `Backfill failed: ${dirPath}`, "failed", `backfill:${dirPath}`, dirPath);
    } catch {
      /* ignore */
    }
  }

  return reply.send({
    status: "ok",
    scanned_files: scannedFiles,
    backfilled_thumbnails: backfilledThumbnails,
    backfilled_meta: backfilledMeta,
    message: `Backfill completed: ${scannedFiles} files scanned`,
  });
}
