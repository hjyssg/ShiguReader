/**
 * Integration tests for thumbnail generation using real files in D:\Git\test
 *
 * Tests:
 *  - .zip archive  → extract first image → imagemagick resize → JPEG
 *  - .7z  archive  → same
 *  - .mp4 video    → ffmpeg frame capture → JPEG
 */
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Override config before importing thumbService
process.env.THUMB_CACHE_DIR = path.join(os.tmpdir(), "shigureader-thumb-test-" + Date.now());
process.env.THUMB_HEIGHT = "200";
process.env.THUMB_JPEG_QUALITY = "70";
process.env.THUMB_TIMEOUT_SEC = "30";

import { getOrGenerateThumb, getCachedThumbPath } from "../../src/services/thumbService.js";

const TEST_DIR = "D:\\Git\\test";

// Discover test files
function findFile(ext: string): string | null {
  try {
    const entries = fs.readdirSync(TEST_DIR);
    const found = entries.find(e => e.toLowerCase().endsWith(ext));
    return found ? path.join(TEST_DIR, found) : null;
  } catch {
    return null;
  }
}

const zipFile  = findFile(".zip");
const sevenzFile = findFile(".7z");
const mp4File  = findFile(".mp4");

beforeAll(() => {
  fs.mkdirSync(process.env.THUMB_CACHE_DIR!, { recursive: true });
});

describe.skipIf(!fs.existsSync(TEST_DIR))("Thumbnail generation — real files", () => {
  it("test dir exists and has files", () => {
    expect(fs.existsSync(TEST_DIR)).toBe(true);
    const files = fs.readdirSync(TEST_DIR);
    expect(files.length).toBeGreaterThan(0);
    console.log("Test files:", files);
  });

  it.skipIf(!zipFile)("generates thumbnail for .zip archive", async () => {
    console.log("Testing zip:", zipFile);
    const result = await getOrGenerateThumb(zipFile!);
    console.log("Zip thumb result:", result);
    expect(result).not.toBeNull();
    expect(fs.existsSync(result!)).toBe(true);
    expect(fs.statSync(result!).size).toBeGreaterThan(0);
    // should be a JPEG
    const buf = Buffer.alloc(3);
    const fd = fs.openSync(result!, "r");
    fs.readSync(fd, buf, 0, 3, 0);
    fs.closeSync(fd);
    // JPEG magic bytes: FF D8 FF
    expect(buf[0]).toBe(0xff);
    expect(buf[1]).toBe(0xd8);
    expect(buf[2]).toBe(0xff);
  }, 60_000);

  it.skipIf(!sevenzFile)("generates thumbnail for .7z archive", async () => {
    console.log("Testing 7z:", sevenzFile);
    const result = await getOrGenerateThumb(sevenzFile!);
    console.log("7z thumb result:", result);
    expect(result).not.toBeNull();
    expect(fs.existsSync(result!)).toBe(true);
    expect(fs.statSync(result!).size).toBeGreaterThan(0);
  }, 60_000);

  it.skipIf(!mp4File)("generates thumbnail for .mp4 video", async () => {
    console.log("Testing mp4:", mp4File);
    const result = await getOrGenerateThumb(mp4File!);
    console.log("mp4 thumb result:", result);
    expect(result).not.toBeNull();
    expect(fs.existsSync(result!)).toBe(true);
    expect(fs.statSync(result!).size).toBeGreaterThan(0);
  }, 60_000);

  it.skipIf(!zipFile)("returns cached result on second call", async () => {
    if (!zipFile) return;
    const r1 = await getOrGenerateThumb(zipFile);
    const r2 = await getOrGenerateThumb(zipFile);
    expect(r1).toBe(r2);
    // cache path should be deterministic
    expect(r1).toBe(getCachedThumbPath(zipFile));
  }, 60_000);
});
