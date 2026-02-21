import fs from "node:fs";
import type { FastifyRequest, FastifyReply } from "fastify";
import { getDb } from "../db/client.js";
import { IndexRepository } from "../db/repository.js";
import { config } from "../config.js";

export function buildThumbUrl(filePath: string): string {
  return `${config.API_V1_STR}/fs/thumb?path=${encodeURIComponent(filePath)}`;
}

export function resolveThumbUrl(candidates: string[]): string | null {
  for (const fp of candidates) {
    try { fs.accessSync(fp); return buildThumbUrl(fp); } catch { /* next */ }
  }
  return candidates.length > 0 ? buildThumbUrl(candidates[0]) : null;
}

type PaginatedQuery = { page?: string; page_size?: string; sort_by?: string; sort_order?: string };

interface ListHandlerOptions<R extends Record<string, unknown>> {
  count: (repo: IndexRepository) => number;
  list: (repo: IndexRepository, offset: number, pageSize: number, sortBy: string, sortOrder: string) => R[];
  thumbCandidates: (repo: IndexRepository, names: string[]) => Map<string, string[]>;
  nameKey: keyof R & string;
}

export function makeListHandler<R extends Record<string, unknown>>(opts: ListHandlerOptions<R>) {
  return async (
    req: FastifyRequest<{ Querystring: PaginatedQuery }>,
    reply: FastifyReply,
  ) => {
    const page = Math.max(1, parseInt(req.query.page ?? "1", 10) || 1);
    const pageSize = Math.min(500, Math.max(1, parseInt(req.query.page_size ?? "100", 10) || 100));
    const offset = (page - 1) * pageSize;
    const sortBy = req.query.sort_by ?? "count";
    const sortOrder = req.query.sort_order ?? "desc";

    const repo = new IndexRepository(getDb());
    const total = opts.count(repo);
    const rows = opts.list(repo, offset, pageSize, sortBy, sortOrder);
    const names = rows.map(r => r[opts.nameKey] as string);
    const candidatesMap = opts.thumbCandidates(repo, names);

    const items = rows.map(r => ({
      name: r[opts.nameKey] as string,
      file_count: r.file_count,
      recommendation_score: r.avg_rec_score,
      thumbnail: resolveThumbUrl(candidatesMap.get(r[opts.nameKey] as string) ?? []),
    }));

    return reply.send({ items, page, page_size: pageSize, total });
  };
}
