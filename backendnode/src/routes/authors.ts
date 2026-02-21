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

/** 从候选路径中找第一个实际存在的文件，返回其 thumb URL */
function resolveThumbUrl(candidates: string[]): string | null {
  for (const fp of candidates) {
    try { fs.accessSync(fp); return buildThumbUrl(fp); } catch { /* next */ }
  }
  return candidates.length > 0 ? buildThumbUrl(candidates[0]) : null;
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
  const rows = repo.listArtistsWithCounts(offset, pageSize, "", sortBy, sortOrder);

  const names = rows.map(r => r.artist_name);
  const candidatesMap = repo.getArtistThumbCandidates(names, "");

  const items = rows.map(r => ({
    name: r.artist_name,
    file_count: r.file_count,
    recommendation_score: r.avg_rec_score,
    thumbnail: resolveThumbUrl(candidatesMap.get(r.artist_name) ?? []),
  }));

  return reply.send({ items, page, page_size: pageSize, total });
}

export async function authorsRoutes(app: FastifyInstance) {
  app.get("", listAuthors);
}
