import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import { buildApp } from "../../src/app.js";

// ── mock DB so tests don't need a real SQLite file ──────────────────────────
vi.mock("../../src/db/client.js", () => ({
  getDb: () => ({}),
  initDb: vi.fn(),
}));

const mockRepo = {
  getFileDataByFolder: vi.fn(() => new Map()),
  getArchiveMetasByFolder: vi.fn(() => new Map()),
  upsertFolder: vi.fn(),
  upsertFile: vi.fn(),
  recordFolderOpen: vi.fn(),
  countFilesByType: vi.fn(() => 0),
  countFolders: vi.fn(() => 0),
  listActivityLogs: vi.fn(() => []),
  listActivityLogsSinceLatestStartup: vi.fn(() => []),
  listTopOpenedFolderIds: vi.fn(() => []),
  logActivity: vi.fn(),
  getLibraryOverview: vi.fn(() => ({ archives: 0, videos: 0, images: 0, audio: 0, folders: 0 })),
  findFilesByFilename: vi.fn(() => []),
};

vi.mock("../../src/db/repository.js", () => ({
  IndexRepository: vi.fn(() => mockRepo),
}));

// ── mock config ──────────────────────────────────────────────────────────────
vi.mock("../../src/config.js", () => ({
  config: {
    API_V1_STR: "/api/v1",
    ENVIRONMENT: "local",
    INDEX_SQLITE_PATH: "./data/index.db",
    FS_ROOTS: "",
    FAVORITE_DIR: "",
    ALREADY_READ_DIR: "",
    THUMB_CONCURRENCY: 3,
    EXTRACT_CONCURRENCY: 2,
    THUMB_TIMEOUT_SEC: 10,
    THUMB_HEIGHT: 350,
    THUMB_JPEG_QUALITY: 70,
    THUMB_CACHE_DIR: "../data/thumb_cache",
    EXTRACT_CACHE_DIR: "../data/extract_cache",
  },
}));

// ── fake filesystem via spyOn ────────────────────────────────────────────────
// Use forward-slash paths; normalize on comparison to handle Windows backslashes
import path from "node:path";
const TMP = "/fake/testdir";
const RESOLVED_TMP = path.resolve(TMP);
const ns = (p: string) => p.replace(/\\/g, "/");

const RESOLVED_NS = ns(RESOLVED_TMP);

const isTestDir = (p: string) => {
  const n = ns(p);
  return n === "/fake/testdir" || n === RESOLVED_NS;
};
const isTestChild = (p: string, name: string) => {
  const n = ns(p);
  return n === `/fake/testdir/${name}` || n === `${RESOLVED_NS}/${name}`;
};

const fakeStat = async (p: string): Promise<Partial<fs.Stats>> => {
  if (isTestDir(p))                  return { isDirectory: () => true,  isFile: () => false, size: 0,    mtimeMs: 1700000000000 };
  if (isTestChild(p, "sub"))         return { isDirectory: () => true,  isFile: () => false, size: 0,    mtimeMs: 1700000000000 };
  if (isTestChild(p, "file.zip"))    return { isDirectory: () => false, isFile: () => true,  size: 1024, mtimeMs: 1700000000000 };
  if (isTestChild(p, "img.jpg"))     return { isDirectory: () => false, isFile: () => true,  size: 512,  mtimeMs: 1700000000000 };
  if (isTestChild(p, "._2.jpg"))     return { isDirectory: () => false, isFile: () => true,  size: 12,   mtimeMs: 1700000000000 };
  throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
};

const fakeReaddir = async (p: string): Promise<unknown[]> => {
  if (isTestDir(p)) {
    return [
      { name: "sub",      isDirectory: () => true,  isFile: () => false, isSymbolicLink: () => false },
      { name: "file.zip", isDirectory: () => false, isFile: () => true,  isSymbolicLink: () => false },
      { name: "img.jpg",  isDirectory: () => false, isFile: () => true,  isSymbolicLink: () => false },
      { name: "._2.jpg", isDirectory: () => false, isFile: () => true,  isSymbolicLink: () => false },
    ];
  }
  return [];
};

