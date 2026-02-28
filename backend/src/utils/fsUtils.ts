import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config, resolveProjectPath } from "../config.js";

/**
 * Returns true if the path is accessible with the given mode, false otherwise.
 * Replaces the verbose try/catch(fs.promises.access) pattern throughout the codebase.
 */
export async function fileExists(filePath: string, mode = fs.constants.F_OK): Promise<boolean> {
  try {
    await fs.promises.access(filePath, mode);
    return true;
  } catch {
    return false;
  }
}

/** Returns absolute path for project-scoped temp cache directory. */
export function getTmpCacheDir(): string {
  return resolveProjectPath(config.TMP_CACHE_DIR);
}

/** Ensures project-scoped temp cache directory exists. */
export async function ensureTmpCacheDir(): Promise<string> {
  const dir = getTmpCacheDir();
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
}

/** Creates a temp working directory under project temp cache dir. */
export async function createTmpWorkDir(prefix: string): Promise<string> {
  const base = await ensureTmpCacheDir();
  return fs.promises.mkdtemp(path.join(base, prefix));
}

/** Creates a unique temp file path under project temp cache dir. */
export async function createTmpFilePath(prefix: string, ext = ""): Promise<string> {
  const base = await ensureTmpCacheDir();
  const random = crypto.randomBytes(6).toString("hex");
  const cleanExt = ext && !ext.startsWith(".") ? `.${ext}` : ext;
  return path.join(base, `${prefix}${Date.now()}-${random}${cleanExt}`);
}
