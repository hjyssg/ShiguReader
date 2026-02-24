import type { FastifyRequest, FastifyReply } from "fastify";
import path from "node:path";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { get7z as get7zBin } from "../utils/tools.js";
import { getRepo } from "./_listUtils.js";
import {
  listEntries,
  calcAvgImageSize,
  stepwiseExtract,
  getExtractCacheDir,
  clearExtractCache as svcClearExtractCache,
  compressArchiveImages,
} from "../services/archiveService.js";
import { getOrGenerateThumb } from "../services/thumbService.js";

const execFileAsync = promisify(execFile);

// ─── helpers ──────────────────────────────────────────────────────────────────

// Phase 4: 从 archive entries 提取元数据并异步回写 DB（含缩略图和 avg_image_size）
function _backfillArchiveMeta(archivePath: string, archiveStat: fs.Stats, entries: Awaited<ReturnType<typeof listEntries>>): void {
  setImmediate(async () => {
    try {
      const repo = getRepo();
      const versionSig = `${Math.floor(archiveStat.mtimeMs / 1000)}:${archiveStat.size}`;
      if (repo.getArchiveVersionSig(archivePath) === versionSig) return;

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

      const fileRow = repo.getFile(archivePath);
      if (fileRow && !fileRow.thumbnail_filepath) {
        const thumbPath = await getOrGenerateThumb(archivePath).catch(() => null);
        if (thumbPath) repo.updateFileThumbnail(archivePath, thumbPath);
      }
    } catch { /* 后台任务失败不影响主流程 */ }
  });
}

// ─── handlers ────────────────────────────────────────────────────────────────

export async function listArchive(
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
    _backfillArchiveMeta(archivePath, archiveStat, entries);
    return reply.send({ entries, total: entries.length });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

export async function extractArchive(
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
    setImmediate(async () => {
      try {
        const repo = getRepo();
        const versionSig = `${Math.floor(archiveStat.mtimeMs / 1000)}:${archiveStat.size}`;
        if (repo.getArchiveVersionSig(archivePath) !== versionSig) {
          const entries = await listEntries(archivePath);
          _backfillArchiveMeta(archivePath, archiveStat, entries);
        }
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

export async function getArchiveFile(
  req: FastifyRequest<{ Querystring: { path: string; entry: string } }>,
  reply: FastifyReply
) {
  const { path: archivePath, entry } = req.query;
  if (!archivePath || !entry) return reply.status(400).send({ error: "path and entry are required" });
  const cacheDir = getExtractCacheDir(archivePath);
  const filePath = path.join(cacheDir, entry);
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

export async function clearExtractCache(_req: FastifyRequest, reply: FastifyReply) {
  try {
    const result = svcClearExtractCache();
    try { getRepo().logActivity("cache_cleanup", "Extract cache cleared", "completed", "cache_cleanup"); } catch { /* ignore */ }
    return reply.send({ status: "ok", ...result });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

export async function compressImages(
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

export async function zipFolder(
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
    await execFileAsync(get7zBin(), ["a", "-tzip", outputZip, `${folder_path + path.sep}*`, "-y"], { timeout: 300000 });
    return reply.send({ status: "ok", message: "Zip created", path: folder_path, dest_path: outputZip });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

export async function unzip(
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
    await execFileAsync(get7zBin(), ["x", archive_path, `-o${outputDir}`, "-y", "-scsUTF-8"], { timeout: 300000 });
    return reply.send({ status: "ok", message: "Unzipped", path: archive_path, dest_path: outputDir });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}
