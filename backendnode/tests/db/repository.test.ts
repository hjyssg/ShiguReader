import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb } from "../../src/db/client.js";
import { IndexRepository } from "../../src/db/repository.js";
import type { DatabaseSync } from "node:sqlite";

let db: DatabaseSync;
let repo: IndexRepository;

beforeEach(() => {
  db = createTestDb();
  repo = new IndexRepository(db);
});

afterEach(() => {
  try { db.close(); } catch {}
});

// ─── files ────────────────────────────────────────────────────────────────────

describe("IndexRepository – files", () => {
  const base = {
    filepath: "/a/b/test.zip",
    folderpath: "/a/b",
    filename: "test.zip",
    mtime: 1700000000,
    filesize: 1024,
    file_type: "archive",
    ext: ".zip",
    fingerprint: "fp1",
  };

  it("upsertFile inserts a new row", () => {
    repo.upsertFile(base);
    const row = repo.getFile(base.filepath);
    expect(row).toBeDefined();
    expect(row!.filename).toBe("test.zip");
    expect(row!.file_type).toBe("archive");
  });

  it("upsertFile updates existing row", () => {
    repo.upsertFile(base);
    repo.upsertFile({ ...base, filesize: 9999 });
    const row = repo.getFile(base.filepath);
    expect(row!.filesize).toBe(9999);
  });

  it("getFile returns undefined for missing path", () => {
    expect(repo.getFile("/no/such/file")).toBeUndefined();
  });

  it("deleteFile removes the row", () => {
    repo.upsertFile(base);
    repo.deleteFile(base.filepath);
    expect(repo.getFile(base.filepath)).toBeUndefined();
  });

  it("batchUpsertFiles inserts multiple rows", () => {
    const items = [
      { ...base, filepath: "/a/1.zip", filename: "1.zip", fingerprint: "fp1" },
      { ...base, filepath: "/a/2.zip", filename: "2.zip", fingerprint: "fp2" },
      { ...base, filepath: "/a/3.zip", filename: "3.zip", fingerprint: "fp3" },
    ];
    repo.batchUpsertFiles(items);
    expect(repo.getFile("/a/1.zip")).toBeDefined();
    expect(repo.getFile("/a/3.zip")).toBeDefined();
  });

  it("countFilesByType counts correctly", () => {
    repo.upsertFile({ ...base, filepath: "/a/1.zip", filename: "1.zip", fingerprint: "fp1" });
    repo.upsertFile({ ...base, filepath: "/a/2.zip", filename: "2.zip", fingerprint: "fp2" });
    expect(repo.countFilesByType("archive")).toBe(2);
    expect(repo.countFilesByType("video")).toBe(0);
  });

  it("findFilesByFilename returns matching rows", () => {
    repo.upsertFile({ ...base, filepath: "/a/test.zip", filename: "test.zip", fingerprint: "fp1" });
    repo.upsertFile({ ...base, filepath: "/b/test.zip", filename: "test.zip", fingerprint: "fp2" });
    const rows = repo.findFilesByFilename("test.zip");
    expect(rows.length).toBe(2);
  });

  it("findFilesByFilename excludes given path", () => {
    repo.upsertFile({ ...base, filepath: "/a/test.zip", filename: "test.zip", fingerprint: "fp1" });
    repo.upsertFile({ ...base, filepath: "/b/test.zip", filename: "test.zip", fingerprint: "fp2" });
    const rows = repo.findFilesByFilename("test.zip", "/a/test.zip");
    expect(rows.every(r => r.filepath !== "/a/test.zip")).toBe(true);
  });

  it("updateFileThumbnail sets thumbnail_filepath", () => {
    repo.upsertFile(base);
    repo.updateFileThumbnail(base.filepath, "/thumbs/test.jpg");
    const row = repo.getFile(base.filepath);
    expect(row!.thumbnail_filepath).toBe("/thumbs/test.jpg");
  });

  it("deleteByPrefix removes files and folders under prefix", () => {
    repo.upsertFile({ ...base, filepath: "/root/sub/a.zip", filename: "a.zip", fingerprint: "fp1" });
    repo.upsertFile({ ...base, filepath: "/root/sub/b.zip", filename: "b.zip", fingerprint: "fp2" });
    repo.upsertFile({ ...base, filepath: "/other/c.zip", filename: "c.zip", fingerprint: "fp3" });
    repo.deleteByPrefix("/root/sub");
    expect(repo.getFile("/root/sub/a.zip")).toBeUndefined();
    expect(repo.getFile("/other/c.zip")).toBeDefined();
  });
});

