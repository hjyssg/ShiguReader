import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getDb } from "../db/client.js";
import { IndexRepository } from "../db/repository.js";
import { config } from "../config.js";

function getRepo() {
  return new IndexRepository(getDb());
}

function buildThumbUrl(filePath: string): string {
  return `${config.API_V1_STR}/fs/thumb?path=${encodeURIComponent(filePath)}`;
}

async function listHistory(
  req: FastifyRequest<{ Querystring: { offset?: string; limit?: string; sort_order?: string } }>,
  reply: FastifyReply
) {
  const offset = Math.max(0, parseInt(req.query.offset ?? "0", 10) || 0);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit ?? "50", 10) || 50));
  const sortOrder = req.query.sort_order === "asc" ? "asc" : "desc";

  const repo = getRepo();
  const total = repo.countProgressHistory();
  const rows = repo.listProgressHistory(offset, limit, sortOrder);

  return reply.send({
    total,
    items: rows.map(r => ({
      filepath: r.filepath,
      filename: r.filename,
      file_type: r.file_type,
      filesize: r.filesize,
      mtime: r.mtime,
      thumbnail_url: r.thumbnail_url ?? (r.filepath ? buildThumbUrl(r.filepath) : null),
      last_opened_at: r.last_opened_at,
      total_time_sec: r.total_time_sec,
      page_current: r.page_current,
      page_total: r.page_total,
      position_sec: r.position_sec,
      duration_sec: r.duration_sec,
    })),
  });
}

async function upsertProgress(
  req: FastifyRequest<{
    Body: {
      filepath: string;
      filename?: string;
      file_type?: string;
      filesize?: number;
      mtime?: number;
      thumbnail_url?: string;
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
  app.get("", listHistory);
  app.post("", upsertProgress);
}
