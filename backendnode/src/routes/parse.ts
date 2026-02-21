import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import path from "node:path";
import { parseName } from "../utils/nameParser.js";
import { getRepo } from "./_listUtils.js";

// GET /api/v1/parse?filepath=...
// Returns StoredParseResponse shape
async function parseSingle(
  req: FastifyRequest<{ Querystring: { filepath?: string } }>,
  reply: FastifyReply
) {
  const { filepath } = req.query;
  if (!filepath) return reply.status(400).send({ error: "filepath is required" });

  // Try DB first
  try {
    const repo = getRepo();
    const stored = repo.getParsedMetadata(filepath);
    if (stored) {
      // Also fetch authors, cosers, raw_tags from relational tables
      const authors = repo.getFileArtists(filepath);
      const cosers = repo.getFileCosers(filepath);
      const rawTags = repo.getFileTags(filepath);
      return reply.send({
        filepath,
        title: stored.title ?? null,
        authors,
        cosers,
        group_name: stored.group_name ?? null,
        raw_tags: rawTags,
        event: stored.event ?? null,
        date_tag: stored.date_tag ?? null,
        media_type: stored.media_type ?? null,
      });
    }
  } catch { /* fall through to live parse */ }

  // Fallback: live parse from filename
  const base = path.basename(filepath);
  const parsed = parseName(base);
  return reply.send({
    filepath,
    title: parsed.title ?? null,
    authors: parsed.authors ?? [],
    cosers: parsed.cosers ?? [],
    group_name: parsed.groupName ?? null,
    raw_tags: parsed.rawTags ?? [],
    event: parsed.event ?? null,
    date_tag: parsed.dateTag ?? null,
    media_type: parsed.mediaType ?? null,
  });
}

// POST /api/v1/parse/batch
// Request: { filepaths: string[] }
// Returns BatchParseResponse with result fields matching ParseResponse (snake_case)
async function parseBatch(
  req: FastifyRequest<{ Body: { filepaths?: string[]; filenames?: string[] } }>,
  reply: FastifyReply
) {
  // Accept both filepaths (new) and filenames (legacy)
  const filepaths = req.body?.filepaths ?? req.body?.filenames ?? [];
  const items: Array<{ filepath: string; result: object | null }> = [];

  for (const fp of filepaths) {
    const base = path.basename(fp);
    const parsed = parseName(base);
    // Map to ParseResponse shape (snake_case, matching frontend types.gen.ts)
    items.push({
      filepath: fp,
      result: parsed ? {
        title: parsed.title ?? "",
        authors: parsed.authors ?? [],
        cosers: parsed.cosers ?? [],
        group: parsed.groupName ?? null,
        raw_tags: parsed.rawTags ?? [],
        event: parsed.event ?? null,
        date_tag: parsed.dateTag ?? null,
        type: parsed.mediaType ?? "unknown",
        pack_kind: undefined,
      } : null,
    });
  }

  return reply.send({
    items,
    parsed_count: items.filter(i => i.result !== null).length,
    total_count: filepaths.length,
  });
}

export async function parseRoutes(app: FastifyInstance) {
  app.get("", parseSingle);
  app.post("/batch", parseBatch);
}
