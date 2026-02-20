import { config as loadDotenv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from project root (two levels up from src/)
loadDotenv({ path: path.resolve(__dirname, "../../.env") });

function env(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return isNaN(n) ? fallback : n;
}

export const config = {
  API_V1_STR: env("API_V1_STR", "/api/v1"),
  ENVIRONMENT: env("ENVIRONMENT", "local") as "local" | "staging" | "production",
  PORT: envInt("PORT", 8000),
  HOST: env("HOST", "0.0.0.0"),
  FRONTEND_HOST: env("FRONTEND_HOST", "http://localhost:5173"),
  BACKEND_CORS_ORIGINS: env("BACKEND_CORS_ORIGINS", ""),

  // SQLite
  INDEX_SQLITE_PATH: env("INDEX_SQLITE_PATH", "../data/index.db"),

  // File system
  FS_ROOTS: env("FS_ROOTS", ""),
  FAVORITE_DIR: env("FAVORITE_DIR", ""),
  ALREADY_READ_DIR: env("ALREADY_READ_DIR", ""),
  MOVE_PLACE_DIR: env("MOVE_PLACE_DIR", ""),

  // Thumbnails
  THUMB_CACHE_DIR: env("THUMB_CACHE_DIR", "../data/thumb_cache"),
  THUMB_CONCURRENCY: envInt("THUMB_CONCURRENCY", 3),
  THUMB_TIMEOUT_SEC: envInt("THUMB_TIMEOUT_SEC", 10),
  THUMB_HEIGHT: envInt("THUMB_HEIGHT", 350),
  THUMB_JPEG_QUALITY: envInt("THUMB_JPEG_QUALITY", 70),

  PROJECT_NAME: env("PROJECT_NAME", "ShiguReader"),
} as const;

export type Config = typeof config;
