import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import {
  getRoots,
  getDrives,
  listDirectory,
  getLibraryOverview,
  getRecentActivity,
  getTopOpenedFolders,
} from "./fsDirectory.js";
import { scanDirectory, scanFavorite, getScanStatus, scanAndWatch, backfill } from "./fsScan.js";
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
import {
  RootItem,
  ListResponse,
  PathOperationResponse,
  ScanRequest,
  ScanStartResponse,
  ScanStatusItem,
  BackfillRequest,
  BackfillResponse,
  MovePathRequest,
  DeletePathRequest,
  RenameRequest,
  MkdirRequest,
  ResolvePathResponse,
  ZipFolderRequest,
  UnzipRequest,
  ArchiveListResponse,
  ExtractStatus,
  ClearCacheResponse,
  CompressImagesRequest,
  CompressImagesResponse,
  ListDirQuery,
  RecentActivityQuery,
  TopFoldersQuery,
  ScanStatusQuery,
  PathQuery,
  ArchiveFileQuery,
  ExtractQuery,
  LibraryOverviewResponse,
  RecentActivityResponse,
  TopFoldersResponse,
  MkdirResponse,
} from "../schemas/common.js";

export async function fsRoutes(app: FastifyInstance) {
  // ── 目录 / 信息 ──────────────────────────────────────────────────────────
  app.get("/roots", { schema: { operationId: "getRoots", summary: "获取配置的根目录列表", tags: ["Filesystem"], response: { 200: Type.Array(Type.Ref(RootItem)) } } }, getRoots);
  app.get("/drives", { schema: { operationId: "getDrives", summary: "获取系统盘符 (Windows)", tags: ["Filesystem"], response: { 200: Type.Array(Type.Ref(RootItem)) } } }, getDrives);
  app.get("/listdir", { schema: { operationId: "listDirectory", summary: "列出目录内容（文件+文件夹）", tags: ["Filesystem"], querystring: ListDirQuery, response: { 200: ListResponse } } }, listDirectory);
  app.get("/library-overview", { schema: { operationId: "getLibraryOverview", summary: "获取库概览统计", tags: ["Filesystem"], response: { 200: LibraryOverviewResponse } } }, getLibraryOverview);
  app.get("/recent-activity", { schema: { operationId: "getRecentActivity", summary: "获取最近活动日志", tags: ["Filesystem"], querystring: RecentActivityQuery, response: { 200: RecentActivityResponse } } }, getRecentActivity);
  app.get("/top-opened-folders", { schema: { operationId: "getTopOpenedFolders", summary: "获取最常打开的文件夹", tags: ["Filesystem"], querystring: TopFoldersQuery, response: { 200: TopFoldersResponse } } }, getTopOpenedFolders);

  // ── 扫描 ─────────────────────────────────────────────────────────────────
  app.post("/scan", { schema: { operationId: "scanDirectory", summary: "扫描目录并索引文件", tags: ["Filesystem"], body: ScanRequest, response: { 200: ScanStartResponse } } }, scanDirectory);
  app.post("/scan-favorite", { schema: { operationId: "scanFavorite", summary: "扫描收藏目录", tags: ["Filesystem"], response: { 200: ScanStartResponse } } }, scanFavorite);
  app.post("/generate", { schema: { operationId: "backfill", summary: "生成元数据和缩略图", tags: ["Filesystem"], body: BackfillRequest, response: { 200: BackfillResponse } } }, backfill);
  app.post("/scan-and-watch", { schema: { operationId: "scanAndWatch", summary: "扫描并启动目录文件监听", tags: ["Filesystem"], body: ScanRequest, response: { 200: ScanStartResponse } } }, scanAndWatch);
  app.get("/scan-status", { schema: { operationId: "getScanStatus", summary: "查询扫描任务状态", tags: ["Filesystem"], querystring: ScanStatusQuery, response: { 200: Type.Array(Type.Ref(ScanStatusItem)) } } }, getScanStatus);

  // ── 文件操作 ─────────────────────────────────────────────────────────────
  app.post("/move-file", { schema: { operationId: "moveFile", summary: "移动文件", tags: ["Filesystem"], body: MovePathRequest, response: { 200: PathOperationResponse } } }, moveFile);
  app.post("/move-folder", { schema: { operationId: "moveFolder", summary: "移动文件夹", tags: ["Filesystem"], body: MovePathRequest, response: { 200: PathOperationResponse } } }, moveFolder);
  app.delete("/delete", { schema: { operationId: "deletePath", summary: "删除文件或文件夹（回收站/永久）", tags: ["Filesystem"], body: DeletePathRequest, response: { 200: PathOperationResponse } } }, deleteItem);
  app.post("/rename", { schema: { operationId: "renameItem", summary: "重命名文件或文件夹", tags: ["Filesystem"], body: RenameRequest, response: { 200: PathOperationResponse } } }, renameItem);
  app.get("/download", { schema: { operationId: "downloadFile", summary: "下载文件（attachment）", tags: ["Filesystem"], querystring: PathQuery } }, downloadFile);
  app.get("/download-full", { schema: { operationId: "downloadFileFull", summary: "下载完整文件（带 Content-Length）", tags: ["Filesystem"], querystring: PathQuery } }, downloadFileFull);
  app.get("/file", { schema: { operationId: "serveFile", summary: "直接返回文件流（inline）", tags: ["Filesystem"], querystring: PathQuery } }, serveFile);
  app.post("/mkdir", { schema: { operationId: "ensureDir", summary: "创建目录（递归）", tags: ["Filesystem"], body: MkdirRequest, response: { 200: MkdirResponse } } }, ensureDir);
  app.get("/resolve-path", { schema: { operationId: "resolvePath", summary: "解析路径并检查是否存在", tags: ["Filesystem"], querystring: PathQuery, response: { 200: ResolvePathResponse } } }, resolvePath);

  // ── 压缩包 ───────────────────────────────────────────────────────────────
  app.post("/zip-folder", { schema: { operationId: "zipFolder", summary: "将文件夹压缩为 zip", tags: ["Filesystem"], body: ZipFolderRequest, response: { 200: PathOperationResponse } } }, zipFolder);
  app.post("/unzip", { schema: { operationId: "unzip", summary: "解压压缩包到目录", tags: ["Filesystem"], body: UnzipRequest, response: { 200: PathOperationResponse } } }, unzip);
  app.get("/archive/list", { schema: { operationId: "listArchive", summary: "列出压缩包内文件条目", tags: ["Filesystem"], querystring: PathQuery, response: { 200: ArchiveListResponse } } }, listArchive);
  app.post("/archive/extract", { schema: { operationId: "extractArchive", summary: "分步解压压缩包（按页）", tags: ["Filesystem"], querystring: ExtractQuery, response: { 200: ExtractStatus } } }, extractArchive);
  app.get("/archive/file", { schema: { operationId: "getArchiveFile", summary: "获取压缩包内单个文件", tags: ["Filesystem"], querystring: ArchiveFileQuery } }, getArchiveFile);
  app.delete("/clean-extract-cache", { schema: { operationId: "clearExtractCache", summary: "清除解压缓存", tags: ["Filesystem"], response: { 200: ClearCacheResponse } } }, clearExtractCache);
  app.post("/archive/compress-images", { schema: { operationId: "compressImages", summary: "压缩包内图片批量压缩", tags: ["Filesystem"], body: CompressImagesRequest, response: { 200: CompressImagesResponse } } }, compressImages);
}