// ─── folders ──────────────────────────────────────────────────────────────────

describe("IndexRepository – folders", () => {
  it("upsertFolder inserts and countFolders increments", () => {
    repo.upsertFolder({ filepath: "/a/b", dirname: "b" });
    expect(repo.countFolders()).toBe(1);
  });

  it("upsertFolder updates existing row", () => {
    repo.upsertFolder({ filepath: "/a/b", dirname: "b", mtime: 100 });
    repo.upsertFolder({ filepath: "/a/b", dirname: "b", mtime: 200 });
    expect(repo.countFolders()).toBe(1);
  });

  it("batchUpsertFolders inserts multiple", () => {
    repo.batchUpsertFolders([
      { filepath: "/a", dirname: "a" },
      { filepath: "/b", dirname: "b" },
    ]);
    expect(repo.countFolders()).toBe(2);
  });
});

// ─── archive_meta ─────────────────────────────────────────────────────────────

describe("IndexRepository – archive_meta", () => {
  const fp = "/a/test.zip";

  it("upsertArchiveMeta and getArchiveMeta round-trip", () => {
    repo.upsertArchiveMeta(fp, "zip", 10, 8, 1, 1);
    const row = repo.getArchiveMeta(fp);
    expect(row).toBeDefined();
    expect(row!.entry_count).toBe(10);
    expect(row!.image_file_num).toBe(8);
  });

  it("upsertArchiveMeta updates on conflict", () => {
    repo.upsertArchiveMeta(fp, "zip", 10, 8, 1, 1);
    repo.upsertArchiveMeta(fp, "zip", 20, 15, 3, 2);
    const row = repo.getArchiveMeta(fp);
    expect(row!.entry_count).toBe(20);
  });

  it("getArchiveMeta returns undefined for missing path", () => {
    expect(repo.getArchiveMeta("/no/such.zip")).toBeUndefined();
  });

  it("upsertArchiveMeta 保存 version_sig 和 cover_entry", () => {
    repo.upsertArchiveMeta(fp, "zip", 10, 8, 1, 1, "1700000000:2048", "img/cover.jpg");
    const row = repo.getArchiveMeta(fp);
    expect(row!.version_sig).toBe("1700000000:2048");
    expect(row!.cover_entry).toBe("img/cover.jpg");
    expect(row!.index_status).toBe("fresh");
  });

  it("getArchiveVersionSig 返回已存储的签名", () => {
    repo.upsertArchiveMeta(fp, "zip", 5, 4, 0, 0, "1700000000:1024", null);
    expect(repo.getArchiveVersionSig(fp)).toBe("1700000000:1024");
  });

  it("getArchiveVersionSig 对不存在的路径返回 null", () => {
    expect(repo.getArchiveVersionSig("/no/such.zip")).toBeNull();
  });

  it("version_sig 变化时 upsertArchiveMeta 应该更新", () => {
    repo.upsertArchiveMeta(fp, "zip", 10, 8, 1, 1, "old_sig", "old_cover.jpg");
    repo.upsertArchiveMeta(fp, "zip", 12, 10, 1, 1, "new_sig", "new_cover.jpg");
    const row = repo.getArchiveMeta(fp);
    expect(row!.version_sig).toBe("new_sig");
    expect(row!.cover_entry).toBe("new_cover.jpg");
    expect(row!.entry_count).toBe(12);
  });
});

// ─── read_history ─────────────────────────────────────────────────────────────

describe("IndexRepository – read_history", () => {
  const fp = "/a/book.zip";

  it("recordRead inserts and listReadHistory returns it", () => {
    repo.upsertFile({ filepath: fp, filename: "book.zip", mtime: 1700000000, filesize: 100 });
    repo.recordRead(fp);
    const list = repo.listReadHistory(0, 10);
    expect(list.length).toBe(1);
    expect(list[0].filepath).toBe(fp);
    expect(list[0].opened_at).toBeGreaterThan(0);
  });

  it("recordRead deduplicates within 5 minutes for same file", () => {
    repo.upsertFile({ filepath: fp, filename: "book.zip", mtime: 1700000000, filesize: 100 });
    repo.recordRead(fp);
    repo.recordRead(fp); // 5 分钟内重复调用，应被跳过
    const list = repo.listReadHistory(0, 10);
    expect(list.length).toBe(1);
  });

  it("countReadHistory returns correct count", () => {
    repo.upsertFile({ filepath: "/a.zip", filename: "a.zip", mtime: 1700000000, filesize: 100 });
    repo.upsertFile({ filepath: "/b.zip", filename: "b.zip", mtime: 1700000000, filesize: 100 });
    repo.recordRead("/a.zip");
    repo.recordRead("/b.zip");
    expect(repo.countReadHistory()).toBe(2);
  });
});

