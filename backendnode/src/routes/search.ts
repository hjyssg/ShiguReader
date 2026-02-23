import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getRepo, buildThumbUrl } from "./_listUtils.js";
import { parseName } from "../utils/nameParser.js";
import { compareTitles } from "../utils/titleMatcher.js";

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

// ── quick-match-batch ─────────────────────────────────────────────────────────

type MatchLevel = "downloaded" | "likely" | "same_author" | "different";

interface QuickMatchResult {
  q: string;
  match_level: MatchLevel;
  confidence: number;
  reason: string;
  hits: Array<{ name: string; match_level: MatchLevel; confidence: number }>;
}

/**
 * Extract a middle keyword from a title for DB search.
 * Takes ~12 chars from the middle to avoid event/author noise at the start.
 */
function extractTitleKeyword(title: string | null): string | null {
  if (!title || title.length < 4) return title;
  const start = Math.floor(title.length * 0.2);
  return title.slice(start, start + 12);
}

function scoreCandidate(
  queryTitle: string | null,
  queryAuthors: string[],
  queryGroup: string | null,
  candidateFilename: string,
): { authorScore: number; titleScore: number; titleReason: string; differentVolume: boolean } {
  const parsed = parseName(candidateFilename);

  // Author score
  let authorScore = 0;
  if (queryAuthors.length && parsed.authors.length) {
    const qSet = new Set(queryAuthors.map(a => a.toLowerCase()));
    const cSet = new Set(parsed.authors.map(a => a.toLowerCase()));
    const hasMatch = [...qSet].some(a => cSet.has(a));
    if (hasMatch) authorScore = 1.0;
  }
  if (authorScore === 0 && queryGroup && parsed.groupName) {
    if (queryGroup.toLowerCase() === parsed.groupName.toLowerCase()) {
      authorScore = 0.7;
    }
  }

  // Title score
  let titleScore = 0;
  let titleReason = "no title";
  let differentVolume = false;

  if (queryTitle && parsed.title) {
    const cmp = compareTitles(queryTitle, parsed.title);
    titleScore = cmp.score;
    titleReason = cmp.reason;
    differentVolume = cmp.differentVolume;
  }

  return { authorScore, titleScore, titleReason, differentVolume };
}

function decideMatchLevel(authorScore: number, titleScore: number, differentVolume: boolean): MatchLevel {
  if (authorScore >= 1.0 && titleScore >= 0.85) return "downloaded";
  if (authorScore >= 0.7 && titleScore >= 0.75) return "likely";
  if (authorScore >= 1.0 && (differentVolume || titleScore < 0.5)) return "same_author";
  if (titleScore >= 0.85) return "likely"; // strong title match even without author
  return "different";
}

async function quickMatchBatch(
  req: FastifyRequest<{
    Body: {
      queries?: string[];
      limit?: number;
      presence_filter?: string;
    };
  }>,
  reply: FastifyReply
) {
  const { queries = [], limit = 5, presence_filter = "all" } = req.body ?? {};
  if (!queries.length) return reply.send({ results: [] });

  const repo = getRepo();
  const results: QuickMatchResult[] = [];

  for (const q of queries) {
    const trimmed = (q || "").trim();
    if (!trimmed) {
      results.push({ q, match_level: "different", confidence: 0, reason: "empty query", hits: [] });
      continue;
    }

    // Parse the query
    const parsed = parseName(trimmed);
    const authorName = parsed.authors[0] ?? null;
    const titleKeyword = extractTitleKeyword(parsed.title);

    // Get candidates
    const candidates = repo.quickMatchCandidates(authorName, titleKeyword, presence_filter, limit * 4);

    if (!candidates.length) {
      results.push({ q: trimmed, match_level: "different", confidence: 0, reason: "no candidates found", hits: [] });
      continue;
    }

    // Score each candidate
    const scored = candidates.map(c => {
      const { authorScore, titleScore, titleReason, differentVolume } = scoreCandidate(
        parsed.title, parsed.authors, parsed.groupName, c.filename
      );
      const level = decideMatchLevel(authorScore, titleScore, differentVolume);
      const confidence = Math.round((authorScore * 0.4 + titleScore * 0.6) * 100) / 100;
      return { name: c.filename, match_level: level, confidence, reason: titleReason, authorScore, titleScore };
    });

    // Sort: downloaded > likely > same_author > different, then by confidence
    const levelOrder: Record<MatchLevel, number> = { downloaded: 0, likely: 1, same_author: 2, different: 3 };
    scored.sort((a, b) => levelOrder[a.match_level] - levelOrder[b.match_level] || b.confidence - a.confidence);

    const topHits = scored.slice(0, limit);
    const best = topHits[0];

    results.push({
      q: trimmed,
      match_level: best.match_level,
      confidence: best.confidence,
      reason: best.reason,
      hits: topHits.map(h => ({ name: h.name, match_level: h.match_level, confidence: h.confidence })),
    });
  }

  return reply.send({ results });
}

export { quickMatchBatch as quickMatchBatchHandler };

export async function searchRoutes(app: FastifyInstance) {
  app.post("", { schema: { summary: "搜索文件（支持文件名/作者/coser/标签）", tags: ["搜索"] } }, searchFiles);
  app.post("/quick-match-batch", { schema: { summary: "批量快速匹配（油猴脚本用）", tags: ["搜索"] } }, quickMatchBatch);
}
