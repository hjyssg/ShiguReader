import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildApp } from "../../src/app.js";

vi.mock("../../src/db/client.js", () => ({
  getDb: () => ({}),
  initDb: vi.fn(),
}));

const mockRepo = {
  getParsedMetadata: vi.fn(() => undefined),
  getFileArtists: vi.fn(() => []),
  getFileCosers: vi.fn(() => []),
  getFileTags: vi.fn(() => []),
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
  countProgressHistory: vi.fn(() => 0),
  listProgressHistory: vi.fn(() => []),
  upsertProgress: vi.fn(),
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
});

describe("GET /api/v1/parse", () => {
  it("returns 400 when filepath missing", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/parse" });
    expect(res.statusCode).toBe(400);
  });

  it("returns live-parsed result when not in DB", async () => {
    mockRepo.getParsedMetadata.mockReturnValue(undefined);
    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/parse?filepath=" + encodeURIComponent("/a/[Author] Title [Tag].zip"),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.filepath).toBe("/a/[Author] Title [Tag].zip");
    expect(body.authors).toContain("Author");
    expect(body.title).toBe("Title");
  });

  it("returns stored result when in DB", async () => {
    mockRepo.getParsedMetadata.mockReturnValue({
      filepath: "/a/test.zip",
      title: "Stored Title",
      group_name: "Group",
      event: "C100",
      date_tag: null,
      media_type: "同人誌",
      parsed_at: 1700000000,
    });
    mockRepo.getFileArtists.mockReturnValue(["StoredAuthor"]);
    mockRepo.getFileCosers.mockReturnValue([]);
    mockRepo.getFileTags.mockReturnValue(["tag1"]);

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/parse?filepath=" + encodeURIComponent("/a/test.zip"),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.title).toBe("Stored Title");
    expect(body.authors).toEqual(["StoredAuthor"]);
    expect(body.raw_tags).toEqual(["tag1"]);
    expect(body.group_name).toBe("Group");
  });
});

describe("POST /api/v1/parse/batch", () => {
  it("returns empty when no filepaths provided", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/parse/batch",
      payload: { filepaths: [] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toEqual([]);
    expect(body.parsed_count).toBe(0);
    expect(body.total_count).toBe(0);
  });

  it("parses multiple filenames", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/parse/batch",
      payload: {
        filepaths: [
          "/a/[Author1] Title1.zip",
          "/b/[Author2] Title2.zip",
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(2);
    expect(body.parsed_count).toBe(2);
    expect(body.total_count).toBe(2);
    expect(body.items[0].result.authors).toContain("Author1");
    expect(body.items[1].result.authors).toContain("Author2");
  });

  it("handles plain filename without brackets", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/parse/batch",
      payload: { filepaths: ["/a/plain title.zip"] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items[0].result.title).toBe("plain title");
    expect(body.items[0].result.authors).toEqual([]);
  });
});
