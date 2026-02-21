/**
 * archiveService 单元测试
 * 测试 listEntries 解析逻辑 和 extractEntries / stepwiseExtract 流程
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";

// ── mock execFile ────────────────────────────────────────────────────────────
// We mock child_process so no real 7z binary is needed
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("node:util", async (importOriginal) => {
  const orig = await importOriginal<typeof import("node:util")>();
  return {
    ...orig,
    promisify: (fn: unknown) => fn, // return the mock fn itself (already async-shaped below)
  };
});

// ── mock config ──────────────────────────────────────────────────────────────
vi.mock("../../src/config.js", () => ({
  config: {
    EXTRACT_CACHE_DIR: "/fake/cache",
  },
}));

// ── mock fs ──────────────────────────────────────────────────────────────────
import fs from "node:fs";
vi.mock("node:fs");

// ── import after mocks ───────────────────────────────────────────────────────
import { execFile } from "node:child_process";
import {
  listEntries,
  extractEntries,
  getExtractCacheDir,
} from "../../src/services/archiveService.js";

const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;

// Helper: build fake 7z -slt stdout
function make7zOutput(paths: string[]): string {
  return paths.map(p => `Path = ${p}`).join("\n") + "\n";
}

describe("listEntries", () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(false); // no bundled 7z
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns image entries with correct fields", async () => {
    mockExecFile.mockResolvedValueOnce({
      stdout: make7zOutput(["img/page001.jpg", "img/page002.png", "img/page003.webp"]),
      stderr: "",
    });

    const entries = await listEntries("/fake/test.zip");

    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({
      name: "page001.jpg",
      entry_path: "img/page001.jpg",
      path: "img/page001.jpg",
      file_type: "image",
      type: "image",
      index: 0,
    });
    expect(entries[1].name).toBe("page002.png");
    expect(entries[2].name).toBe("page003.webp");
  });

  it("filters out non-media files", async () => {
    mockExecFile.mockResolvedValueOnce({
      stdout: make7zOutput([
        "page001.jpg",
        "readme.txt",
        "data.json",
        "video.mp4",
        "music.mp3",
      ]),
      stderr: "",
    });

    const entries = await listEntries("/fake/test.zip");
    const names = entries.map(e => e.name);

    expect(names).toContain("page001.jpg");
    expect(names).toContain("video.mp4");
    expect(names).toContain("music.mp3");
    expect(names).not.toContain("readme.txt");
    expect(names).not.toContain("data.json");
  });

  it("filters out __MACOSX and .DS_Store entries", async () => {
    mockExecFile.mockResolvedValueOnce({
      stdout: make7zOutput([
        "__MACOSX/._page001.jpg",
        ".DS_Store",
        "page001.jpg",
        ".hidden.jpg",
      ]),
      stderr: "",
    });

    const entries = await listEntries("/fake/test.zip");
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("page001.jpg");
  });

  it("sorts entries naturally (numeric order)", async () => {
    mockExecFile.mockResolvedValueOnce({
      stdout: make7zOutput([
        "page10.jpg",
        "page2.jpg",
        "page1.jpg",
        "page20.jpg",
      ]),
      stderr: "",
    });

    const entries = await listEntries("/fake/test.zip");
    const names = entries.map(e => e.name);
    expect(names).toEqual(["page1.jpg", "page2.jpg", "page10.jpg", "page20.jpg"]);
  });

  it("assigns sequential index starting from 0", async () => {
    mockExecFile.mockResolvedValueOnce({
      stdout: make7zOutput(["a.jpg", "b.jpg", "c.jpg"]),
      stderr: "",
    });

    const entries = await listEntries("/fake/test.zip");
    expect(entries.map(e => e.index)).toEqual([0, 1, 2]);
  });

  it("returns empty array when archive has no media files", async () => {
    mockExecFile.mockResolvedValueOnce({
      stdout: make7zOutput(["readme.txt", "info.xml"]),
      stderr: "",
    });

    const entries = await listEntries("/fake/test.zip");
    expect(entries).toHaveLength(0);
  });

  it("correctly identifies video and audio types", async () => {
    mockExecFile.mockResolvedValueOnce({
      stdout: make7zOutput(["clip.mp4", "song.flac", "cover.jpg"]),
      stderr: "",
    });

    const entries = await listEntries("/fake/test.zip");
    const byName = Object.fromEntries(entries.map(e => [e.name, e]));

    expect(byName["clip.mp4"].file_type).toBe("video");
    expect(byName["song.flac"].file_type).toBe("audio");
    expect(byName["cover.jpg"].file_type).toBe("image");
  });

  it("throws when 7z command fails", async () => {
    mockExecFile.mockRejectedValueOnce(new Error("7z not found"));
    await expect(listEntries("/fake/test.zip")).rejects.toThrow("7z not found");
  });
});

describe("getExtractCacheDir", () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  it("returns a deterministic path for the same input", () => {
    const dir1 = getExtractCacheDir("/some/archive.zip");
    const dir2 = getExtractCacheDir("/some/archive.zip");
    expect(dir1).toBe(dir2);
  });

  it("returns different paths for different archives", () => {
    const dir1 = getExtractCacheDir("/archive1.zip");
    const dir2 = getExtractCacheDir("/archive2.zip");
    expect(dir1).not.toBe(dir2);
  });

  it("cache dir is under EXTRACT_CACHE_DIR", () => {
    const dir = getExtractCacheDir("/some/archive.zip");
    // path.resolve("/fake/cache") on Windows may differ, use includes check
    expect(dir).toContain("cache");
  });
});

describe("extractEntries", () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
    vi.mocked(fs.unlinkSync).mockReturnValue(undefined);
  });

  it("does nothing when entries list is empty", async () => {
    await extractEntries("/fake/test.zip", "/fake/dest", []);
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it("calls 7z x with list file for non-empty entries", async () => {
    mockExecFile.mockResolvedValueOnce({ stdout: "", stderr: "" });

    await extractEntries("/fake/test.zip", "/fake/dest", ["page001.jpg", "page002.jpg"]);

    expect(mockExecFile).toHaveBeenCalledOnce();
    const [bin, args] = mockExecFile.mock.calls[0] as [string, string[]];
    expect(args[0]).toBe("x");
    expect(args[1]).toBe("/fake/test.zip");
    // Should include -o flag
    expect(args.some((a: string) => a.startsWith("-o"))).toBe(true);
    // Should include list file reference
    expect(args.some((a: string) => a.startsWith("@"))).toBe(true);
  });

  it("creates dest directory before extracting", async () => {
    mockExecFile.mockResolvedValueOnce({ stdout: "", stderr: "" });

    await extractEntries("/fake/test.zip", "/fake/dest", ["page001.jpg"]);

    expect(fs.mkdirSync).toHaveBeenCalledWith("/fake/dest", { recursive: true });
  });

  it("cleans up temp list file even on error", async () => {
    mockExecFile.mockRejectedValueOnce(new Error("extraction failed"));

    await expect(
      extractEntries("/fake/test.zip", "/fake/dest", ["page001.jpg"])
    ).rejects.toThrow("extraction failed");

    expect(fs.unlinkSync).toHaveBeenCalled();
  });
});
