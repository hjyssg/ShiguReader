/**
 * Boundary tests for IndexRepository — null, undefined, empty array edge cases
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "../../src/db/client.js";
import { IndexRepository } from "../../src/db/repository.js";
import type { DatabaseSync } from "node:sqlite";

let db: DatabaseSync;
let repo: IndexRepository;

beforeEach(() => {
  db = createTestDb();
  repo = new IndexRepository(db);
});

describe("boundary: files", () => {
  it("getFile returns undefined for empty string path", () => {
    expect(repo.getFile("")).toBeUndefined();
  });

  it("findFilesByFilename with empty filename returns empty", () => {
    expect(repo.findFilesByFilename("")).toEqual([]);
  });

});

describe("boundary: folders", () => {
  it("countFolders returns 0 when no folders", () => {
    expect(repo.countFolders()).toBe(0);
  });
});

describe("boundary: search", () => {
  it("searchFiles with empty query returns empty", () => {
    expect(repo.searchFiles("")).toEqual([]);
  });

  it("searchByAuthor with non-matching query returns empty", () => {
    expect(repo.searchByAuthor("nonexistent_author_xyz")).toEqual([]);
  });

  it("searchByCoser with non-matching query returns empty", () => {
    expect(repo.searchByCoser("nonexistent_coser_xyz")).toEqual([]);
  });

  it("searchByTag with non-matching query returns empty", () => {
    expect(repo.searchByTag("nonexistent_tag_xyz")).toEqual([]);
  });
});

describe("boundary: tags and artists", () => {
  it("getFileTags for non-existent file returns empty", () => {
    expect(repo.getFileTags("/nonexistent")).toEqual([]);
  });

  it("getFileArtists for non-existent file returns empty", () => {
    expect(repo.getFileArtists("/nonexistent")).toEqual([]);
  });

  it("getFileCosers for non-existent file returns empty", () => {
    expect(repo.getFileCosers("/nonexistent")).toEqual([]);
  });

  it("getArtistsByFilepaths with empty array returns empty map", () => {
    expect(repo.getArtistsByFilepaths([])).toEqual(new Map());
  });

  it("getTagsByFilepaths with empty array returns empty map", () => {
    expect(repo.getTagsByFilepaths([])).toEqual(new Map());
  });

  it("countTags returns 0 when no tags", () => {
    expect(repo.countTags()).toBe(0);
  });

  it("countArtists returns 0 when no artists", () => {
    expect(repo.countArtists("")).toBe(0);
    expect(repo.countArtists("coser")).toBe(0);
  });
});

describe("boundary: read_history", () => {
  it("countReadHistory returns 0 when empty", () => {
    expect(repo.countReadHistory()).toBe(0);
  });

  it("listReadHistory with offset beyond data returns empty", () => {
    expect(repo.listReadHistory(1000, 10)).toEqual([]);
  });
});

describe("boundary: activity_logs", () => {
  it("listActivityLogs returns empty when no logs", () => {
    expect(repo.listActivityLogs()).toEqual([]);
  });

  it("listActivityLogsSinceLatestStartup returns empty when no startup log", () => {
    expect(repo.listActivityLogsSinceLatestStartup()).toEqual([]);
  });

  it("logActivity with context object serializes correctly", () => {
    repo.logActivity("test", "test message", "completed", "key1", "/path", { foo: "bar" });
    const logs = repo.listActivityLogs();
    expect(logs).toHaveLength(1);
    expect(JSON.parse(logs[0].context_json!)).toEqual({ foo: "bar" });
  });
});

describe("boundary: thumbnail helpers", () => {
  it("getArtistThumbnailPaths with empty names returns empty map", () => {
    expect(repo.getArtistThumbnailPaths([], "")).toEqual(new Map());
  });

  it("getTagThumbnailPaths with empty names returns empty map", () => {
    expect(repo.getTagThumbnailPaths([])).toEqual(new Map());
  });

  it("getArtistThumbCandidates with empty names returns empty map", () => {
    expect(repo.getArtistThumbCandidates([], "")).toEqual(new Map());
  });

  it("getTagThumbCandidates with empty names returns empty map", () => {
    expect(repo.getTagThumbCandidates([])).toEqual(new Map());
  });
});

describe("boundary: library overview", () => {
  it("getLibraryOverview returns zeros when empty", () => {
    const overview = repo.getLibraryOverview();
    expect(overview.archives).toBe(0);
    expect(overview.videos).toBe(0);
    expect(overview.images).toBe(0);
    expect(overview.audio).toBe(0);
    expect(overview.folders).toBe(0);
  });
});

describe("boundary: folder open history", () => {
  it("listTopOpenedFolderIds returns empty when no history", () => {
    expect(repo.listTopOpenedFolderIds()).toEqual([]);
  });
});
