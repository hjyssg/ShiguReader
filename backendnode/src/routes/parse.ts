import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import path from "node:path";
import { parseName } from "../utils/nameParser.js";

async function parseSingle(
  req: FastifyRequest<{ Querystring: { filename?: string; filepath?: string } }>,
  reply: FastifyReply
) {
  const input = req.query.filepath ?? req.query.filename;
  if (!input) return reply.status(400).send({ error: "filepath is required" });
  const base = path.basename(input);
  return reply.send(parseName(base));
}

async function parseBatch(
  req: FastifyRequest<{ Body: { filenames: string[] } }>,
  reply: FastifyReply
) {
  const { filenames = [] } = req.body ?? {};
  const results: Record<string, ReturnType<typeof parseName>> = {};
  for (const f of filenames) {
    results[f] = parseName(path.basename(f));
  }
  return reply.send(results);
}

export async function parseRoutes(app: FastifyInstance) {
  app.get("", parseSingle);
  app.post("/batch", parseBatch);
}
