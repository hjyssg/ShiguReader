import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getRepo, buildThumbUrl } from "./_listUtils.js";

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

  const repo = getRepo();
  repo.recordRead(body.filepath);
  return reply.send({ status: "ok" });
}

export async function historyRoutes(app: FastifyInstance) {
  app.get("/list", listHistory);
  app.post("/record", recordHistory);
}
