import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fs from "node:fs";
import path from "node:path";
import { fileExists } from "../utils/fsUtils.js";
import { config, ENV_FILE_PATH, DB_FILE_PATH } from "../config.js";
import { getDb } from "../db/client.js";
import { IndexRepository } from "../db/repository.js";

const ENV_FILE = ENV_FILE_PATH;
const DB_FILE = DB_FILE_PATH;

function buildResponse() {
  return {
    favorite_dir: config.FAVORITE_DIR || "",
    fs_roots: config.FS_ROOTS || "",
    already_read_dir: config.ALREADY_READ_DIR || "",
    move_place_dir: config.MOVE_PLACE_DIR || "",
    env_file_path: ENV_FILE,
    db_file_path: DB_FILE,
  };
}

// GET /api/v1/settings
async function getSettings(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send(buildResponse());
}

// PUT /api/v1/settings
// Request: { favorite_dir?, fs_roots?, already_read_dir?, move_place_dir? }
async function updateSettings(
  req: FastifyRequest<{
    Body: { favorite_dir?: string | null; fs_roots?: string | null; already_read_dir?: string | null; move_place_dir?: string | null };
  }>,
  reply: FastifyReply,
) {
  const body = req.body ?? {};

  // Update process.env so config picks up new values at runtime
  if (body.favorite_dir !== undefined && body.favorite_dir !== null) {
    process.env.FAVORITE_DIR = body.favorite_dir;
  }
  if (body.fs_roots !== undefined && body.fs_roots !== null) {
    process.env.FS_ROOTS = body.fs_roots;
  }
  if (body.already_read_dir !== undefined && body.already_read_dir !== null) {
    process.env.ALREADY_READ_DIR = body.already_read_dir;
  }
  if (body.move_place_dir !== undefined && body.move_place_dir !== null) {
    process.env.MOVE_PLACE_DIR = body.move_place_dir;
  }

  // Persist to .env file if it exists
  try {
    if (fs.existsSync(ENV_FILE)) {
      let content = fs.readFileSync(ENV_FILE, "utf-8");
      const updates: Record<string, string> = {};
      if (body.favorite_dir !== undefined && body.favorite_dir !== null) {
        updates.FAVORITE_DIR = body.favorite_dir;
      }
      if (body.fs_roots !== undefined && body.fs_roots !== null) {
        updates.FS_ROOTS = body.fs_roots;
      }
      if (body.already_read_dir !== undefined && body.already_read_dir !== null) {
        updates.ALREADY_READ_DIR = body.already_read_dir;
      }
      if (body.move_place_dir !== undefined && body.move_place_dir !== null) {
        updates.MOVE_PLACE_DIR = body.move_place_dir;
      }

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
  } catch {
    /* ignore .env write errors */
  }

  // Return current values from process.env (config is frozen at startup)
  return reply.send({
    favorite_dir: process.env.FAVORITE_DIR ?? config.FAVORITE_DIR ?? "",
    fs_roots: process.env.FS_ROOTS ?? config.FS_ROOTS ?? "",
    already_read_dir: process.env.ALREADY_READ_DIR ?? config.ALREADY_READ_DIR ?? "",
    move_place_dir: process.env.MOVE_PLACE_DIR ?? config.MOVE_PLACE_DIR ?? "",
    env_file_path: ENV_FILE,
    db_file_path: DB_FILE,
  });
}

// POST /api/v1/settings/verify-files
// 计算 DB 中所有 filepath 的共同 root，遍历确认文件是否真实存在，
// 将不存在的文件标记 scan_state=0。由用户在 Settings 页手动触发。
async function verifyFiles(_req: FastifyRequest, reply: FastifyReply) {
  const repo = new IndexRepository(getDb());

  const filepaths = repo.getAllPresentFilepaths();

  if (!filepaths.length) {
    return reply.send({ status: "ok", checked: 0, missing: 0, message: "No files to verify" });
  }

  // 计算所有路径的共同 root（最长公共前缀目录）
  let commonRoot = path.dirname(filepaths[0]);
  for (const fp of filepaths) {
    const dir = path.dirname(fp);
    // 找公共前缀
    while (commonRoot && !dir.startsWith(commonRoot)) {
      commonRoot = path.dirname(commonRoot);
    }
  }

  let checked = 0;
  let missing = 0;
  const missingPaths: string[] = [];

  // Parallel file existence check
  const existResults = await Promise.all(filepaths.map(async (fp) => ({ fp, exists: await fileExists(fp) })));
  for (const { fp, exists } of existResults) {
    checked++;
    if (!exists) {
      missing++;
      missingPaths.push(fp);
    }
  }

  // 批量标记不存在的文件为 is_missing=1
  if (missingPaths.length > 0) {
    const now = Math.floor(Date.now() / 1000);
    repo.batchReconcilePresence(missingPaths.map((fp) => ({ filepath: fp, exists: false, observedAt: now })));
    try {
      repo.logActivity(
        "verify_files",
        `File verification: ${missing} missing out of ${checked}`,
        "completed",
        "verify_files",
        undefined,
        { checked, missing, common_root: commonRoot },
      );
    } catch {
      /* ignore */
    }
  }

  return reply.send({
    status: "ok",
    checked,
    missing,
    common_root: commonRoot,
    message: `Verified ${checked} files: ${missing} missing (marked scan_state=0)`,
  });
}

export async function settingsRoutes(app: FastifyInstance) {
  app.get("", { schema: { summary: "获取当前设置", tags: ["设置"] } }, getSettings);
  app.put("", { schema: { summary: "更新设置（fs_roots/favorite_dir 等）", tags: ["设置"] } }, updateSettings);
  app.post("/verify-files", { schema: { summary: "验证 DB 中文件是否存在，标记缺失", tags: ["设置"] } }, verifyFiles);
}
