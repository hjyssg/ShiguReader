import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Static } from "@sinclair/typebox";
import path from "node:path";
import { getRepo, buildThumbUrl } from "./_listUtils.js";
import { config, resolveProjectPath } from "../config.js";
import { getFileType } from "../../../common/src/fileTypeUtil.js";
import { Type } from "@sinclair/typebox";
import { HistoryListResponse, HistoryRecordRequest, HistoryRecordResponse } from "../schemas/common.js";

const ListHistoryQuery = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  page_size: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
  sort_order: Type.Optional(Type.Union([Type.Literal("asc"), Type.Literal("desc")])),
});

function isPathInside(targetPath: string, parentPath: string): boolean {
  const target = path.resolve(targetPath);
  const parent = path.resolve(parentPath);
  if (target === parent) return true;
  const normalizedTarget = process.platform === "win32" ? target.toLowerCase() : target;
  const normalizedParent = process.platform === "win32" ? parent.toLowerCase() : parent;
  return normalizedTarget.startsWith(`${normalizedParent}${path.sep}`);
}

function shouldSkipHistoryRecord(filepath: string): boolean {
  // 跳过 extract cache 和 thumb cache 目录下的文件
  const extractCacheDir = resolveProjectPath(config.EXTRACT_CACHE_DIR);
  const thumbCacheDir = resolveProjectPath(config.THUMB_CACHE_DIR);
  if (isPathInside(filepath, extractCacheDir) || isPathInside(filepath, thumbCacheDir)) {
    return true;
  }

  // 跳过单张图片文件（sibling 模式打开，不应记录历史）
  if (getFileType(filepath) === "image") {
    return true;
  }

  return false;
}

async function listHistory(
  req: FastifyRequest<{ Querystring: { page?: number; page_size?: number; sort_order?: string } }>,
  reply: FastifyReply,
) {
  const page = Math.max(1, req.query.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, req.query.page_size ?? 50));
  const offset = (page - 1) * pageSize;
  const sortOrder = req.query.sort_order === "asc" ? "asc" : "desc";

  const repo = getRepo();
  const total = repo.countReadHistory();
  const totalPages = Math.ceil(total / pageSize);
  const rows = repo.listReadHistory(offset, pageSize, sortOrder);

  return reply.send({
    items: rows.map((r) => ({
      id: r.id,
      filepath: r.filepath,
      filename: r.filename ?? null,
      file_type: r.file_type ?? null,
      thumbnail_url: r.thumbnail_filepath
        ? buildThumbUrl(r.thumbnail_filepath)
        : r.filepath
          ? buildThumbUrl(r.filepath)
          : null,
      opened_at: r.opened_at,
    })),
    page,
    page_size: pageSize,
    total,
    total_pages: totalPages,
  });
}

async function recordHistory(
  req: FastifyRequest<{ Body: Static<typeof HistoryRecordRequest> }>,
  reply: FastifyReply,
) {
  const body = req.body ?? ({} as Static<typeof HistoryRecordRequest>);
  if (!body.filepath) {
    return reply.status(400).send({ error: "filepath is required" });
  }
  if (shouldSkipHistoryRecord(body.filepath)) {
    return reply.send({ status: "skipped", reason: "cache_path" });
  }
  const repo = getRepo();
  repo.recordRead(body.filepath);
  return reply.send({ status: "ok" });
}

export async function historyRoutes(app: FastifyInstance) {
  app.get("/list", {
    schema: {
      operationId: "listHistory",
      summary: "获取阅读历史列表（分页）",
      tags: ["History"],
      querystring: ListHistoryQuery,
      response: { 200: HistoryListResponse },
    },
  }, listHistory);

  app.post("/record", {
    schema: {
      operationId: "recordHistory",
      summary: "记录一次阅读",
      tags: ["History"],
      body: HistoryRecordRequest,
      response: { 200: HistoryRecordResponse },
    },
  }, recordHistory);
}
