import fs from "node:fs";
import path from "node:path";
import { buildApp } from "./app.js";
import { initDb, getDb } from "./db/client.js";
import { IndexRepository } from "./db/repository.js";
import { config, DB_FILE_PATH } from "./config.js";
import { logger } from "./logger.js";
import { clearExtractCache } from "./services/archiveService.js";

/** good_YYYY_MM_01 — 当月第一天格式的子文件夹名 */
function monthlySubfolder(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `good_${y}_${m}_01`;
}

async function main() {
  // Init DB
  initDb(DB_FILE_PATH);

  // 写入 startup 日志，用于 listActivityLogsSinceLatestStartup 过滤本次启动后的活动
  try {
    const repo = new IndexRepository(getDb());
    repo.logActivity("startup", "Server started", "started", "startup");
  } catch {
    /* ignore */
  }

  // 启动时自动创建当月 good 子文件夹
  const favDir = config.FAVORITE_DIR?.trim();
  if (favDir) {
    const goodDir = path.join(favDir, monthlySubfolder());
    try {
      fs.mkdirSync(goodDir, { recursive: true });
      logger.startup(`Good folder ensured: ${goodDir}`);
    } catch (e) {
      logger.startup(`Failed to create good folder: ${e}`);
    }
  }

  // 启动时清除解压缓存
  try {
    logger.startup("Clearing extract cache...");
    const cacheResult = await clearExtractCache();
    logger.startup(
      `Extract cache cleared: ${cacheResult.deleted_files} files, ${cacheResult.freed_size_readable} freed`,
    );
  } catch (e) {
    logger.startup(`Failed to clear extract cache: ${e}`);
  }

  const app = buildApp();

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    logger.startup(
      `ShiguReader backend running at http://${config.HOST === "0.0.0.0" ? "localhost" : config.HOST}:${config.PORT}`,
    );
    console.log(
      `ShiguReader backend running at http://${config.HOST === "0.0.0.0" ? "localhost" : config.HOST}:${config.PORT}`,
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
