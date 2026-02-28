import type { FastifyInstance } from "fastify";
import { makeListHandler, EntityPageQuerySchema } from "../_listUtils.js";
import { CosersResponse } from "../../schemas/common.js";

const listCosers = makeListHandler({
  count: (repo) => repo.countArtists("coser"),
  list: (repo, offset, pageSize, sortBy, sortOrder) =>
    repo.listArtistsWithCounts(offset, pageSize, "coser", sortBy, sortOrder),
  thumbnailPaths: (repo, names) => repo.getArtistThumbnailPaths(names, "coser"),
  nameKey: "artist_name",
});

export async function cosersRoutes(app: FastifyInstance) {
  app.get("", { schema: { operationId: "listCosers", summary: "获取 Coser 列表（分页，含文件数）", tags: ["Entities"], querystring: EntityPageQuerySchema, response: { 200: CosersResponse } } }, listCosers);
}
