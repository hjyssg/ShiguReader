import type { FastifyInstance } from "fastify";
import {
  getRoots,
  getDrives,
  listDirectory,
  getLibraryOverview,
  getRecentActivity,
  getTopOpenedFolders,
} from "./fsDirectory.js";
import { scanDirectory, scanFavorite, getScanStatus, scanWatch, backfill } from "./fsScan.js";
import {
  moveFile,
  moveFolder,
  deleteItem,
  renameItem,
  downloadFile,
  downloadFileFull,
  serveFile,
  ensureDir,
  resolvePath,
} from "./fsFileOps.js";
import {
  listArchive,
  extractArchive,
  getArchiveFile,
  clearExtractCache,
  compressImages,
  zipFolder,
  unzip,
} from "./fsArchive.js";

export async function fsRoutes(app: FastifyInstance) {
  // ── 目录 / 信息 ──────────────────────────────────────────────────────────
  app.get("/roots", { schema: { summary: "获取配置的根目录列表", tags: ["文件系统"] } }, getRoots);
  app.get("/drives", { schema: { summary: "获取系统盘符 (Windows)", tags: ["文件系统"] } }, getDrives);
  app.get("/listdir", { schema: { summary: "列出目录内容（文件+文件夹）", tags: ["文件系统"] } }, listDirectory);
  app.get("/library-overview", { schema: { summary: "获取库概览统计", tags: ["文件系统"] } }, getLibraryOverview);
  app.get("/recent-activity", { schema: { summary: "获取最近活动日志", tags: ["文件系统"] } }, getRecentActivity);
  app.get(
    "/top-opened-folders",
    { schema: { summary: "获取最常打开的文件夹", tags: ["文件系统"] } },
    getTopOpenedFolders,
  );

  // ── 扫描 ─────────────────────────────────────────────────────────────────
  app.post("/scan", { schema: { summary: "扫描目录并索引文件", tags: ["扫描"] } }, scanDirectory);
  app.post("/scan-favorite", { schema: { summary: "扫描收藏目录", tags: ["扫描"] } }, scanFavorite);
  app.post("/generate", { schema: { summary: "生成元数据和缩略图", tags: ["扫描"] } }, backfill);
  app.post("/scan-and-watch", { schema: { summary: "扫描并启动目录文件监听", tags: ["扫描"] } }, scanWatch);
  app.get("/scan-status", { schema: { summary: "查询扫描任务状态", tags: ["扫描"] } }, getScanStatus);

  // ── 文件操作 ─────────────────────────────────────────────────────────────
  app.post("/move-file", { schema: { summary: "移动文件", tags: ["文件操作"] } }, moveFile);
  app.post("/move-folder", { schema: { summary: "移动文件夹", tags: ["文件操作"] } }, moveFolder);
  app.delete("/delete", { schema: { summary: "删除文件或文件夹（回收站/永久）", tags: ["文件操作"] } }, deleteItem);
  app.post("/rename", { schema: { summary: "重命名文件或文件夹", tags: ["文件操作"] } }, renameItem);
  app.get("/download", { schema: { summary: "下载文件（attachment）", tags: ["文件操作"] } }, downloadFile);
  app.get(
    "/download-full",
    { schema: { summary: "下载完整文件（带 Content-Length）", tags: ["文件操作"] } },
    downloadFileFull,
  );
  app.get("/file", { schema: { summary: "直接返回文件流（inline）", tags: ["文件操作"] } }, serveFile);
  app.post("/mkdir", { schema: { summary: "创建目录（递归）", tags: ["文件操作"] } }, ensureDir);
  app.get("/resolve-path", { schema: { summary: "解析路径并检查是否存在", tags: ["文件操作"] } }, resolvePath);

  // ── 压缩包 ───────────────────────────────────────────────────────────────
  app.post("/zip-folder", { schema: { summary: "将文件夹压缩为 zip", tags: ["压缩包"] } }, zipFolder);
  app.post("/unzip", { schema: { summary: "解压压缩包到目录", tags: ["压缩包"] } }, unzip);
  app.get("/archive/list", { schema: { summary: "列出压缩包内文件条目", tags: ["压缩包"] } }, listArchive);
  app.post("/archive/extract", { schema: { summary: "分步解压压缩包（按页）", tags: ["压缩包"] } }, extractArchive);
  app.get("/archive/file", { schema: { summary: "获取压缩包内单个文件", tags: ["压缩包"] } }, getArchiveFile);
  app.delete("/clean-extract-cache", { schema: { summary: "清除解压缓存", tags: ["压缩包"] } }, clearExtractCache);
  app.post(
    "/archive/compress-images",
    { schema: { summary: "压缩包内图片批量压缩", tags: ["压缩包"] } },
    compressImages,
  );
}
