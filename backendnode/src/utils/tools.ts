/**
 * Shared tool resolution — bundled exe → PATH fallback.
 * All services/routes should import from here instead of duplicating.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// src/utils/ → ../.. → backendnode/tools/
export const TOOLS_DIR = path.resolve(__dirname, "../../tools");

function resolveTool(subpath: string, fallback: string): string {
  const bundled = path.join(TOOLS_DIR, subpath);
  return fs.existsSync(bundled) ? bundled : fallback;
}

export function get7z(): string {
  return resolveTool("7zip-lite/7z.exe", "7z");
}

export function getMagick(): string {
  return resolveTool("imagemagick/magick.exe", "magick");
}

export function getFfmpeg(): string {
  return resolveTool("ffmpeg/ffmpeg.exe", "ffmpeg");
}
