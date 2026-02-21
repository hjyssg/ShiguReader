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

function toItem(row: { filepath: string; filename: string; file_type: string; filesize: number | null; mtime: number | null }) {
  const thumbUrl = ["archive", "video", "image"].includes(row.file_type)
    ? buildThumbUrl(row.filepath)
    : null;
  return {
    name: row.filename,
    path: row.filepath,
    item_type: "file",
    file_type: row.file_type,
    filesize: row.filesize,
    mtime: row.mtime,
    thumbnail_url: thumbUrl,
  };
}

async function searchFiles(
  req: FastifyRequest<{
    Body: {
      q?: string;
      scopes?: string[];
      presence_filter?: string;
      limit?: number;
      offset?: number;
    };
  }>,
  reply: FastifyReply
) {
  const { q = "", scopes = ["file", "author", "coser", "tag"], presence_filter = "all" } = req.body ?? {};
  const limit = Math.min(500, Math.max(1, req.body?.limit ?? 200));
  const offset = Math.max(0, req.body?.offset ?? 0);
  const query = q.trim();
  if (!query) return reply.send({ items: [], total: 0 });

  const repo = getRepo();
  const byPath = new Map<string, ReturnType<typeof toItem>>();

  if (scopes.includes("file")) {
    for (const row of repo.searchFiles(query, presence_filter)) byPath.set(row.filepath, toItem(row));
  }
  if (scopes.includes("author")) {
    for (const row of repo.searchByAuthor(query, presence_filter)) byPath.set(row.filepath, toItem(row));
  }
  if (scopes.includes("coser")) {
    for (const row of repo.searchByCoser(query, presence_filter)) byPath.set(row.filepath, toItem(row));
  }
  if (scopes.includes("tag")) {
    for (const row of repo.searchByTag(query, presence_filter)) byPath.set(row.filepath, toItem(row));
  }

  const allItems = [...byPath.values()].sort((a, b) => a.name.localeCompare(b.name));
  const total = allItems.length;
  const items = allItems.slice(offset, offset + limit);
  return reply.send({ items, total });
}

export async function searchRoutes(app: FastifyInstance) {
  app.post("", searchFiles);
}
