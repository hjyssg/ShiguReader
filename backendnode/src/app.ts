import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import staticPlugin from "@fastify/static";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fsRoutes } from "./routes/fs.js";
import { searchRoutes, quickMatchBatchHandler } from "./routes/search.js";
import { historyRoutes } from "./routes/history.js";
import { tagsRoutes } from "./routes/tags.js";
import { authorsRoutes } from "./routes/authors.js";
import { cosersRoutes } from "./routes/cosers.js";
import { settingsRoutes } from "./routes/settings.js";
import { parseRoutes } from "./routes/parse.js";
import { thumbnailRoutes } from "./routes/thumbnail.js";
import { config } from "./config.js";
import { getOrGenerateThumb } from "./services/thumbService.js";
import { getDb } from "./db/client.js";
import { IndexRepository } from "./db/repository.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function buildApp() {
  const app = Fastify({
    logger: { level: "warn" }, // 只保留 warn/error，屏蔽每次请求的 info 日志
  });

  // ── CORS ──────────────────────────────────────────────────────────────────
  app.register(cors, { origin: true, credentials: true });

  // ── Swagger (API docs like FastAPI) ────────────────────────────────────────
  app.register(swagger, {
    openapi: {
      info: {
        title: "ShiguReader API",
        description: "ShiguReader backend API — 类似 FastAPI 的交互式文档",
        version: "1.0.0",
      },
      servers: [{ url: `http://localhost:${config.PORT}` }],
    },
  });
  app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });

  // ── @fastify/static — 注册 reply.sendFile() 装饰器 ────────────────────────
  // serve: false → 不自动托管文件，仅提供 reply.sendFile(basename, dirname)
  app.register(staticPlugin, {
    root: path.resolve(__dirname),   // 占位 root，实际调用时都会传 dirname 覆盖
    serve: false,
  });

  // ── API routes ─────────────────────────────────────────────────────────────
  app.register(fsRoutes,       { prefix: `${config.API_V1_STR}/fs` });
  app.register(searchRoutes,   { prefix: `${config.API_V1_STR}/search` });
  app.register(historyRoutes,  { prefix: `${config.API_V1_STR}/history` });
  app.register(tagsRoutes,     { prefix: `${config.API_V1_STR}/tags` });
  app.register(authorsRoutes,  { prefix: `${config.API_V1_STR}/authors` });
  app.register(cosersRoutes,   { prefix: `${config.API_V1_STR}/cosers` });
  app.register(settingsRoutes, { prefix: `${config.API_V1_STR}/settings` });
  app.register(parseRoutes,    { prefix: `${config.API_V1_STR}/parse` });
  app.register(thumbnailRoutes, { prefix: `${config.API_V1_STR}/thumbnail` });

  // ── Thumbnail endpoint ─────────────────────────────────────────────────────
  // GET /api/v1/fs/thumb?path=<absolute-path>
  app.get(`${config.API_V1_STR}/fs/thumb`, { schema: { summary: "获取文件缩略图", tags: ["缩略图"] } }, async (req, reply) => {
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

    return reply.sendFile(path.basename(src), path.dirname(src));
  });

  // ── Compatibility aliases (Tampermonkey script uses /api/search/...) ───────
  app.post("/api/search/quick-match-batch", { schema: { summary: "批量快速匹配（兼容别名，油猴脚本用）", tags: ["搜索"] } }, quickMatchBatchHandler);

  // ── Global error handler (dev-friendly: includes stack trace) ─────────────
  app.setErrorHandler((error: Error & { statusCode?: number }, _req, reply) => {
    const status = error.statusCode ?? 500;
    reply.status(status).send({
      error: error.message,
      stack: error.stack,
    });
  });

  // ── Health ─────────────────────────────────────────────────────────────────
  app.get("/health", { schema: { summary: "健康检查", tags: ["系统"] } }, async () => ({ status: "ok", project: config.PROJECT_NAME }));
  // Frontend SDK calls /api/v1/utils/health-check/
  app.get(`${config.API_V1_STR}/utils/health-check/`, { schema: { summary: "前端 SDK 健康检查", tags: ["系统"] } }, async () => true);

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
