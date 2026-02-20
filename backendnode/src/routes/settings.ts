import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { config } from "../config.js";

async function getSettings(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send({
    fs_roots: config.FS_ROOTS
      ? config.FS_ROOTS.split(",").map(r => r.trim()).filter(Boolean)
      : [],
    favorite_dir: config.FAVORITE_DIR || null,
    already_read_dir: config.ALREADY_READ_DIR || null,
    move_place_dir: config.MOVE_PLACE_DIR || null,
    thumb_cache_dir: config.THUMB_CACHE_DIR,
    thumb_height: config.THUMB_HEIGHT,
    thumb_jpeg_quality: config.THUMB_JPEG_QUALITY,
    thumb_concurrency: config.THUMB_CONCURRENCY,
    project_name: config.PROJECT_NAME,
    environment: config.ENVIRONMENT,
  });
}

export async function settingsRoutes(app: FastifyInstance) {
  app.get("", getSettings);
}
