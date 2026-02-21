import type { FastifyRequest, FastifyReply } from "fastify";
import { getDb } from "../db/client.js";
import { IndexRepository } from "../db/repository.js";
import { config } from "../config.js";

export function buildThumbUrl(filePath: string): string {
  return `${config.API_V1_STR}/fs/thumb?path=${encodeURIComponent(filePath)}`;
}

type PaginatedQuery = { page?: string; page_size?: string; sort_by?: string; sort_order?: string };

interface ListHandlerOptions<R extends Record<string, unknown>> {
  count: (repo: IndexRepository) => number;
  list: (repo: IndexRepository, offset: number, pageSize: number, sortBy: string, sortOrder: string) => R[];
  /** Returns a map of name → cached thumbnail_filepath (DB only, no file I/O). */
  thumbnailPaths: (repo: IndexRepository, names: string[]) => Map<string, string>;
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
    const thumbMap = opts.thumbnailPaths(repo, names);

    const items = rows.map(r => {
      const name = r[opts.nameKey] as string;
      const thumbPath = thumbMap.get(name);
      return {
        name,
        file_count: r.file_count,
        recommendation_score: r.avg_rec_score,
        thumbnail: thumbPath ? buildThumbUrl(thumbPath) : null,
      };
    });

    return reply.send({ items, page, page_size: pageSize, total });
  };
}
