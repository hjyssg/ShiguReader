import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(__dirname, "schema.sql");

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!_db) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return _db;
}

export function initDb(dbPath: string): DatabaseSync {
  if (_db) return _db;

  _db = new DatabaseSync(dbPath);

  // Enable WAL mode for better concurrent read performance
  _db.exec("PRAGMA journal_mode=WAL");
  _db.exec("PRAGMA synchronous=NORMAL");
  _db.exec("PRAGMA foreign_keys=ON");
  _db.exec("PRAGMA busy_timeout=5000");

  // Apply schema
  const schema = readFileSync(SCHEMA_PATH, "utf-8");
  _db.exec(schema);

  return _db;
}

/** Create an in-memory DB for testing — always returns a fresh instance. */
export function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  const schema = readFileSync(SCHEMA_PATH, "utf-8");
  db.exec(schema);
  return db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

export function nowTs(): number {
  return Math.floor(Date.now() / 1000);
}
