import { buildApp } from "./app.js";
import { initDb, getDb } from "./db/client.js";
import { IndexRepository } from "./db/repository.js";
import { config } from "./config.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  // Init DB
  const dbPath = path.resolve(__dirname, "../../", config.INDEX_SQLITE_PATH);
  initDb(dbPath);

  // 启动前清理解压缓存，避免复用旧缓存导致 reader / explorer 状态不一致
  try {
    const { clearExtractCache } = await import("./services/archiveService.js");
    const cacheResult = clearExtractCache();
    console.log(`[startup] extract cache cleared: files=${cacheResult.deleted_files}, freed=${cacheResult.freed_size_readable}`);
  } catch (error) {
    console.log(`[startup] clear extract cache failed: ${error}`);
  }

  // 写入 startup 日志，用于 listActivityLogsSinceLatestStartup 过滤本次启动后的活动
  try {
    const repo = new IndexRepository(getDb());
    repo.logActivity("startup", "Server started", "started", "startup");
    console.log("[startup] activity log inserted");
  } catch (error) {
    console.log(`[startup] failed to write activity log: ${error}`);
  }

  const app = buildApp();

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    console.log(`ShiguReader backend running at http://${config.HOST === "0.0.0.0" ? "localhost" : config.HOST}:${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
