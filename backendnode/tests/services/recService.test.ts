import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb } from "../../src/db/client.js";
import { IndexRepository } from "../../src/db/repository.js";
import type { DatabaseSync } from "node:sqlite";

// We test the computeScore logic indirectly through refreshAllRecScores
// by setting up a real in-memory DB with known data.

let db: DatabaseSync;
let repo: IndexRepository;

beforeEach(() => {
  db = createTestDb();
  repo = new IndexRepository(db);
});

describe("rec_score computation via repository", () => {
  const base = {
    folderpath: "/fav",
    mtime: 1700000000,
    filesize: 1024,
    file_type: "archive",
    ext: ".zip",
  };

  it("batchUpdateRecScores updates scores correctly", () => {
    repo.upsertFile({ ...base, filepath: "/fav/a.zip", filename: "a.zip", fingerprint: "fp1" });
    repo.upsertFile({ ...base, filepath: "/fav/b.zip", filename: "b.zip", fingerprint: "fp2" });

    const scores = new Map<string, number>();
    scores.set("/fav/a.zip", 1.5);
    scores.set("/fav/b.zip", 0.8);
    repo.batchUpdateRecScores(scores);

    const a = repo.getFile("/fav/a.zip");
    const b = repo.getFile("/fav/b.zip");
    expect(a!.rec_score).toBe(1.5);
    expect(b!.rec_score).toBe(0.8);
  });

  it("batchUpdateRecScores with empty map does nothing", () => {
    repo.upsertFile({ ...base, filepath: "/fav/a.zip", filename: "a.zip", fingerprint: "fp1" });
    repo.batchUpdateRecScores(new Map());
    const a = repo.getFile("/fav/a.zip");
    expect(a!.rec_score).toBe(0);
  });

  it("getFavoriteAuthorFrequencies returns correct counts", () => {
    repo.upsertFile({ ...base, filepath: "/fav/a.zip", filename: "a.zip", fingerprint: "fp1" });
    repo.upsertFile({ ...base, filepath: "/fav/b.zip", filename: "b.zip", fingerprint: "fp2" });
    repo.saveParsedMetadata("/fav/a.zip", { authors: ["AuthorX"] });
    repo.saveParsedMetadata("/fav/b.zip", { authors: ["AuthorX"] });

    const freq = repo.getFavoriteAuthorFrequencies("/fav");
    expect(freq.get("AuthorX")).toBe(2);
  });

  it("getFavoriteTagFrequencies returns correct counts", () => {
    repo.upsertFile({ ...base, filepath: "/fav/a.zip", filename: "a.zip", fingerprint: "fp1" });
    repo.saveParsedMetadata("/fav/a.zip", { rawTags: ["tag1", "tag2"] });

    const freq = repo.getFavoriteTagFrequencies("/fav");
    expect(freq.get("tag1")).toBe(1);
    expect(freq.get("tag2")).toBe(1);
  });

  it("getTagTotalCounts returns global tag counts", () => {
    repo.upsertFile({ ...base, filepath: "/a/x.zip", filename: "x.zip", fingerprint: "fp1" });
    repo.upsertFile({ ...base, filepath: "/b/y.zip", filename: "y.zip", fingerprint: "fp2" });
    repo.saveParsedMetadata("/a/x.zip", { rawTags: ["common", "unique1"] });
    repo.saveParsedMetadata("/b/y.zip", { rawTags: ["common"] });

    const totals = repo.getTagTotalCounts();
    expect(totals.get("common")).toBe(2);
    expect(totals.get("unique1")).toBe(1);
  });
});
