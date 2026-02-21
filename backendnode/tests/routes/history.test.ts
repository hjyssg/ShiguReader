import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildApp } from "../../src/app.js";

vi.mock("../../src/db/client.js", () => ({
  getDb: () => ({}),
  initDb: vi.fn(),
}));

const mockRepo = {
  countProgressHistory: vi.fn(() => 0),
  listProgressHistory: vi.fn(() => []),
  upsertProgress: vi.fn(),
  // required by other routes
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
  findFilesByFilename: vi.fn(() => []),
};

vi.mock("../../src/db/repository.js", () => ({
  IndexRepository: vi.fn(() => mockRepo),
}));

vi.mock("../../src/config.js", () => ({
  config: {
    API_V1_STR: "/api/v1",
    ENVIRONMENT: "local",
    FS_ROOTS: "",
    FAVORITE_DIR: "",
    ALREADY_READ_DIR: "",
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockRepo.countProgressHistory.mockReturnValue(0);
  mockRepo.listProgressHistory.mockReturnValue([]);
});

describe("GET /api/v1/history/list", () => {
  it("returns empty list when no history", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/history/list" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("returns paginated history items", async () => {
    mockRepo.countProgressHistory.mockReturnValue(1);
    mockRepo.listProgressHistory.mockReturnValue([{
      filepath: "/a/book.zip",
      filename: "book.zip",
      file_type: "archive",
      filesize: 1024,
      mtime: 1700000000,
      thumbnail_url: null,
      last_opened_at: 1700000000,
      total_time_sec: 0,
      page_current: 5,
      page_total: 50,
      position_sec: null,
      duration_sec: null,
      updated_at: 1700000000,
    }]);
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/history/list?page=1&page_size=10" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].filepath).toBe("/a/book.zip");
    expect(body.items[0].page_current).toBe(5);
    expect(body.page).toBe(1);
  });

  it("clamps page_size to max 200", async () => {
    const app = buildApp();
    await app.inject({ method: "GET", url: "/api/v1/history/list?page_size=999" });
    expect(mockRepo.listProgressHistory).toHaveBeenCalledWith(0, 200, "desc");
  });

  it("supports sort_order=asc", async () => {
    const app = buildApp();
    await app.inject({ method: "GET", url: "/api/v1/history/list?sort_order=asc" });
    expect(mockRepo.listProgressHistory).toHaveBeenCalledWith(0, 50, "asc");
  });
});

describe("POST /api/v1/history/record", () => {
  it("returns 400 when filepath missing", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/api/v1/history/record", payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it("records progress successfully", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/history/record",
      payload: { filepath: "/a/book.zip", page_current: 10, page_total: 50 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ok");
    expect(mockRepo.upsertProgress).toHaveBeenCalledOnce();
  });

  it("handles null optional fields", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/history/record",
      payload: { filepath: "/a/video.mp4", position_sec: 120.5, duration_sec: 3600 },
    });
    expect(res.statusCode).toBe(200);
  });
});
