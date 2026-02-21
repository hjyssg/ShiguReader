import Fastify from "fastify";
import cors from "@fastify/cors";
import staticPlugin from "@fastify/static";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fsRoutes } from "./routes/fs.js";
import { searchRoutes } from "./routes/search.js";
import { historyRoutes } from "./routes/history.js";
import { tagsRoutes } from "./routes/tags.js";
import { authorsRoutes } from "./routes/authors.js";
import { cosersRoutes } from "./routes/cosers.js";
import { settingsRoutes } from "./routes/settings.js";
import { parseRoutes } from "./routes/parse.js";
import { config } from "./config.js";
import { getOrGenerateThumb } from "./services/thumbService.js";
import { getMimeType } from "./utils/fileType.js";
import { getDb } from "./db/client.js";
import { IndexRepository } from "./db/repository.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function buildApp() {
  const app = Fastify({
    logger: { level: "warn" }, // 只保留 warn/error，屏蔽每次请求的 info 日志
  });

  // ── CORS ──────────────────────────────────────────────────────────────────
  app.register(cors, { origin: true, credentials: true });

  // ── API routes ─────────────────────────────────────────────────────────────
  app.register(fsRoutes,       { prefix: `${config.API_V1_STR}/fs` });
  app.register(searchRoutes,   { prefix: `${config.API_V1_STR}/search` });
  app.register(historyRoutes,  { prefix: `${config.API_V1_STR}/history` });
  app.register(tagsRoutes,     { prefix: `${config.API_V1_STR}/tags` });
  app.register(authorsRoutes,  { prefix: `${config.API_V1_STR}/authors` });
  app.register(cosersRoutes,   { prefix: `${config.API_V1_STR}/cosers` });
  app.register(settingsRoutes, { prefix: `${config.API_V1_STR}/settings` });
  app.register(parseRoutes,    { prefix: `${config.API_V1_STR}/parse` });

  // ── Thumbnail endpoint ─────────────────────────────────────────────────────
  // GET /api/v1/fs/thumb?path=<absolute-path>
  app.get(`${config.API_V1_STR}/fs/thumb`, async (req, reply) => {
    const { path: filePath } = req.query as { path?: string };
    if (!filePath) return reply.status(400).send({ error: "path is required" });

    // Try the requested path first
    let resolvedPath = filePath;

    // If file doesn't exist, fallback: find by filename in DB
    if (!fs.existsSync(filePath)) {
      try {
        const repo = new IndexRepository(getDb());
        const filename = path.basename(filePath);
        const matches = repo.findFilesByFilename(filename, filePath, 1);
        if (matches.length > 0) {
          resolvedPath = matches[0].filepath;
        } else {
          return reply.status(404).send({ error: "File not found" });
        }
      } catch {
        return reply.status(404).send({ error: "File not found" });
      }
    }

    const src = await getOrGenerateThumb(resolvedPath);
    if (!src) return reply.status(404).send({ error: "Thumbnail not found" });

    const mime = getMimeType(src);
    return reply.type(mime).send(fs.createReadStream(src));
  });

  // ── Health ─────────────────────────────────────────────────────────────────
  app.get("/health", async () => ({ status: "ok", project: config.PROJECT_NAME }));
  // Frontend SDK calls /api/v1/utils/health-check/
  app.get(`${config.API_V1_STR}/utils/health-check/`, async () => true);

  // ── Serve frontend static build ────────────────────────────────────────────
  // Looks for ../frontend/dist relative to this file (dev) or dist/ (built)
  const frontendDist = path.resolve(__dirname, "../../frontend/dist");
  if (fs.existsSync(frontendDist)) {
    app.register(staticPlugin, {
      root: frontendDist,
      prefix: "/",
      // SPA fallback: serve index.html for unknown routes
      decorateReply: false,
    });

    // SPA catch-all — must be registered after static plugin
    app.setNotFoundHandler((_req, reply) => {
      const indexPath = path.join(frontendDist, "index.html");
      if (fs.existsSync(indexPath)) {
        return reply.type("text/html").send(fs.createReadStream(indexPath));
      }
      return reply.status(404).send({ error: "Not found" });
    });
  } else {
    app.setNotFoundHandler((_req, reply) => {
      return reply.status(404).send({ error: "Not found" });
    });
  }

  return app;
}
