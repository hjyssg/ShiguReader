import type { FastifyInstance } from "fastify";
import { makeListHandler } from "./_listUtils.js";

const listCosers = makeListHandler({
  count: repo => repo.countArtists("coser"),
  list: (repo, offset, pageSize, sortBy, sortOrder) =>
    repo.listArtistsWithCounts(offset, pageSize, "coser", sortBy, sortOrder),
  thumbnailPaths: (repo, names) => repo.getArtistThumbnailPaths(names, "coser"),
  nameKey: "artist_name",
});

export async function cosersRoutes(app: FastifyInstance) {
  app.get("", { schema: { summary: "获取 Coser 列表（分页，含文件数）", tags: ["标签/作者"] } }, listCosers);
}
