import type { FastifyInstance } from "fastify";
import { makeListHandler } from "./_listUtils.js";

const listAuthors = makeListHandler({
  count: repo => repo.countArtists(""),
  list: (repo, offset, pageSize, sortBy, sortOrder) =>
    repo.listArtistsWithCounts(offset, pageSize, "", sortBy, sortOrder),
  thumbCandidates: (repo, names) => repo.getArtistThumbCandidates(names, ""),
  nameKey: "artist_name",
});

export async function authorsRoutes(app: FastifyInstance) {
  app.get("", listAuthors);
}
