import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getDb } from "../db/client.js";
import { IndexRepository } from "../db/repository.js";

function getRepo() {
  return new IndexRepository(getDb());
}

async function listTags(
  req: FastifyRequest<{
    Querystring: { offset?: string; limit?: string; sort_by?: string; sort_order?: string };
  }>,
  reply: FastifyReply
) {
  const offset = Math.max(0, parseInt(req.query.offset ?? "0", 10) || 0);
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit ?? "100", 10) || 100));
  const sortBy = req.query.sort_by ?? "count";
  const sortOrder = req.query.sort_order ?? "desc";

  const repo = getRepo();
  const total = repo.countTags();
  const items = repo.listTagsWithCounts(offset, limit, sortBy, sortOrder);

  return reply.send({ total, items });
}

export async function tagsRoutes(app: FastifyInstance) {
  app.get("", listTags);
}
