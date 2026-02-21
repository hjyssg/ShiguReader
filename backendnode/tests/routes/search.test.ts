import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildApp } from "../../src/app.js";

// ── mock DB ──────────────────────────────────────────────────────────────────
vi.mock("../../src/db/client.js", () => ({
  getDb: () => ({}),
  initDb: vi.fn(),
}));

type FakeRow = { filepath: string; filename: string; file_type: string; filesize: number; mtime: number };

const mockRepo = {
  searchFiles: vi.fn((): FakeRow[] => []),
  searchByAuthor: vi.fn((): FakeRow[] => []),
  searchByCoser: vi.fn((): FakeRow[] => []),
  searchByTag: vi.fn((): FakeRow[] => []),
};

vi.mock("../../src/db/repository.js", () => ({
  IndexRepository: vi.fn(() => mockRepo),
}));

vi.mock("../../src/config.js", () => ({
  config: {
    API_V1_STR: "/api/v1",
    ENVIRONMENT: "local",
    FS_ROOTS: "",
    THUMB_CONCURRENCY: 3,
    EXTRACT_CONCURRENCY: 2,
    THUMB_CACHE_DIR: "../data/thumb_cache",
    EXTRACT_CACHE_DIR: "../data/extract_cache",
    FAVORITE_DIR: "",
    ALREADY_READ_DIR: "",
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockRepo.searchFiles.mockReturnValue([]);
  mockRepo.searchByAuthor.mockReturnValue([]);
  mockRepo.searchByCoser.mockReturnValue([]);
  mockRepo.searchByTag.mockReturnValue([]);
});

const POST = (body: object) =>
  buildApp().inject({ method: "POST", url: "/api/v1/search", payload: body });

describe("POST /api/v1/search", () => {
  it("returns empty when query is blank", async () => {
    const res = await POST({ q: "" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [], total: 0 });
  });

  it("returns empty when query is whitespace", async () => {
    const res = await POST({ q: "   " });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [], total: 0 });
  });

  it("returns empty when body is missing", async () => {
    const res = await buildApp().inject({ method: "POST", url: "/api/v1/search" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [], total: 0 });
  });

  it("calls searchFiles by default", async () => {
    const row = { filepath: "/a/b.zip", filename: "b.zip", file_type: "archive", filesize: 100, mtime: 1700000000 };
    mockRepo.searchFiles.mockReturnValue([row]);
    const res = await POST({ q: "test" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].name).toBe("b.zip");
    expect(body.items[0].file_type).toBe("archive");
    expect(body.items[0].thumbnail_url).toContain("/api/v1/fs/thumb");
  });

  it("deduplicates results across scopes", async () => {
    const row = { filepath: "/a/b.zip", filename: "b.zip", file_type: "archive", filesize: 100, mtime: 1700000000 };
    mockRepo.searchFiles.mockReturnValue([row]);
    mockRepo.searchByAuthor.mockReturnValue([row]); // same path
    const res = await POST({ q: "test", scopes: ["file", "author"] });
    expect(res.json().total).toBe(1);
  });

  it("only calls requested scopes", async () => {
    await POST({ q: "test", scopes: ["tag"] });
    expect(mockRepo.searchFiles).not.toHaveBeenCalled();
    expect(mockRepo.searchByAuthor).not.toHaveBeenCalled();
    expect(mockRepo.searchByCoser).not.toHaveBeenCalled();
    expect(mockRepo.searchByTag).toHaveBeenCalledOnce();
  });

  it("passes presence_filter to repo methods", async () => {
    await POST({ q: "test", scopes: ["file"], presence_filter: "present" });
    expect(mockRepo.searchFiles).toHaveBeenCalledWith("test", "present");
  });

  it("returns null thumbnail_url for non-media file types", async () => {
    const row = { filepath: "/a/b.txt", filename: "b.txt", file_type: "other", filesize: 10, mtime: 1700000000 };
    mockRepo.searchFiles.mockReturnValue([row]);
    const res = await POST({ q: "test" });
    expect(res.json().items[0].thumbnail_url).toBeNull();
  });

  it("returns thumbnail_url for video", async () => {
    const row = { filepath: "/a/v.mp4", filename: "v.mp4", file_type: "video", filesize: 5000, mtime: 1700000000 };
    mockRepo.searchFiles.mockReturnValue([row]);
    const res = await POST({ q: "test" });
    expect(res.json().items[0].thumbnail_url).toContain("/api/v1/fs/thumb");
  });

  it("returns thumbnail_url for image", async () => {
    const row = { filepath: "/a/i.jpg", filename: "i.jpg", file_type: "image", filesize: 200, mtime: 1700000000 };
    mockRepo.searchFiles.mockReturnValue([row]);
    const res = await POST({ q: "test" });
    expect(res.json().items[0].thumbnail_url).toContain("/api/v1/fs/thumb");
  });

  it("results are sorted by name", async () => {
    mockRepo.searchFiles.mockReturnValue([
      { filepath: "/z.zip", filename: "z.zip", file_type: "archive", filesize: 1, mtime: 1 },
      { filepath: "/a.zip", filename: "a.zip", file_type: "archive", filesize: 1, mtime: 1 },
    ]);
    const res = await POST({ q: "test" });
    const names = res.json().items.map((i: { name: string }) => i.name);
    expect(names).toEqual(["a.zip", "z.zip"]);
  });

  it("merges results from all scopes", async () => {
    mockRepo.searchFiles.mockReturnValue([
      { filepath: "/f.zip", filename: "f.zip", file_type: "archive", filesize: 1, mtime: 1 },
    ]);
    mockRepo.searchByTag.mockReturnValue([
      { filepath: "/t.zip", filename: "t.zip", file_type: "archive", filesize: 1, mtime: 1 },
    ]);
    const res = await POST({ q: "test", scopes: ["file", "tag"] });
    expect(res.json().total).toBe(2);
  });
});