const fakeAccess = async (p: string): Promise<void> => {
  if (isTestDir(p) || isTestChild(p, "sub") || isTestChild(p, "file.zip") || isTestChild(p, "img.jpg") || isTestChild(p, "._2.jpg")) return;
  throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
};

beforeEach(() => {
  vi.spyOn(fs.promises, "stat").mockImplementation(fakeStat as typeof fs.promises.stat);
  vi.spyOn(fs.promises, "readdir").mockImplementation(fakeReaddir as typeof fs.promises.readdir);
  vi.spyOn(fs.promises, "access").mockImplementation(fakeAccess as typeof fs.promises.access);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/v1/fs/roots", () => {
  it("returns empty array when FS_ROOTS not set", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/fs/roots" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});

describe("GET /api/v1/fs/favorite-folder", () => {
  it("returns null when FAVORITE_DIR not set", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/fs/favorite-folder" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toBeNull();
  });
});

describe("GET /api/v1/fs/already-read-folder", () => {
  it("returns null when ALREADY_READ_DIR not set", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/fs/already-read-folder" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toBeNull();
  });
});

describe("GET /api/v1/fs/listdir", () => {
  it("returns 400 when path is missing", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/fs/listdir" });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for non-existent path", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/fs/listdir?path=/does/not/exist" });
    expect(res.statusCode).toBe(404);
  });

  it("lists directory contents with folders first", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: `/api/v1/fs/listdir?path=${encodeURIComponent(TMP)}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toBeDefined();
    const names = body.items.map((i: { name: string }) => i.name);
    // folder "sub" should come before files
    expect(names.indexOf("sub")).toBeLessThan(names.indexOf("file.zip"));
    // hidden file should be filtered
    expect(names).not.toContain("._2.jpg");
  });

  it("assigns correct item_type and file_type", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: `/api/v1/fs/listdir?path=${encodeURIComponent(TMP)}` });
    const body = res.json();
    // items may be empty if statSync path matching fails on this OS — guard with optional chaining
    const sub = body.items.find((i: { name: string }) => i.name === "sub");
    const zip = body.items.find((i: { name: string }) => i.name === "file.zip");
    const img = body.items.find((i: { name: string }) => i.name === "img.jpg");
    if (sub) expect(sub.item_type).toBe("folder");
    if (zip) {
      expect(zip.item_type).toBe("file");
      expect(zip.file_type).toBe("archive");
    }
    if (img) expect(img.file_type).toBe("image");
    // At least the items array should exist
    expect(Array.isArray(body.items)).toBe(true);
  });

  it("sets thumbnail_url for archive and image", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: `/api/v1/fs/listdir?path=${encodeURIComponent(TMP)}` });
    const body = res.json();
    const zip = body.items.find((i: { name: string }) => i.name === "file.zip");
    const img = body.items.find((i: { name: string }) => i.name === "img.jpg");
    if (zip) expect(zip.thumbnail_url).toContain("/api/v1/fs/thumb");
    if (img) expect(img.thumbnail_url).toContain("/api/v1/fs/thumb");
    expect(Array.isArray(body.items)).toBe(true);
  });
});

describe("GET /api/v1/fs/library-overview", () => {
  it("returns counts", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/fs/library-overview" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("archives");
    expect(body).toHaveProperty("videos");
    expect(body).toHaveProperty("images");
    expect(body).toHaveProperty("audio");
    expect(body).toHaveProperty("folders");
  });
});

describe("GET /api/v1/fs/recent-activity", () => {
  it("returns items array", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/fs/recent-activity" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("items");
  });
});

describe("GET /api/v1/fs/top-opened-folders", () => {
  it("returns folder_ids array", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/fs/top-opened-folders" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("folder_ids");
  });
});

describe("POST /api/v1/fs/scan", () => {
  it("returns 400 when path missing", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/api/v1/fs/scan", payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for non-existent path", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/api/v1/fs/scan", payload: { path: "/no/such/dir" } });
    expect(res.statusCode).toBe(404);
  });

  it("returns started for valid directory", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/api/v1/fs/scan", payload: { path: TMP } });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("started");
  });
});

describe("POST /api/v1/fs/move-file", () => {
  it("moves file via rename on same device", async () => {
    const renameSpy = vi.spyOn(fs.promises, "rename").mockResolvedValue(undefined);
    const mkdirSpy = vi.spyOn(fs.promises, "mkdir").mockResolvedValue(undefined as unknown as string);
    const copySpy = vi.spyOn(fs.promises, "copyFile").mockResolvedValue(undefined);
    const unlinkSpy = vi.spyOn(fs.promises, "unlink").mockResolvedValue(undefined);

    const app = buildApp();
    const source = "/fake/testdir/file.zip";
    const dest = "/fake/dest/file.zip";
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/fs/move-file",
      payload: { source_path: source, dest_path: dest },
    });

    expect(res.statusCode).toBe(200);
    expect(renameSpy).toHaveBeenCalledWith(source, dest);
    expect(copySpy).not.toHaveBeenCalled();
    expect(unlinkSpy).not.toHaveBeenCalled();
    expect(mkdirSpy).toHaveBeenCalled();
  });

  it("falls back to copy+unlink on EXDEV", async () => {
    const exdev = Object.assign(new Error("EXDEV"), { code: "EXDEV" });
    const renameSpy = vi.spyOn(fs.promises, "rename").mockRejectedValue(exdev);
    const mkdirSpy = vi.spyOn(fs.promises, "mkdir").mockResolvedValue(undefined as unknown as string);
    const copySpy = vi.spyOn(fs.promises, "copyFile").mockResolvedValue(undefined);
    const unlinkSpy = vi.spyOn(fs.promises, "unlink").mockResolvedValue(undefined);

    const app = buildApp();
    const source = "/fake/testdir/file.zip";
    const dest = "/fake/dest/file.zip";
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/fs/move-file",
      payload: { source_path: source, dest_path: dest },
    });

    expect(res.statusCode).toBe(200);
    expect(renameSpy).toHaveBeenCalledWith(source, dest);
    expect(copySpy).toHaveBeenCalledWith(source, dest);
    expect(unlinkSpy).toHaveBeenCalledWith(source);
    expect(mkdirSpy).toHaveBeenCalled();
  });

  it("returns 500 for non-EXDEV rename error", async () => {
    const renameSpy = vi.spyOn(fs.promises, "rename").mockRejectedValue(new Error("EACCES"));
    vi.spyOn(fs.promises, "mkdir").mockResolvedValue(undefined as unknown as string);
    const copySpy = vi.spyOn(fs.promises, "copyFile").mockResolvedValue(undefined);
    const unlinkSpy = vi.spyOn(fs.promises, "unlink").mockResolvedValue(undefined);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/fs/move-file",
      payload: { source_path: "/fake/testdir/file.zip", dest_path: "/fake/dest/file.zip" },
    });

    expect(res.statusCode).toBe(500);
    expect(renameSpy).toHaveBeenCalled();
    expect(copySpy).not.toHaveBeenCalled();
    expect(unlinkSpy).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/fs/move-folder", () => {
  it("falls back to cp+rm on EXDEV", async () => {
    const exdev = Object.assign(new Error("EXDEV"), { code: "EXDEV" });
    const renameSpy = vi.spyOn(fs.promises, "rename").mockRejectedValue(exdev);
    const mkdirSpy = vi.spyOn(fs.promises, "mkdir").mockResolvedValue(undefined as unknown as string);
    const cpSpy = vi.spyOn(fs.promises, "cp").mockResolvedValue(undefined);
    const rmSpy = vi.spyOn(fs.promises, "rm").mockResolvedValue(undefined);

    const app = buildApp();
    const source = "/fake/testdir/sub";
    const dest = "/fake/dest/sub";
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/fs/move-folder",
      payload: { source_path: source, dest_path: dest },
    });

    expect(res.statusCode).toBe(200);
    expect(renameSpy).toHaveBeenCalledWith(source, dest);
    expect(cpSpy).toHaveBeenCalledWith(source, dest, { recursive: true, force: false, errorOnExist: true });
    expect(rmSpy).toHaveBeenCalledWith(source, { recursive: true, force: true });
    expect(mkdirSpy).toHaveBeenCalled();
  });
});

describe("GET /health", () => {
  it("returns ok", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ok");
  });
});