// ─── activity_logs ────────────────────────────────────────────────────────────

describe("IndexRepository – activity_logs", () => {
  it("logActivity and listActivityLogs round-trip", () => {
    repo.logActivity("scan", "Scan started", "started");
    repo.logActivity("scan", "Scan done");
    const logs = repo.listActivityLogs();
    expect(logs.length).toBe(2);
    expect(logs[0].message).toBe("Scan done"); // DESC order
  });

  it("listActivityLogsSinceLatestStartup filters by startup id", () => {
    repo.logActivity("scan", "old scan");
    repo.logActivity("startup", "server started", "started");
    repo.logActivity("scan", "new scan");
    const logs = repo.listActivityLogsSinceLatestStartup();
    expect(logs.some(l => l.message === "old scan")).toBe(false);
    expect(logs.some(l => l.message === "new scan")).toBe(true);
  });
});

// ─── parsed_metadata + tags + artists ────────────────────────────────────────

describe("IndexRepository – parsed_metadata", () => {
  const fp = "/a/[AuthorA][GroupB] Title (C99).zip";

  it("saveParsedMetadata and getParsedMetadata round-trip", () => {
    repo.saveParsedMetadata(fp, {
      title: "Title",
      authors: ["AuthorA"],
      groupName: "GroupB",
      rawTags: ["tag1", "tag2"],
      event: "C99",
    });
    const meta = repo.getParsedMetadata(fp);
    expect(meta).toBeDefined();
    expect(meta!.title).toBe("Title");
    expect(meta!.group_name).toBe("GroupB");
    expect(meta!.event).toBe("C99");
  });

  it("getFileArtists returns saved authors", () => {
    repo.saveParsedMetadata(fp, { authors: ["AuthorA", "AuthorB"] });
    const artists = repo.getFileArtists(fp);
    expect(artists).toContain("AuthorA");
    expect(artists).toContain("AuthorB");
  });

  it("getFileCosers returns saved cosers", () => {
    repo.saveParsedMetadata(fp, { cosers: ["CoserX"] });
    expect(repo.getFileCosers(fp)).toContain("CoserX");
    expect(repo.getFileArtists(fp)).toHaveLength(0);
  });

  it("getFileTags returns saved tags", () => {
    repo.saveParsedMetadata(fp, { rawTags: ["fantasy", "action"] });
    const tags = repo.getFileTags(fp);
    expect(tags).toContain("fantasy");
    expect(tags).toContain("action");
  });
});

// ─── search ───────────────────────────────────────────────────────────────────

describe("IndexRepository – search", () => {
  const base = {
    folderpath: "/root",
    mtime: 1700000000,
    filesize: 512,
    file_type: "archive",
    ext: ".zip",
    fingerprint: "fp",
  };

  beforeEach(() => {
    repo.upsertFile({ ...base, filepath: "/root/alpha.zip", filename: "alpha.zip", fingerprint: "fp1" });
    repo.upsertFile({ ...base, filepath: "/root/beta.zip", filename: "beta.zip", fingerprint: "fp2" });
    repo.saveParsedMetadata("/root/alpha.zip", { authors: ["AuthorAlpha"], rawTags: ["sci-fi"] });
    repo.saveParsedMetadata("/root/beta.zip", { authors: ["AuthorBeta"], rawTags: ["fantasy"] });
  });

  it("searchFiles by filename substring", () => {
    const results = repo.searchFiles("alpha");
    expect(results.some(r => r.filepath === "/root/alpha.zip")).toBe(true);
    expect(results.some(r => r.filepath === "/root/beta.zip")).toBe(false);
  });

  it("searchByAuthor returns matching files", () => {
    const results = repo.searchByAuthor("Alpha");
    expect(results.some(r => r.filepath === "/root/alpha.zip")).toBe(true);
  });

  it("searchByTag returns matching files", () => {
    const results = repo.searchByTag("sci");
    expect(results.some(r => r.filepath === "/root/alpha.zip")).toBe(true);
  });
});

// ─── folder_open_history ──────────────────────────────────────────────────────

describe("IndexRepository – folder_open_history", () => {
  it("recordFolderOpen and listTopOpenedFolderIds", () => {
    repo.recordFolderOpen("/a");
    repo.recordFolderOpen("/a");
    repo.recordFolderOpen("/b");
    const top = repo.listTopOpenedFolderIds(5);
    expect(top[0]).toBe("/a"); // /a opened more
  });
});
