import type { FastifyRequest, FastifyReply } from "fastify";
import path from "node:path";
import fs from "node:fs";
import { getMimeType } from "../utils/fileType.js";
import { getRepo } from "./_listUtils.js";
import { observeFilePresence } from "../services/reconcileQueue.js";
import { fileExists } from "../utils/fsUtils.js";
import { logger } from "../logger.js";
import trash from "trash";

// ─── helpers ──────────────────────────────────────────────────────────────────

function isExdevError(err: unknown): err is NodeJS.ErrnoException {
  return typeof err === "object" && err !== null && (err as NodeJS.ErrnoException).code === "EXDEV";
}

async function moveFileCompat(sourcePath: string, destPath: string): Promise<void> {
  try {
    await fs.promises.rename(sourcePath, destPath);
  } catch (err) {
    if (!isExdevError(err)) {
      throw err;
    }
    await fs.promises.copyFile(sourcePath, destPath);
    await fs.promises.unlink(sourcePath);
  }
}

async function moveFolderCompat(sourcePath: string, destPath: string): Promise<void> {
  try {
    await fs.promises.rename(sourcePath, destPath);
  } catch (err) {
    if (!isExdevError(err)) {
      throw err;
    }
    await fs.promises.cp(sourcePath, destPath, { recursive: true, force: false, errorOnExist: true });
    await fs.promises.rm(sourcePath, { recursive: true, force: true });
  }
}

// ─── handlers ────────────────────────────────────────────────────────────────

export async function moveFile(
  req: FastifyRequest<{ Body: { source_path: string; dest_path: string } }>,
  reply: FastifyReply,
) {
  const { source_path, dest_path } = req.body ?? {};
  if (!source_path || !dest_path) {
    return reply.status(400).send({ error: "source_path and dest_path are required" });
  }
  try {
    await fs.promises.mkdir(path.dirname(dest_path), { recursive: true });
    await moveFileCompat(source_path, dest_path);
    logger.fs(`move file: ${source_path} → ${dest_path}`);
    try {
      getRepo().logActivity(
        "move",
        `Moved file: ${source_path} → ${dest_path}`,
        "completed",
        `move:${source_path}`,
        source_path,
      );
    } catch {
      /* ignore */
    }
    return reply.send({ status: "ok", message: "File moved", path: source_path, dest_path });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

export async function moveFolder(
  req: FastifyRequest<{ Body: { source_path: string; dest_path: string } }>,
  reply: FastifyReply,
) {
  const { source_path, dest_path } = req.body ?? {};
  if (!source_path || !dest_path) {
    return reply.status(400).send({ error: "source_path and dest_path are required" });
  }
  try {
    await fs.promises.mkdir(path.dirname(dest_path), { recursive: true });
    await moveFolderCompat(source_path, dest_path);
    logger.fs(`move folder: ${source_path} → ${dest_path}`);
    try {
      getRepo().logActivity(
        "move",
        `Moved folder: ${source_path} → ${dest_path}`,
        "completed",
        `move:${source_path}`,
        source_path,
      );
    } catch {
      /* ignore */
    }
    return reply.send({ status: "ok", message: "Folder moved", path: source_path, dest_path });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

export async function deleteItem(
  req: FastifyRequest<{ Body: { path: string; permanently?: boolean } }>,
  reply: FastifyReply,
) {
  const { path: itemPath, permanently = false } = req.body ?? {};
  if (!itemPath) {
    return reply.status(400).send({ error: "path is required" });
  }
  try {
    if (permanently) {
      await fs.promises.rm(itemPath, { recursive: true, force: true });
    } else {
      await trash(itemPath);
    }
    logger.fs(`delete (${permanently ? "permanent" : "trash"}): ${itemPath}`);
    try {
      getRepo().logActivity("delete", `Deleted: ${itemPath}`, "completed", `delete:${itemPath}`, itemPath);
    } catch {
      /* ignore */
    }
    return reply.send({
      status: "ok",
      message: permanently ? "Permanently deleted" : "Moved to trash",
      path: itemPath,
    });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

export async function renameItem(
  req: FastifyRequest<{ Body: { path: string; new_name: string } }>,
  reply: FastifyReply,
) {
  const { path: itemPath, new_name } = req.body ?? {};
  if (!itemPath || !new_name) {
    return reply.status(400).send({ error: "path and new_name are required" });
  }
  const newPath = path.join(path.dirname(itemPath), new_name);
  try {
    await fs.promises.rename(itemPath, newPath);
    logger.fs(`rename: ${itemPath} → ${newPath}`);
    try {
      getRepo().logActivity("rename", `Renamed: ${itemPath} → ${newPath}`, "completed", `rename:${itemPath}`, itemPath);
    } catch {
      /* ignore */
    }
    return reply.send({ status: "ok", message: "Renamed", path: itemPath, dest_path: newPath });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

export async function downloadFile(req: FastifyRequest<{ Querystring: { path: string } }>, reply: FastifyReply) {
  const { path: filePath } = req.query;
  if (!filePath) {
    return reply.status(400).send({ error: "path is required" });
  }
  if (!(await fileExists(filePath))) {
    observeFilePresence(filePath, false);
    return reply.status(404).send({ error: "File not found" });
  }
  observeFilePresence(filePath, true);
  const mime = getMimeType(filePath);
  const filename = path.basename(filePath);
  reply.header("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
  return reply.type(mime).send(fs.createReadStream(filePath));
}

/**
 * 下载完整文件（attachment），触发浏览器"另存为"对话框。
 * 使用 reply.sendFile(basename, rootDir) 以获得正确的 Content-Length。
 */
export async function downloadFileFull(req: FastifyRequest<{ Querystring: { path: string } }>, reply: FastifyReply) {
  const { path: filePath } = req.query;
  if (!filePath) {
    return reply.status(400).send({ error: "path is required" });
  }
  if (!(await fileExists(filePath))) {
    observeFilePresence(filePath, false);
    return reply.status(404).send({ error: "File not found" });
  }
  observeFilePresence(filePath, true);
  reply.header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(filePath))}`);
  return reply.sendFile(path.basename(filePath), path.dirname(filePath));
}

/**
 * 内联返回文件流（inline），用于在线预览，不触发下载对话框。
 */
export async function serveFile(req: FastifyRequest<{ Querystring: { path: string } }>, reply: FastifyReply) {
  const { path: filePath } = req.query;
  if (!filePath) {
    return reply.status(400).send({ error: "path is required" });
  }
  if (!(await fileExists(filePath))) {
    observeFilePresence(filePath, false);
    return reply.status(404).send({ error: "File not found" });
  }
  observeFilePresence(filePath, true);
  return reply.sendFile(path.basename(filePath), path.dirname(filePath));
}

export async function ensureDir(req: FastifyRequest<{ Body: { path: string } }>, reply: FastifyReply) {
  const { path: dirPath } = req.body ?? {};
  if (!dirPath) {
    return reply.status(400).send({ error: "path is required" });
  }
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
    return reply.send({ status: "ok" });
  } catch (e) {
    return reply.status(500).send({ error: String(e) });
  }
}

export async function resolvePath(req: FastifyRequest<{ Querystring: { path: string } }>, reply: FastifyReply) {
  const { path: p } = req.query;
  if (!p) {
    return reply.status(400).send({ error: "path is required" });
  }
  const resolved = path.resolve(p);
  try {
    const stat = await fs.promises.stat(resolved);
    return reply.send({ path: resolved, exists: true, is_dir: stat.isDirectory() });
  } catch {
    return reply.send({ path: resolved, exists: false, is_dir: false });
  }
}
