import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";

const __filename = fileURLToPath(import.meta.url);
const __routeDir = path.dirname(__filename);
const ENV_FILE = path.resolve(__routeDir, "../../../.env");

function buildResponse() {
  return {
    favorite_dir: config.FAVORITE_DIR || "",
    fs_roots: config.FS_ROOTS || "",
    already_read_dir: config.ALREADY_READ_DIR || "",
    env_file_path: ENV_FILE,
  };
}

// GET /api/v1/settings
async function getSettings(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send(buildResponse());
}

// PUT /api/v1/settings
// Request: { favorite_dir?, fs_roots?, already_read_dir? }
async function updateSettings(
  req: FastifyRequest<{
    Body: { favorite_dir?: string | null; fs_roots?: string | null; already_read_dir?: string | null };
  }>,
  reply: FastifyReply
) {
  const body = req.body ?? {};

  // Update process.env so config picks up new values at runtime
  if (body.favorite_dir !== undefined && body.favorite_dir !== null) {
    process.env["FAVORITE_DIR"] = body.favorite_dir;
  }
  if (body.fs_roots !== undefined && body.fs_roots !== null) {
    process.env["FS_ROOTS"] = body.fs_roots;
  }
  if (body.already_read_dir !== undefined && body.already_read_dir !== null) {
    process.env["ALREADY_READ_DIR"] = body.already_read_dir;
  }

  // Persist to .env file if it exists
  try {
    if (fs.existsSync(ENV_FILE)) {
      let content = fs.readFileSync(ENV_FILE, "utf-8");
      const updates: Record<string, string> = {};
      if (body.favorite_dir !== undefined && body.favorite_dir !== null) updates["FAVORITE_DIR"] = body.favorite_dir;
      if (body.fs_roots !== undefined && body.fs_roots !== null) updates["FS_ROOTS"] = body.fs_roots;
      if (body.already_read_dir !== undefined && body.already_read_dir !== null) updates["ALREADY_READ_DIR"] = body.already_read_dir;

      for (const [key, val] of Object.entries(updates)) {
        const regex = new RegExp(`^${key}=.*$`, "m");
        const line = `${key}=${val}`;
        if (regex.test(content)) {
          content = content.replace(regex, line);
        } else {
          content += `\n${line}`;
        }
      }
      fs.writeFileSync(ENV_FILE, content, "utf-8");
    }
  } catch { /* ignore .env write errors */ }

  // Return current values from process.env (config is frozen at startup)
  return reply.send({
    favorite_dir: process.env["FAVORITE_DIR"] ?? config.FAVORITE_DIR ?? "",
    fs_roots: process.env["FS_ROOTS"] ?? config.FS_ROOTS ?? "",
    already_read_dir: process.env["ALREADY_READ_DIR"] ?? config.ALREADY_READ_DIR ?? "",
    env_file_path: ENV_FILE,
  });
}

export async function settingsRoutes(app: FastifyInstance) {
  app.get("", getSettings);
  app.put("", updateSettings);
}
