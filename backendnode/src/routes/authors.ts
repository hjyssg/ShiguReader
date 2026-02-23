import type { FastifyInstance } from "fastify";
import { makeListHandler } from "./_listUtils.js";

const listAuthors = makeListHandler({
  count: repo => repo.countArtists(""),
  list: (repo, offset, pageSize, sortBy, sortOrder) =>
    repo.listArtistsWithCounts(offset, pageSize, "", sortBy, sortOrder),
  thumbnailPaths: (repo, names) => repo.getArtistThumbnailPaths(names, ""),
  nameKey: "artist_name",
});

export async function authorsRoutes(app: FastifyInstance) {
  app.get("", { schema: { summary: "获取作者列表（分页，含文件数）", tags: ["标签/作者"] } }, listAuthors);
}
