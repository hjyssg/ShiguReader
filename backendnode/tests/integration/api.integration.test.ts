/**
 * Integration tests — real SQLite (temp file) + real app routes.
 * Uses initDb() with a temp file so getDb() works without any mocking.
 *
 * Covers Task 4 requirements from task-writeup.md:
 *   - search (file/author/tag), history/record+list, quick-match-batch
 *   - authors / tags listing, presence_filter, dedup, pagination
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { initDb, closeDb } from "../../src/db/client.js";
import { IndexRepository } from "../../src/db/repository.js";
import { buildApp } from "../../src/app.js";

// ── helpers ───────────────────────────────────────────────────────────────────

let tmpDir: string;
let repo: IndexRepository;

function seedFile(opts: {
  filepath: string;
  filename: string;
  folderpath?: string;
  authors?: string[];
  title?: string;
  groupName?: string;
  tags?: string[];
}) {
  repo.upsertFile({
    filepath: opts.filepath,
    filename: opts.filename,
    folderpath: opts.folderpath ?? path.dirname(opts.filepath),
    mtime: 1700000000,
    filesize: 1024,
    file_type: "archive",
    ext: ".zip",
  });
  if (opts.authors || opts.title || opts.tags || opts.groupName) {
    repo.saveParsedMetadata(opts.filepath, {
      title: opts.title,
      authors: opts.authors,
      groupName: opts.groupName,
      rawTags: opts.tags,
    });
  }
}

// ── setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shigureader-int-"));
  const dbPath = path.join(tmpDir, "test.db");
  const db = initDb(dbPath);
  repo = new IndexRepository(db);
});

afterEach(() => {
  closeDb();
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

// ── search ────────────────────────────────────────────────────────────────────

describe("POST /api/v1/search — integration", () => {
  beforeEach(() => {
    const mangaDir = path.join(tmpDir, "manga");
    fs.mkdirSync(mangaDir, { recursive: true });

    seedFile({
      filepath: path.join(mangaDir, "(C102) [サークル (作者A)] タイトルA.zip"),
      filename: "(C102) [サークル (作者A)] タイトルA.zip",
      folderpath: mangaDir,
      authors: ["作者A"],
      title: "タイトルA",
      groupName: "サークル",
      tags: ["fantasy", "action"],
    });
    seedFile({
      filepath: path.join(mangaDir, "(C102) [サークル (作者A)] タイトルB.zip"),
      filename: "(C102) [サークル (作者A)] タイトルB.zip",
      folderpath: mangaDir,
      authors: ["作者A"],
      title: "タイトルB",
      groupName: "サークル",
      tags: ["sci-fi"],
    });
    seedFile({
      filepath: path.join(mangaDir, "(コミティア155) [準特注くろますく (へたれん)] 勇者レベルアップでシスターから祝福をII.zip"),
      filename: "(コミティア155) [準特注くろますく (へたれん)] 勇者レベルアップでシスターから祝福をII.zip",
      folderpath: mangaDir,
      authors: ["へたれん"],
      title: "勇者レベルアップでシスターから祝福をII",
      groupName: "準特注くろますく",
    });
    seedFile({
      filepath: path.join(mangaDir, "(コミティア155) [準特注くろますく (へたれん)] 勇者レベルアップでシスターから祝福を1.zip"),
      filename: "(コミティア155) [準特注くろますく (へたれん)] 勇者レベルアップでシスターから祝福を1.zip",
      folderpath: mangaDir,
      authors: ["へたれん"],
      title: "勇者レベルアップでシスターから祝福を1",
      groupName: "準特注くろますく",
    });
  });

  it("searches by filename substring", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST", url: "/api/v1/search",
      payload: { q: "タイトルA", scopes: ["file"] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.some((i: { name: string }) => i.name.includes("タイトルA"))).toBe(true);
    expect(body.items.some((i: { name: string }) => i.name.includes("タイトルB"))).toBe(false);
  });

  it("searches by author", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST", url: "/api/v1/search",
      payload: { q: "作者A", scopes: ["author"] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().items.length).toBe(2);
  });

  it("searches by tag", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST", url: "/api/v1/search",
      payload: { q: "fantasy", scopes: ["tag"] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.length).toBe(1);
    expect(body.items[0].name).toContain("タイトルA");
  });

  it("deduplicates results across scopes", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST", url: "/api/v1/search",
      payload: { q: "作者A" },
    });
    const paths = res.json().items.map((i: { path: string }) => i.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("returns empty for blank query", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/api/v1/search", payload: { q: "" } });
    expect(res.json().items).toEqual([]);
  });

  it("presence_filter=present excludes missing files", async () => {
    const mangaDir = path.join(tmpDir, "manga");
    const missingPath = path.join(mangaDir, "missing.zip");
    repo.upsertFile({ filepath: missingPath, filename: "missing.zip", folderpath: mangaDir, mtime: 1, filesize: 1 });
    repo.markFileDeleted(missingPath);

    const app = buildApp();
    const res = await app.inject({
      method: "POST", url: "/api/v1/search",
      payload: { q: "missing", scopes: ["file"], presence_filter: "present" },
    });
    expect(res.json().items).toHaveLength(0);
  });
});

// ── history ───────────────────────────────────────────────────────────────────

describe("history/record + history/list — integration", () => {
  it("record then list returns the entry", async () => {
    const fp = path.join(tmpDir, "book.zip");
    repo.upsertFile({ filepath: fp, filename: "book.zip", mtime: 1700000000, filesize: 100 });

    const app = buildApp();
    const recRes = await app.inject({
      method: "POST", url: "/api/v1/history/record",
      payload: { filepath: fp },
    });
    expect(recRes.statusCode).toBe(200);

    const listRes = await app.inject({ method: "GET", url: "/api/v1/history/list" });
    expect(listRes.statusCode).toBe(200);
    const body = listRes.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].filepath).toBe(fp);
    expect(body.total).toBe(1);
  });

  it("same file recorded multiple times → multiple entries (append log)", async () => {
    const fp = path.join(tmpDir, "book.zip");
    repo.upsertFile({ filepath: fp, filename: "book.zip", mtime: 1700000000, filesize: 100 });

    const app = buildApp();
    for (let i = 0; i < 3; i++) {
      await app.inject({ method: "POST", url: "/api/v1/history/record", payload: { filepath: fp } });
    }

    const listRes = await app.inject({ method: "GET", url: "/api/v1/history/list" });
    expect(listRes.json().total).toBe(3);
  });

  it("pagination works correctly", async () => {
    for (let i = 0; i < 5; i++) {
      const fp = path.join(tmpDir, `book${i}.zip`);
      repo.upsertFile({ filepath: fp, filename: `book${i}.zip`, mtime: 1700000000, filesize: 100 });
      repo.recordRead(fp);
    }

    const app = buildApp();
    const p1 = await app.inject({ method: "GET", url: "/api/v1/history/list?page=1&page_size=2" });
    const p2 = await app.inject({ method: "GET", url: "/api/v1/history/list?page=2&page_size=2" });

    expect(p1.json().items).toHaveLength(2);
    expect(p2.json().items).toHaveLength(2);
    expect(p1.json().total).toBe(5);
    expect(p1.json().total_pages).toBe(3);
  });

  it("record without filepath returns 400", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/api/v1/history/record", payload: {} });
    expect(res.statusCode).toBe(400);
  });
});

// ── quick-match-batch ─────────────────────────────────────────────────────────

describe("POST /api/v1/search/quick-match-batch — integration", () => {
  beforeEach(() => {
    const mangaDir = path.join(tmpDir, "manga");
    fs.mkdirSync(mangaDir, { recursive: true });

    seedFile({
      filepath: path.join(mangaDir, "(コミティア155) [準特注くろますく (へたれん)] 勇者レベルアップでシスターから祝福をII.zip"),
      filename: "(コミティア155) [準特注くろますく (へたれん)] 勇者レベルアップでシスターから祝福をII.zip",
      folderpath: mangaDir,
      authors: ["へたれん"],
      title: "勇者レベルアップでシスターから祝福をII",
      groupName: "準特注くろますく",
    });
    seedFile({
      filepath: path.join(mangaDir, "(コミティア155) [準特注くろますく (へたれん)] 勇者レベルアップでシスターから祝福を1.zip"),
      filename: "(コミティア155) [準特注くろますく (へたれん)] 勇者レベルアップでシスターから祝福を1.zip",
      folderpath: mangaDir,
      authors: ["へたれん"],
      title: "勇者レベルアップでシスターから祝福を1",
      groupName: "準特注くろますく",
    });
  });

  it("same book with DL版 noise → downloaded", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST", url: "/api/v1/search/quick-match-batch",
      payload: {
        queries: ["(コミティア155) [準特注くろますく (へたれん)] 勇者レベルアップでシスターから祝福をII (オリジナル) [DL版]"],
        presence_filter: "all",
      },
    });
    expect(res.statusCode).toBe(200);
    const r = res.json().results[0];
    expect(r.match_level).toBe("downloaded");
  });

  it("different volume (vol 2 not in DB) → not downloaded", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST", url: "/api/v1/search/quick-match-batch",
      payload: {
        queries: ["(コミティア155) [準特注くろますく (へたれん)] 勇者レベルアップでシスターから祝福を2 (オリジナル) [DL版]"],
        presence_filter: "all",
      },
    });
    const r = res.json().results[0];
    expect(r.match_level).not.toBe("downloaded");
  });

  it("empty queries → empty results", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST", url: "/api/v1/search/quick-match-batch",
      payload: { queries: [] },
    });
    expect(res.json().results).toEqual([]);
  });

  it("completely different title → different", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST", url: "/api/v1/search/quick-match-batch",
      payload: { queries: ["[SomeOtherAuthor] 全然違うタイトル"] },
    });
    expect(res.json().results[0].match_level).toBe("different");
  });

  it("compat alias /api/search/quick-match-batch works", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST", url: "/api/search/quick-match-batch",
      payload: { queries: [] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().results).toEqual([]);
  });
});

// ── authors / tags listing ────────────────────────────────────────────────────

describe("authors + tags listing — integration", () => {
  beforeEach(() => {
    const dir = path.join(tmpDir, "manga");
    fs.mkdirSync(dir, { recursive: true });
    seedFile({ filepath: path.join(dir, "a.zip"), filename: "a.zip", folderpath: dir, authors: ["AuthorX"], tags: ["tag1", "tag2"] });
    seedFile({ filepath: path.join(dir, "b.zip"), filename: "b.zip", folderpath: dir, authors: ["AuthorX", "AuthorY"], tags: ["tag1"] });
  });

  it("GET /api/v1/authors lists authors with file counts", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/authors" });
    expect(res.statusCode).toBe(200);
    const ax = res.json().items.find((a: { name: string }) => a.name === "AuthorX");
    expect(ax).toBeDefined();
    expect(ax.file_count).toBe(2);
  });

  it("GET /api/v1/tags lists tags with file counts", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/tags" });
    expect(res.statusCode).toBe(200);
    const t1 = res.json().items.find((t: { name: string }) => t.name === "tag1");
    expect(t1).toBeDefined();
    expect(t1.file_count).toBe(2);
  });
});
