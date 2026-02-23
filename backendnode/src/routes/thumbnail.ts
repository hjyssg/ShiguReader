/**
 * 按需生成 tag / author / coser 缩略图的端点。
 * GET /api/v1/thumbnail?type=tag|author|coser&name=xxx
 * 直接 stream 返回图片，供前端在 thumbnail 为 null 时懒加载。
 */
import type { FastifyInstance } from "fastify";
import fs from "node:fs";
import { getDb } from "../db/client.js";
import { IndexRepository } from "../db/repository.js";
import { getOrGenerateThumb } from "../services/thumbService.js";
import { getMimeType } from "../utils/fileType.js";

type ThumbnailQuery = { type?: string; name?: string };

export async function thumbnailRoutes(app: FastifyInstance) {
  app.get("", { schema: { summary: "按实体名获取缩略图（tag/author/coser）", tags: ["缩略图"] } }, async (req, reply) => {
    const { type, name } = req.query as ThumbnailQuery;
    if (!type || !name) {
      return reply.status(400).send({ error: "type and name are required" });
    }

    const repo = new IndexRepository(getDb());
    let candidatePath: string | null = null;

    if (type === "tag") {
      const candidates = repo.getTagThumbCandidates([name], 1);
      const paths = candidates.get(name);
      candidatePath = paths?.[0] ?? null;
    } else if (type === "author") {
      const candidates = repo.getArtistThumbCandidates([name], "", 1);
      const paths = candidates.get(name);
      candidatePath = paths?.[0] ?? null;
    } else if (type === "coser") {
      const candidates = repo.getArtistThumbCandidates([name], "coser", 1);
      const paths = candidates.get(name);
      candidatePath = paths?.[0] ?? null;
    } else {
      return reply.status(400).send({ error: "type must be tag, author, or coser" });
    }

    if (!candidatePath) {
      return reply.status(404).send({ error: "No files found for this entity" });
    }

    const thumbPath = await getOrGenerateThumb(candidatePath);
    if (!thumbPath) {
      return reply.status(404).send({ error: "Thumbnail generation failed" });
    }

    const mime = getMimeType(thumbPath);
    return reply.type(mime).send(fs.createReadStream(thumbPath));
  });
}
