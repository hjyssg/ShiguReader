import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import path from "node:path";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getFileType, getMimeType } from "../utils/fileType.js";
import { get7z as get7zBin } from "../utils/tools.js";
import { config } from "../config.js";
import { getRepo, buildThumbUrl } from "./_listUtils.js";
import {
  listEntries,
  calcAvgImageSize,
  stepwiseExtract,
  getExtractCacheDir,
  clearExtractCache as svcClearExtractCache,
  compressArchiveImages,
} from "../services/archiveService.js";
import { getOrGenerateThumb } from "../services/thumbService.js";
import { observeFilePresence } from "../services/reconcileQueue.js";
// parseName 约束：只能传 filename（entry.name / item.name）或 parent folder name，
// 不能传完整 filepath，否则路径分隔符会干扰括号解析逻辑
import { parseName } from "../utils/nameParser.js";
import trash from "trash";
import { refreshAllRecScores } from "../services/recService.js";
import { logger } from "../logger.js";
import { isHiddenFile } from "../utils/fileFilters.js";

const execFileAsync = promisify(execFile);

function isExdevError(err: unknown): err is NodeJS.ErrnoException {
  return typeof err === "object" && err !== null && (err as NodeJS.ErrnoException).code === "EXDEV";
}

async function moveFileCompat(sourcePath: string, destPath: string): Promise<void> {
  try {
    await fs.promises.rename(sourcePath, destPath);
  } catch (err) {
    if (!isExdevError(err)) throw err;
    await fs.promises.copyFile(sourcePath, destPath);
    await fs.promises.unlink(sourcePath);
  }
}

