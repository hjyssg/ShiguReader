import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getDb } from "../db/client.js";
import { IndexRepository } from "../db/repository.js";

function getRepo() {
  return new IndexRepository(getDb());
}

async function listAuthors(
  req: FastifyRequest<{
    Querystring: { page?: string; page_size?: string; sort_by?: string; sort_order?: string };
  }>,
  reply: FastifyReply
) {
  const page = Math.max(1, parseInt(req.query.page ?? "1", 10) || 1);
  const pageSize = Math.min(500, Math.max(1, parseInt(req.query.page_size ?? "100", 10) || 100));
  const offset = (page - 1) * pageSize;
  const sortBy = req.query.sort_by ?? "count";
  const sortOrder = req.query.sort_order ?? "desc";

  const repo = getRepo();
  const total = repo.countArtists("");
  const items = repo.listArtistsWithCounts(offset, pageSize, "", sortBy, sortOrder);

  return reply.send({ items, page, page_size: pageSize, total });
}

export async function authorsRoutes(app: FastifyInstance) {
  app.get("", listAuthors);
}
