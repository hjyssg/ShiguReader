/**
 * Verify that Node.js built-in `node:sqlite` works correctly.
 * Node 22.5+ ships an experimental SQLite module; Node 24+ it's stable.
 * If this test passes we use it; otherwise we fall back to better-sqlite3.
 */
import { describe, it, expect, afterEach } from "vitest";
import { DatabaseSync } from "node:sqlite";

describe("node:sqlite basic functionality", () => {
  let db: DatabaseSync;

  afterEach(() => {
    try {
      db?.close();
    } catch {}
  });

  it("opens an in-memory database", () => {
    db = new DatabaseSync(":memory:");
    expect(db).toBeTruthy();
  });

  it("creates a table and inserts/queries rows", () => {
    db = new DatabaseSync(":memory:");
    db.exec(`CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT NOT NULL)`);
    const insert = db.prepare("INSERT INTO test (name) VALUES (?)");
    insert.run("hello");
    insert.run("world");

    const rows = db.prepare("SELECT * FROM test ORDER BY id").all() as Array<{ id: number; name: string }>;
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("hello");
    expect(rows[1].name).toBe("world");
  });

  it("supports transactions", () => {
    db = new DatabaseSync(":memory:");
    db.exec(`CREATE TABLE counter (val INTEGER)`);
    db.exec("BEGIN");
    db.exec("INSERT INTO counter VALUES (1)");
    db.exec("INSERT INTO counter VALUES (2)");
    db.exec("COMMIT");

    const row = db.prepare("SELECT SUM(val) as total FROM counter").get() as { total: number };
    expect(row.total).toBe(3);
  });

  it("supports prepared statement with named params", () => {
    db = new DatabaseSync(":memory:");
    db.exec(`CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT)`);
    const upsert = db.prepare(
      "INSERT INTO kv (key, value) VALUES (:key, :value) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    );
    upsert.run({ key: "foo", value: "bar" });
    upsert.run({ key: "foo", value: "baz" });

    const row = db.prepare("SELECT value FROM kv WHERE key = ?").get("foo") as { value: string };
    expect(row.value).toBe("baz");
  });

  it("returns undefined for missing row", () => {
    db = new DatabaseSync(":memory:");
    db.exec(`CREATE TABLE t (id INTEGER PRIMARY KEY)`);
    const row = db.prepare("SELECT * FROM t WHERE id = ?").get(999);
    expect(row).toBeUndefined();
  });
});
