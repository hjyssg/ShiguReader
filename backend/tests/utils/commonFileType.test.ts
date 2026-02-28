import { describe, it, expect } from "vitest";
import {
  getFileType,
  isImage,
  isVideo,
  isArchive,
  isAudio,
  isFolder,
  IMAGE_SUFFIXES,
  VIDEO_SUFFIXES,
  ARCHIVE_SUFFIXES,
  AUDIO_SUFFIXES,
} from "../../../common/src/fileTypeUtil.js"

describe("getFileType — images", () => {
  it.each(IMAGE_SUFFIXES.map((s) => [`file${s}`, "image"] as const))(
    "%s → image",
    (fp, expected) => expect(getFileType(fp)).toBe(expected),
  );
});

describe("getFileType — videos", () => {
  it.each(VIDEO_SUFFIXES.map((s) => [`file${s}`, "video"] as const))(
    "%s → video",
    (fp, expected) => expect(getFileType(fp)).toBe(expected),
  );
});

describe("getFileType — archives", () => {
  it.each(ARCHIVE_SUFFIXES.map((s) => [`file${s}`, "archive"] as const))(
    "%s → archive",
    (fp, expected) => expect(getFileType(fp)).toBe(expected),
  );
});

describe("getFileType — audio", () => {
  it.each(AUDIO_SUFFIXES.map((s) => [`file${s}`, "audio"] as const))(
    "%s → audio",
    (fp, expected) => expect(getFileType(fp)).toBe(expected),
  );
});

describe("getFileType — edge cases", () => {
  it("no extension → folder", () => {
    expect(getFileType("README")).toBe("folder");
    expect(getFileType("/a/b/somedir")).toBe("folder");
  });

  it("unknown extension → unknown", () => {
    expect(getFileType("file.xyz")).toBe("unknown");
    expect(getFileType("file.txt")).toBe("unknown");
  });

  it("case-insensitive", () => {
    expect(getFileType("IMG.JPG")).toBe("image");
    expect(getFileType("MOVIE.MKV")).toBe("video");
    expect(getFileType("ARCHIVE.ZIP")).toBe("archive");
    expect(getFileType("SONG.MP3")).toBe("audio");
  });

  it("Windows path", () => {
    expect(getFileType("D:\\folder\\img.png")).toBe("image");
  });

  it("compound extension .tar.gz", () => {
    expect(getFileType("backup.tar.gz")).toBe("archive");
  });

  it("trailing slash treated as folder", () => {
    expect(getFileType("/a/b/")).toBe("folder");
  });
});

describe("type predicates", () => {
  it("isImage", () => {
    expect(isImage("x.jpg")).toBe(true);
    expect(isImage("x.mp4")).toBe(false);
  });

  it("isVideo", () => {
    expect(isVideo("x.mp4")).toBe(true);
    expect(isVideo("x.zip")).toBe(false);
  });

  it("isArchive", () => {
    expect(isArchive("x.zip")).toBe(true);
    expect(isArchive("x.jpg")).toBe(false);
  });

  it("isAudio", () => {
    expect(isAudio("x.mp3")).toBe(true);
    expect(isAudio("x.mp4")).toBe(false);
  });

  it("isFolder", () => {
    expect(isFolder("somedir")).toBe(true);
    expect(isFolder("x.jpg")).toBe(false);
  });
});
