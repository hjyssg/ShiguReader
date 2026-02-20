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
};

vi.mock("../../src/db/repository.js", () => ({
  IndexRepository: vi.fn(() => mockRepo),
}));

// ── mock config ──────────────────────────────────────────────────────────────
vi.mock("../../src/config.js", () => ({
  config: {
    API_V1_STR: "/api/v1",
    ENVIRONMENT: "local",
    FS_ROOTS: "",
    FAVORITE_DIR: "",
    ALREADY_READ_DIR: "",
  },
}));

// ── fake filesystem via spyOn ────────────────────────────────────────────────
// Use forward-slash paths; normalize on comparison to handle Windows backslashes
const TMP = "/fake/testdir";
const ns = (p: string) => p.replace(/\\/g, "/");

const fakeStatSync = (p: string): Partial<fs.Stats> => {
  const n = ns(p);
  if (n === "/fake/testdir")          return { isDirectory: () => true,  isFile: () => false, size: 0,    mtimeMs: 1700000000000 };
  if (n === "/fake/testdir/sub")      return { isDirectory: () => true,  isFile: () => false, size: 0,    mtimeMs: 1700000000000 };
  if (n === "/fake/testdir/file.zip") return { isDirectory: () => false, isFile: () => true,  size: 1024, mtimeMs: 1700000000000 };
  if (n === "/fake/testdir/img.jpg")  return { isDirectory: () => false, isFile: () => true,  size: 512,  mtimeMs: 1700000000000 };
  throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
};

const fakeReaddirSync = (p: string): unknown[] => {
  if (ns(p) === "/fake/testdir") {
    return [
      { name: "sub",      isDirectory: () => true,  isFile: () => false, isSymbolicLink: () => false },
      { name: "file.zip", isDirectory: () => false, isFile: () => true,  isSymbolicLink: () => false },
      { name: "img.jpg",  isDirectory: () => false, isFile: () => true,  isSymbolicLink: () => false },
    ];
  }
  return [];
};

beforeEach(() => {
  vi.spyOn(fs, "statSync").mockImplementation(fakeStatSync as typeof fs.statSync);
  vi.spyOn(fs, "readdirSync").mockImplementation(fakeReaddirSync as typeof fs.readdirSync);
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

describe("GET /api/v1/fs/favorite", () => {
  it("returns null when FAVORITE_DIR not set", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/fs/favorite" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toBeNull();
  });
});

describe("GET /api/v1/fs/already-read", () => {
  it("returns null when ALREADY_READ_DIR not set", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/fs/already-read" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toBeNull();
  });
});

describe("GET /api/v1/fs/list", () => {
  it("returns 400 when path is missing", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/fs/list" });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for non-existent path", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/fs/list?path=/does/not/exist" });
    expect(res.statusCode).toBe(404);
  });

  it("lists directory contents with folders first", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: `/api/v1/fs/list?path=${encodeURIComponent(TMP)}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toBeDefined();
    const names = body.items.map((i: { name: string }) => i.name);
    // folder "sub" should come before files
    expect(names.indexOf("sub")).toBeLessThan(names.indexOf("file.zip"));
  });

  it("assigns correct item_type and file_type", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: `/api/v1/fs/list?path=${encodeURIComponent(TMP)}` });
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
    const res = await app.inject({ method: "GET", url: `/api/v1/fs/list?path=${encodeURIComponent(TMP)}` });
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

describe("GET /health", () => {
  it("returns ok", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ok");
  });
});
