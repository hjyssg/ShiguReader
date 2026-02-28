import type { FastifyInstance } from "fastify";
import { makeListHandler, EntityPageQuerySchema } from "../_listUtils.js";
import { TagsResponse } from "../../schemas/common.js";

const listTags = makeListHandler({
  count: (repo) => repo.countTags(),
  list: (repo, offset, pageSize, sortBy, sortOrder) => repo.listTagsWithCounts(offset, pageSize, sortBy, sortOrder),
  thumbnailPaths: (repo, names) => repo.getTagThumbnailPaths(names),
  nameKey: "tag_name",
});

export async function tagsRoutes(app: FastifyInstance) {
  app.get("", {
    schema: {
      operationId: "listTags",
      summary: "获取标签列表（分页，含文件数）",
      tags: ["Entities"],
      querystring: EntityPageQuerySchema,
      response: { 200: TagsResponse },
    },
  }, listTags);
}
