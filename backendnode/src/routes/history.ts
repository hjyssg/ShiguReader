import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import path from "node:path";
import { getRepo, buildThumbUrl } from "./_listUtils.js";
import { config, resolveProjectPath } from "../config.js";

function isPathInside(targetPath: string, parentPath: string): boolean {
  const target = path.resolve(targetPath);
  const parent = path.resolve(parentPath);

  if (target === parent) return true;

  const normalizedTarget = process.platform === "win32" ? target.toLowerCase() : target;
  const normalizedParent = process.platform === "win32" ? parent.toLowerCase() : parent;
  return normalizedTarget.startsWith(`${normalizedParent}${path.sep}`);
}

function shouldSkipHistoryRecord(filepath: string): boolean {
  const extractCacheDir = resolveProjectPath(config.EXTRACT_CACHE_DIR);
  const thumbCacheDir = resolveProjectPath(config.THUMB_CACHE_DIR);
  return isPathInside(filepath, extractCacheDir) || isPathInside(filepath, thumbCacheDir);
}

// GET /api/v1/history/list
async function listHistory(
  req: FastifyRequest<{ Querystring: { page?: string; page_size?: string; sort_order?: string } }>,
  reply: FastifyReply
) {
  const page = Math.max(1, parseInt(req.query.page ?? "1", 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(req.query.page_size ?? "50", 10) || 50));
  const offset = (page - 1) * pageSize;
  const sortOrder = req.query.sort_order === "asc" ? "asc" : "desc";

  const repo = getRepo();
  const total = repo.countReadHistory();
  const totalPages = Math.ceil(total / pageSize);
  const rows = repo.listReadHistory(offset, pageSize, sortOrder);

  return reply.send({
    items: rows.map(r => ({
      id: r.id,
      filepath: r.filepath,
      filename: r.filename ?? null,
      file_type: r.file_type ?? null,
      thumbnail_url: r.thumbnail_filepath
        ? buildThumbUrl(r.thumbnail_filepath)
        : (r.filepath ? buildThumbUrl(r.filepath) : null),
      opened_at: r.opened_at,
    })),
    page,
    page_size: pageSize,
    total,
    total_pages: totalPages,
  });
}

// POST /api/v1/history/record
async function recordHistory(
  req: FastifyRequest<{ Body: { filepath: string } }>,
  reply: FastifyReply
) {
  const body = req.body ?? {};
  if (!body.filepath) return reply.status(400).send({ error: "filepath is required" });

  if (shouldSkipHistoryRecord(body.filepath)) {
    return reply.send({ status: "skipped", reason: "cache_path" });
  }

  const repo = getRepo();
  repo.recordRead(body.filepath);
  return reply.send({ status: "ok" });
}

export async function historyRoutes(app: FastifyInstance) {
  app.get("/list", { schema: { summary: "获取阅读历史列表（分页）", tags: ["历史"] } }, listHistory);
  app.post("/record", { schema: { summary: "记录一次阅读", tags: ["历史"] } }, recordHistory);
}
