import { buildApp } from "./app.js";
import { initDb, getDb } from "./db/client.js";
import { IndexRepository } from "./db/repository.js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { clearExtractCache } from "./services/archiveService.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  // Init DB
  const dbPath = path.resolve(__dirname, "../../", config.INDEX_SQLITE_PATH);
  initDb(dbPath);

  // 写入 startup 日志，用于 listActivityLogsSinceLatestStartup 过滤本次启动后的活动
  try {
    const repo = new IndexRepository(getDb());
    repo.logActivity("startup", "Server started", "started", "startup");
  } catch { /* ignore */ }

  // 启动时清除解压缓存
  try {
    logger.startup("Clearing extract cache...");
    const cacheResult = clearExtractCache();
    logger.startup(`Extract cache cleared: ${cacheResult.deleted_files} files, ${cacheResult.freed_size_readable} freed`);
  } catch (e) {
    logger.startup(`Failed to clear extract cache: ${e}`);
  }

  const app = buildApp();

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    logger.startup(`ShiguReader backend running at http://${config.HOST === "0.0.0.0" ? "localhost" : config.HOST}:${config.PORT}`);
    console.log(`ShiguReader backend running at http://${config.HOST === "0.0.0.0" ? "localhost" : config.HOST}:${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
