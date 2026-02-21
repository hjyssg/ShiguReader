import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fs from "node:fs";
import { getDb } from "../db/client.js";
import { IndexRepository } from "../db/repository.js";
import { config } from "../config.js";

function getRepo() {
  return new IndexRepository(getDb());
}

function buildThumbUrl(filePath: string): string {
  return `${config.API_V1_STR}/fs/thumb?path=${encodeURIComponent(filePath)}`;
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
  const total = repo.countProgressHistory();
  const totalPages = Math.ceil(total / pageSize);
  const rows = repo.listProgressHistory(offset, pageSize, sortOrder);

  return reply.send({
    items: rows.map(r => ({
      filepath: r.filepath,
      filename: r.filename,
      file_type: r.file_type,
      filesize: r.filesize,
      mtime: r.mtime,
      thumbnail_url: r.thumbnail_url ?? (r.filepath ? buildThumbUrl(r.filepath) : null),
      read_at: r.last_opened_at,
      page_current: r.page_current,
      page_total: r.page_total,
      file_exists: r.filepath ? fs.existsSync(r.filepath) : null,
    })),
    page,
    page_size: pageSize,
    total,
    total_pages: totalPages,
  });
}

// POST /api/v1/history/record
async function recordHistory(
  req: FastifyRequest<{
    Body: {
      filepath: string;
      page_current?: number;
      page_total?: number;
      position_sec?: number;
      duration_sec?: number;
    };
  }>,
  reply: FastifyReply
) {
  const body = req.body ?? {};
  if (!body.filepath) return reply.status(400).send({ error: "filepath is required" });

  const repo = getRepo();
  repo.upsertProgress(body);
  return reply.send({ status: "ok" });
}

export async function historyRoutes(app: FastifyInstance) {
  app.get("/list", listHistory);
  app.post("/record", recordHistory);
}
