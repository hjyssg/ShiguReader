/**
 * 跨 route 共享的分页列表工具函数。
 *
 * 提供：
 *   - buildThumbUrl：根据文件路径生成缩略图 API URL
 *   - getRepo：创建 IndexRepository 实例的工厂函数（避免各 route 重复定义）
 *   - makeListHandler：生成标准分页列表 Fastify handler（用于 tags / authors / cosers 等列表接口）
 */
import type { FastifyRequest, FastifyReply } from "fastify";
import { getDb } from "../db/client.js";
import { IndexRepository } from "../db/repository.js";
import { config } from "../config.js";

/** 创建一个绑定到当前请求 DB 连接的 IndexRepository 实例 */
export function getRepo(): IndexRepository {
  return new IndexRepository(getDb());
}

/** 根据文件绝对路径生成缩略图 API URL，供前端直接使用 */
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

/**
 * 生成标准分页列表 Fastify handler。
 * 封装了分页参数解析、DB 查询、缩略图 URL 拼接和响应格式化，
 * 供 tags / authors / cosers 等列表路由复用。
 */
export function makeListHandler<R extends Record<string, unknown>>(opts: ListHandlerOptions<R>) {
  return async (req: FastifyRequest<{ Querystring: PaginatedQuery }>, reply: FastifyReply) => {
    const page = Math.max(1, parseInt(req.query.page ?? "1", 10) || 1);
    const pageSize = Math.min(500, Math.max(1, parseInt(req.query.page_size ?? "100", 10) || 100));
    const offset = (page - 1) * pageSize;
    const sortBy = req.query.sort_by ?? "count";
    const sortOrder = req.query.sort_order ?? "desc";

    const repo = new IndexRepository(getDb());
    const total = opts.count(repo);
    const rows = opts.list(repo, offset, pageSize, sortBy, sortOrder);
    const names = rows.map((r) => r[opts.nameKey] as string);
    const thumbMap = opts.thumbnailPaths(repo, names);

    const items = rows.map((r) => {
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
