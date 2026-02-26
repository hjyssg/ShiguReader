import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "node:path";
import { buildApp } from "../../src/app.js";
import { createRouteMockRepo } from "../testUtils/mocks.js";

vi.mock("../../src/db/client.js", () => ({
  getDb: () => ({}),
  initDb: vi.fn(),
}));

const mockRepo = createRouteMockRepo();

vi.mock("../../src/db/repository.js", () => ({
  IndexRepository: vi.fn(() => mockRepo),
}));

vi.mock("../../src/config.js", async () => {
  const { baseTestConfig } = await import("../testUtils/mocks.js");
  const PROJECT_ROOT = process.cwd();
  return {
    ...baseTestConfig,
    PROJECT_ROOT,
    ENV_FILE_PATH: path.join(PROJECT_ROOT, ".env"),
    DB_FILE_PATH: path.join(PROJECT_ROOT, "data", "index_node.db"),
    resolveProjectPath: (p: string) => (path.isAbsolute(p) ? p : path.resolve(process.cwd(), p)),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mockRepo.countReadHistory.mockReturnValue(0);
  mockRepo.listReadHistory.mockReturnValue([]);
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
    mockRepo.countReadHistory.mockReturnValue(1);
    mockRepo.listReadHistory.mockReturnValue([{
      id: 1,
      filepath: "/a/book.zip",
      filename: "book.zip",
      file_type: "archive",
      thumbnail_filepath: null,
      opened_at: 1700000000,
    }]);
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/history/list?page=1&page_size=10" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].filepath).toBe("/a/book.zip");
    expect(body.items[0].opened_at).toBe(1700000000);
    expect(body.page).toBe(1);
  });

  it("clamps page_size to max 200", async () => {
    const app = buildApp();
    await app.inject({ method: "GET", url: "/api/v1/history/list?page_size=999" });
    expect(mockRepo.listReadHistory).toHaveBeenCalledWith(0, 200, "desc");
  });

  it("supports sort_order=asc", async () => {
    const app = buildApp();
    await app.inject({ method: "GET", url: "/api/v1/history/list?sort_order=asc" });
    expect(mockRepo.listReadHistory).toHaveBeenCalledWith(0, 50, "asc");
  });
});

describe("POST /api/v1/history/record", () => {
  it("returns 400 when filepath missing", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/api/v1/history/record", payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it("records read successfully", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/history/record",
      payload: { filepath: "/a/book.zip" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ok");
    expect(mockRepo.recordRead).toHaveBeenCalledWith("/a/book.zip");
  });

  it("same file can be recorded multiple times", async () => {
    const app = buildApp();
    await app.inject({ method: "POST", url: "/api/v1/history/record", payload: { filepath: "/a/book.zip" } });
    await app.inject({ method: "POST", url: "/api/v1/history/record", payload: { filepath: "/a/book.zip" } });
    expect(mockRepo.recordRead).toHaveBeenCalledTimes(2);
  });

  it("skips recording when filepath is inside extract cache", async () => {
    const app = buildApp();
    const cacheFile = path.resolve("../data/extract_cache/demo/image.jpg");
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/history/record",
      payload: { filepath: cacheFile },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("skipped");
    expect(mockRepo.recordRead).not.toHaveBeenCalled();
  });
});
