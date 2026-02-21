import type { FastifyInstance } from "fastify";
import { makeListHandler } from "./_listUtils.js";

const listTags = makeListHandler({
  count: repo => repo.countTags(),
  list: (repo, offset, pageSize, sortBy, sortOrder) =>
    repo.listTagsWithCounts(offset, pageSize, sortBy, sortOrder),
  thumbCandidates: (repo, names) => repo.getTagThumbCandidates(names),
  nameKey: "tag_name",
});

export async function tagsRoutes(app: FastifyInstance) {
  app.get("", listTags);
}