async function moveFolderCompat(sourcePath: string, destPath: string): Promise<void> {
  try {
    await fs.promises.rename(sourcePath, destPath);
  } catch (err) {
    if (!isExdevError(err)) throw err;
    await fs.promises.cp(sourcePath, destPath, { recursive: true, force: false, errorOnExist: true });
    await fs.promises.rm(sourcePath, { recursive: true, force: true });
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function parseRoots(): string[] {
  if (!config.FS_ROOTS) return [];
  return config.FS_ROOTS.split(",").map(r => r.trim()).filter(Boolean);
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
    const visibleEntries = entries.filter(entry => !isHiddenFile(entry.name));
    // Parallel stat for all entries
    const statResults = await Promise.all(
      visibleEntries.map(async (entry) => {
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
        // Phase 1: 标记 DB 里有但磁盘上已消失的文件为 missing
        const presentPaths = items
          .filter(i => i.item_type === "file")
          .map(i => i.path);
        r.markMissingInFolder(dirPath, presentPaths);
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

  logger.scan(`Started: ${dirPath} (recursive=${recursive})`);

  // Fire-and-forget background scan (async)
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
        scanStatusMap.set(dirPath, { ...scanStatusMap.get(dirPath)!, scanned_folders: scannedFolders, scanned_files: scannedFiles });
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
              // 每 500 个文件打一次进度
              if (scannedFiles % PROGRESS_INTERVAL === 0) {
                logger.scan(`Progress: ${scannedFiles} files, ${scannedFolders} folders — ${dirPath}`);
              }
            }
          } catch { /* skip */ }
        }
        // Mark files no longer on disk as missing
        repo.markMissingInFolder(dir, presentPaths);
      };
      await walk(dirPath, recursive);
      logger.scan(`Completed: ${scannedFiles} files, ${scannedFolders} folders — ${dirPath}`);
      scanStatusMap.set(dirPath, { ...scanStatusMap.get(dirPath)!, status: "completed", message: `Scan completed: ${dirPath}`, finished_at: Math.floor(Date.now() / 1000) });
      repo.logActivity("scan", `Scan completed: ${dirPath}`, "completed", `scan:${dirPath}`, dirPath, { scanned_files: scannedFiles, scanned_folders: scannedFolders });
      // 扫描完成后异步重算 rec_score
      setImmediate(() => { try { refreshAllRecScores(); } catch { /* ignore */ } });
    } catch (e) {
      logger.scan(`Failed: ${dirPath} — ${e}`);
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
  if (process.platform !== "win32") {
    return reply.send([{ path: "/", dirname: "/" }]);
  }
  // Probe A-Z — no external commands, no wmic, no encoding issues
  const drives: { path: string; dirname: string }[] = [];
  for (let code = 65; code <= 90; code++) {
    const drivePath = `${String.fromCharCode(code)}:\\`;
    try {
      await fs.promises.access(drivePath);
      drives.push({ path: drivePath, dirname: drivePath });
    } catch { /* drive not present */ }
  }
  return reply.send(drives);
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
    await moveFileCompat(source_path, dest_path);
    logger.fs(`move file: ${source_path} → ${dest_path}`);
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
    await moveFolderCompat(source_path, dest_path);
    logger.fs(`move folder: ${source_path} → ${dest_path}`);
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
    logger.fs(`delete (${permanently ? "permanent" : "trash"}): ${itemPath}`);
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
    logger.fs(`rename: ${itemPath} → ${newPath}`);
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
    // Phase 3: 顺手更新文件存在状态
    observeFilePresence(filePath, true);
    const mime = getMimeType(filePath);
    const filename = path.basename(filePath);
    reply.header("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    return reply.type(mime).send(fs.createReadStream(filePath));
  } catch (_e) {
    // Phase 3: 文件不存在时标记 missing
    observeFilePresence(filePath, false);
    return reply.status(404).send({ error: "File not found" });
  }
}

/**
 * 下载完整文件（attachment）
 *
 * 与 `serveFile` 的区别：
 * - 设置 `Content-Disposition: attachment`，浏览器触发"另存为"对话框
 * - 用于用户主动下载文件到本地
 *
 * 使用 `reply.sendFile(basename, rootDir)` 而非 `reply.download()`，
 * 因为 `reply.download()` 的第二个参数是 options 对象，不支持传 rootPath。
 */
async function downloadFileFull(
  req: FastifyRequest<{ Querystring: { path: string } }>,
  reply: FastifyReply
) {
  const { path: filePath } = req.query;
  if (!filePath) return reply.status(400).send({ error: "path is required" });

  try {
    await fs.promises.access(filePath);
    observeFilePresence(filePath, true);
  } catch {
    observeFilePresence(filePath, false);
    return reply.status(404).send({ error: "File not found" });
  }

  // reply.sendFile(basename, rootDir) 正确覆盖 root，@fastify/static 会自动设置 Content-Length
  reply.header(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(filePath))}`
  );
  return reply.sendFile(path.basename(filePath), path.dirname(filePath));
}

/**
 * 内联返回文件流（inline）
 *
 * 与 `downloadFileFull` 的区别：
 * - 不设置 `Content-Disposition`，浏览器直接展示内容（图片预览、视频播放等）
 * - 用于在线阅读/预览场景，不触发下载对话框
 */
async function serveFile(
  req: FastifyRequest<{ Querystring: { path: string } }>,
  reply: FastifyReply
) {
  const { path: filePath } = req.query;
  if (!filePath) return reply.status(400).send({ error: "path is required" });
  try {
    await fs.promises.access(filePath);
    observeFilePresence(filePath, true);
  } catch {
    observeFilePresence(filePath, false);
    return reply.status(404).send({ error: "File not found" });
  }
  return reply.sendFile(path.basename(filePath), path.dirname(filePath));
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

// Phase 4: 从 archive entries 提取元数据并异步回写 DB（含缩略图和 avg_image_size）
function _backfillArchiveMeta(archivePath: string, archiveStat: fs.Stats, entries: Awaited<ReturnType<typeof listEntries>>): void {
  setImmediate(async () => {
    try {
      const repo = getRepo();
      const versionSig = `${Math.floor(archiveStat.mtimeMs / 1000)}:${archiveStat.size}`;
      const existingSig = repo.getArchiveVersionSig(archivePath);
      if (existingSig === versionSig) return; // 签名一致，无需更新

      const imageEntries = entries.filter(e => e.file_type === "image");
      const videoEntries = entries.filter(e => e.file_type === "video");
      const audioEntries = entries.filter(e => e.file_type === "audio");
      const coverEntry = imageEntries[0]?.entry_path ?? null;
      const ext = path.extname(archivePath).toLowerCase().slice(1);
      const avgImgSize = calcAvgImageSize(entries);

      repo.upsertArchiveMeta(
        archivePath, ext, entries.length,
        imageEntries.length, videoEntries.length, audioEntries.length,
        versionSig, coverEntry, avgImgSize,
      );

      // 如果 files 表里没有缩略图，顺手生成
      const fileRow = repo.getFile(archivePath);
      if (fileRow && !fileRow.thumbnail_filepath) {
        const thumbPath = await getOrGenerateThumb(archivePath).catch(() => null);
        if (thumbPath) repo.updateFileThumbnail(archivePath, thumbPath);
      }
    } catch { /* 后台任务失败不影响主流程 */ }
  });
}

async function listArchive(
  req: FastifyRequest<{ Querystring: { path: string } }>,
  reply: FastifyReply
) {
  const { path: archivePath } = req.query;
  if (!archivePath) return reply.status(400).send({ error: "path is required" });
  let archiveStat: fs.Stats;
  try {
    archiveStat = await fs.promises.stat(archivePath);
  } catch {
    return reply.status(404).send({ error: "File not found" });
  }
  try {
    const entries = await listEntries(archivePath);
    // Phase 4: 顺手更新 archive 元数据 + 缩略图
    _backfillArchiveMeta(archivePath, archiveStat, entries);
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
  let archiveStat: fs.Stats;
  try {
    archiveStat = await fs.promises.stat(archivePath);
  } catch {
    return reply.status(404).send({ error: "File not found" });
  }
  try {
    const result = await stepwiseExtract(archivePath, page);
    // Phase 4: 翻页时也顺手更新 archive 元数据（利用 stepwiseExtract 已经调用过 listEntries 的结果）
    // 这里单独再调一次 listEntries 成本较高，改为只在签名变化时触发一次后台 stat 检查
    setImmediate(async () => {
      try {
        const repo = getRepo();
        const versionSig = `${Math.floor(archiveStat.mtimeMs / 1000)}:${archiveStat.size}`;
        if (repo.getArchiveVersionSig(archivePath) !== versionSig) {
          const entries = await listEntries(archivePath);
          _backfillArchiveMeta(archivePath, archiveStat, entries);
        }
        // 缩略图检查
        const fileRow = repo.getFile(archivePath);
        if (fileRow && !fileRow.thumbnail_filepath) {
          const thumbPath = await getOrGenerateThumb(archivePath).catch(() => null);
          if (thumbPath) repo.updateFileThumbnail(archivePath, thumbPath);
        }
      } catch { /* ignore */ }
    });
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
  } catch {
    return reply.status(404).send({ error: "File not found in extract cache" });
  }
  return reply.sendFile(path.basename(resolved), path.dirname(resolved));
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
    await execFileAsync(get7zBin(), ["a", "-tzip", outputZip, `${folder_path + path.sep}*`, "-y"], {
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
        });
        scannedFiles++;

        if (fill_thumbnail && ["archive", "video", "image"].includes(fileType)) {
          // Phase 2: 生成缩略图后把路径写回 DB
          getOrGenerateThumb(fullPath)
            .then(thumbPath => {
              backfilledThumbnails++;
              if (thumbPath) {
                try { getRepo().updateFileThumbnail(fullPath, thumbPath); } catch { /* ignore */ }
              }
            })
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
              // 使用 file_type（非 deprecated 的 type 字段）
              const imageNum = archiveEntries.filter(e => e.file_type === "image").length;
              const videoNum = archiveEntries.filter(e => e.file_type === "video").length;
              const audioNum = archiveEntries.filter(e => e.file_type === "audio").length;
              const ext = path.extname(entry.name).toLowerCase().slice(1);
              repo.upsertArchiveMeta(fullPath, ext, archiveEntries.length, imageNum, videoNum, audioNum);
            } catch { /* skip if archive listing fails */ }
          }
        }
      } catch { /* skip individual file errors */ }
    }
    repo.logActivity("backfill", `Backfill completed: ${dirPath}`, "completed", `backfill:${dirPath}`, dirPath);
  } catch (_e) {
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

// ─── plugin ──────────────────────────────────────────────────────────────────

export async function fsRoutes(app: FastifyInstance) {
  app.get("/roots", { schema: { summary: "获取配置的根目录列表", tags: ["文件系统"] } }, getRoots);
  app.get("/drives", { schema: { summary: "获取系统盘符 (Windows)", tags: ["文件系统"] } }, getDrives);
  app.get("/favorite-folder", { schema: { summary: "获取收藏目录信息", tags: ["文件系统"] } }, getFavorite);
  app.get("/already-read-folder", { schema: { summary: "获取已读目录信息", tags: ["文件系统"] } }, getAlreadyRead);
  app.get("/listdir", { schema: { summary: "列出目录内容（文件+文件夹）", tags: ["文件系统"] } }, listDirectory);
  app.get("/library-overview", { schema: { summary: "获取库概览统计", tags: ["文件系统"] } }, getLibraryOverview);
  app.get("/recent-activity", { schema: { summary: "获取最近活动日志", tags: ["文件系统"] } }, getRecentActivity);
  app.get("/top-opened-folders", { schema: { summary: "获取最常打开的文件夹", tags: ["文件系统"] } }, getTopOpenedFolders);
  app.post("/scan", { schema: { summary: "扫描目录并索引文件", tags: ["扫描"] } }, scanDirectory);
  app.post("/scan-favorite", { schema: { summary: "扫描收藏目录", tags: ["扫描"] } }, scanFavorite);
  app.post("/generate", { schema: { summary: "生成元数据和缩略图", tags: ["扫描"] } }, backfill);
  app.post("/scan-and-watch", { schema: { summary: "扫描并启动目录文件监听", tags: ["扫描"] } }, scanWatch);
  app.get("/scan-status", { schema: { summary: "查询扫描任务状态", tags: ["扫描"] } }, getScanStatus);
  app.post("/move-file", { schema: { summary: "移动文件", tags: ["文件操作"] } }, moveFile);
  app.post("/move-folder", { schema: { summary: "移动文件夹", tags: ["文件操作"] } }, moveFolder);
  app.delete("/delete", { schema: { summary: "删除文件或文件夹（回收站/永久）", tags: ["文件操作"] } }, deleteItem);
  app.post("/rename", { schema: { summary: "重命名文件或文件夹", tags: ["文件操作"] } }, renameItem);
  app.get("/download", { schema: { summary: "下载文件（attachment）", tags: ["文件操作"] } }, downloadFile);
  app.get("/download-full", { schema: { summary: "下载完整文件（带 Content-Length）", tags: ["文件操作"] } }, downloadFileFull);
  app.get("/file", { schema: { summary: "直接返回文件流（inline）", tags: ["文件操作"] } }, serveFile);
  app.post("/mkdir", { schema: { summary: "创建目录（递归）", tags: ["文件操作"] } }, ensureDir);
  app.get("/resolve-path", { schema: { summary: "解析路径并检查是否存在", tags: ["文件操作"] } }, resolvePath);
  app.post("/zip-folder", { schema: { summary: "将文件夹压缩为 zip", tags: ["压缩包"] } }, zipFolder);
  app.post("/unzip", { schema: { summary: "解压压缩包到目录", tags: ["压缩包"] } }, unzip);
  app.get("/archive/list", { schema: { summary: "列出压缩包内文件条目", tags: ["压缩包"] } }, listArchive);
  app.post("/archive/extract", { schema: { summary: "分步解压压缩包（按页）", tags: ["压缩包"] } }, extractArchive);
  app.get("/archive/file", { schema: { summary: "获取压缩包内单个文件", tags: ["压缩包"] } }, getArchiveFile);
  app.delete("/clean-extract-cache", { schema: { summary: "清除解压缓存", tags: ["压缩包"] } }, clearExtractCache);
  app.post("/archive/compress-images", { schema: { summary: "压缩包内图片批量压缩", tags: ["压缩包"] } }, compressImages);
}
