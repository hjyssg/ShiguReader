import { describe, it, expect, beforeEach, vi } from "vitest";
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
  return baseTestConfig;
});

beforeEach(() => vi.clearAllMocks());

// ── existing search tests ─────────────────────────────────────────────────────

describe("POST /api/v1/search", () => {
  it("returns empty when no results", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/api/v1/search", payload: { q: "test" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toEqual([]);
  });

  it("returns empty for blank query", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/api/v1/search", payload: { q: "  " } });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toEqual([]);
  });

  it("searches all scopes by default", async () => {
    const app = buildApp();
    await app.inject({ method: "POST", url: "/api/v1/search", payload: { q: "foo" } });
    expect(mockRepo.searchFiles).toHaveBeenCalled();
    expect(mockRepo.searchByAuthor).toHaveBeenCalled();
    expect(mockRepo.searchByCoser).toHaveBeenCalled();
    expect(mockRepo.searchByTag).toHaveBeenCalled();
  });

  it("respects scopes filter", async () => {
    const app = buildApp();
    await app.inject({ method: "POST", url: "/api/v1/search", payload: { q: "foo", scopes: ["file"] } });
    expect(mockRepo.searchFiles).toHaveBeenCalled();
    expect(mockRepo.searchByAuthor).not.toHaveBeenCalled();
  });

  it("deduplicates results across scopes", async () => {
    const row = { filepath: "/a/b.zip", filename: "b.zip", file_type: "archive", filesize: 100, mtime: 1000 };
    mockRepo.searchFiles.mockReturnValue([row]);
    mockRepo.searchByAuthor.mockReturnValue([row]);
    mockRepo.searchByCoser.mockReturnValue([]);
    mockRepo.searchByTag.mockReturnValue([]);
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/api/v1/search", payload: { q: "b" } });
    expect(res.json().items).toHaveLength(1);
  });

  it("returns thumbnail_url for archive files", async () => {
    mockRepo.searchFiles.mockReturnValue([
      { filepath: "/a/b.zip", filename: "b.zip", file_type: "archive", filesize: 100, mtime: 1000 },
    ]);
    mockRepo.searchByAuthor.mockReturnValue([]);
    mockRepo.searchByCoser.mockReturnValue([]);
    mockRepo.searchByTag.mockReturnValue([]);
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/api/v1/search", payload: { q: "b" } });
    expect(res.json().items[0].thumbnail_url).toBeTruthy();
  });

  it("clamps limit to 500", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/api/v1/search", payload: { q: "x", limit: 9999 } });
    expect(res.statusCode).toBe(200);
  });

  it("supports pagination via offset", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      filepath: `/a/${i}.zip`, filename: `${i}.zip`, file_type: "archive", filesize: 100, mtime: 1000,
    }));
    mockRepo.searchFiles.mockReturnValue(rows);
    mockRepo.searchByAuthor.mockReturnValue([]);
    mockRepo.searchByCoser.mockReturnValue([]);
    mockRepo.searchByTag.mockReturnValue([]);
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/api/v1/search", payload: { q: "x", limit: 2, offset: 2 } });
    expect(res.json().items).toHaveLength(2);
    expect(res.json().total).toBe(5);
  });
});

// ── quick-match-batch tests ───────────────────────────────────────────────────

describe("POST /api/v1/search/local-check-batch", () => {
  it("returns empty results for empty queries", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST", url: "/api/v1/search/local-check-batch", payload: { queries: [] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().results).toEqual([]);
  });

  it("returns different when no candidates found", async () => {
    mockRepo.quickMatchCandidates.mockReturnValue([]);
    const app = buildApp();
    const res = await app.inject({
      method: "POST", url: "/api/v1/search/local-check-batch",
      payload: { queries: ["[Author] SomeTitle"] },
    });
    const r = res.json().results[0];
    expect(r.match_level).toBe("different");
    expect(r.confidence).toBe(0);
  });

  it("returns downloaded when author+title match exactly", async () => {
    mockRepo.quickMatchCandidates.mockReturnValue([{
      filepath: "/a/b.zip",
      filename: "[Author] SomeTitle.zip",
      file_type: "archive", filesize: 100, mtime: 1000,
    }]);
    const app = buildApp();
    const res = await app.inject({
      method: "POST", url: "/api/v1/search/local-check-batch",
      payload: { queries: ["[Author] SomeTitle"] },
    });
    const r = res.json().results[0];
    expect(r.match_level).toBe("downloaded");
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  it("returns same_author when author matches but title differs", async () => {
    mockRepo.quickMatchCandidates.mockReturnValue([{
      filepath: "/a/c.zip",
      filename: "[Author] CompletelyDifferentTitle.zip",
      file_type: "archive", filesize: 100, mtime: 1000,
    }]);
    const app = buildApp();
    const res = await app.inject({
      method: "POST", url: "/api/v1/search/local-check-batch",
      payload: { queries: ["[Author] SomeTitle"] },
    });
    const r = res.json().results[0];
    expect(["same_author", "different"]).toContain(r.match_level);
  });

  it("handles multiple queries in one call", async () => {
    mockRepo.quickMatchCandidates.mockReturnValue([]);
    const app = buildApp();
    const res = await app.inject({
      method: "POST", url: "/api/v1/search/local-check-batch",
      payload: { queries: ["[A] Title1", "[B] Title2", "[C] Title3"] },
    });
    expect(res.json().results).toHaveLength(3);
  });

  it("respects limit parameter for hits", async () => {
    const candidates = Array.from({ length: 10 }, (_, i) => ({
      filepath: `/a/${i}.zip`,
      filename: `[Author] SomeTitle ${i}.zip`,
      file_type: "archive", filesize: 100, mtime: 1000,
    }));
    mockRepo.quickMatchCandidates.mockReturnValue(candidates);
    const app = buildApp();
    const res = await app.inject({
      method: "POST", url: "/api/v1/search/local-check-batch",
      payload: { queries: ["[Author] SomeTitle"], limit: 3 },
    });
    expect(res.json().results[0].hits.length).toBeLessThanOrEqual(3);
  });
});
