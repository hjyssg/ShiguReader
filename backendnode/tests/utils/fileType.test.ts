import { describe, it, expect } from "vitest";
import {
  getExt,
  getFileType,
  isImage,
  isVideo,
  isArchive,
  isAudio,
  getMimeType,
  isDisplayable,
  makeFingerprint,
} from "../../src/utils/fileType.js";

describe("getExt", () => {
  it("returns lowercase extension", () => {
    expect(getExt("/a/b/Photo.JPG")).toBe(".jpg");
    expect(getExt("/a/b/video.MP4")).toBe(".mp4");
  });

  it("returns empty string for no extension", () => {
    expect(getExt("/a/b/README")).toBe("");
  });
});

describe("getFileType", () => {
  it.each([
    ["/a/img.jpg", "image"],
    ["/a/img.jpeg", "image"],
    ["/a/img.png", "image"],
    ["/a/img.webp", "image"],
    ["/a/img.gif", "image"],
    ["/a/img.bmp", "image"],
    ["/a/img.heic", "image"],
  ])("%s → image", (fp, expected) => {
    expect(getFileType(fp)).toBe(expected);
  });

  it.each([
    ["/a/v.mp4", "video"],
    ["/a/v.mkv", "video"],
    ["/a/v.avi", "video"],
    ["/a/v.mov", "video"],
    ["/a/v.webm", "video"],
    ["/a/v.flv", "video"],
    ["/a/v.wmv", "video"],
  ])("%s → video", (fp, expected) => {
    expect(getFileType(fp)).toBe(expected);
  });

  it.each([
    ["/a/a.zip", "archive"],
    ["/a/a.cbz", "archive"],
    ["/a/a.rar", "archive"],
    ["/a/a.cbr", "archive"],
    ["/a/a.7z", "archive"],
    ["/a/a.tar", "archive"],
    ["/a/a.tgz", "archive"],
  ])("%s → archive", (fp, expected) => {
    expect(getFileType(fp)).toBe(expected);
  });

  it.each([
    ["/a/s.mp3", "audio"],
    ["/a/s.flac", "audio"],
    ["/a/s.wav", "audio"],
    ["/a/s.aac", "audio"],
    ["/a/s.ogg", "audio"],
    ["/a/s.m4a", "audio"],
  ])("%s → audio", (fp, expected) => {
    expect(getFileType(fp)).toBe(expected);
  });

  it("returns unknown for unrecognised extension", () => {
    expect(getFileType("/a/file.xyz")).toBe("unknown");
    expect(getFileType("/a/README")).toBe("unknown");
  });

  it("is case-insensitive", () => {
    expect(getFileType("/a/IMG.PNG")).toBe("image");
    expect(getFileType("/a/MOVIE.MKV")).toBe("video");
  });
});

describe("type predicates", () => {
  it("isImage", () => {
    expect(isImage("/a/x.jpg")).toBe(true);
    expect(isImage("/a/x.mp4")).toBe(false);
  });

  it("isVideo", () => {
    expect(isVideo("/a/x.mp4")).toBe(true);
    expect(isVideo("/a/x.zip")).toBe(false);
  });

  it("isArchive", () => {
    expect(isArchive("/a/x.zip")).toBe(true);
    expect(isArchive("/a/x.jpg")).toBe(false);
  });

  it("isAudio", () => {
    expect(isAudio("/a/x.mp3")).toBe(true);
    expect(isAudio("/a/x.mp4")).toBe(false);
  });
});

describe("getMimeType", () => {
  it("returns correct mime for known types", () => {
    expect(getMimeType("/a/x.jpg")).toBe("image/jpeg");
    expect(getMimeType("/a/x.mp4")).toBe("video/mp4");
    expect(getMimeType("/a/x.mp3")).toBe("audio/mpeg");
    expect(getMimeType("/a/x.webp")).toBe("image/webp");
  });

  it("returns octet-stream for unknown", () => {
    expect(getMimeType("/a/x.xyz")).toBe("application/octet-stream");
  });
});

describe("isDisplayable", () => {
  it("returns true for known media types", () => {
    expect(isDisplayable("/a/x.jpg")).toBe(true);
    expect(isDisplayable("/a/x.zip")).toBe(true);
    expect(isDisplayable("/a/x.mp4")).toBe(true);
    expect(isDisplayable("/a/x.mp3")).toBe(true);
  });

  it("returns false for unknown types", () => {
    expect(isDisplayable("/a/x.txt")).toBe(false);
    expect(isDisplayable("/a/README")).toBe(false);
  });
});

describe("makeFingerprint", () => {
  it("produces a deterministic string", () => {
    const fp = makeFingerprint("/a/b.zip", 1700000000, 1024);
    expect(fp).toBe("/a/b.zip|1700000000|1024");
  });

  it("differs when any param changes", () => {
    const a = makeFingerprint("/a/b.zip", 1700000000, 1024);
    const b = makeFingerprint("/a/b.zip", 1700000001, 1024);
    const c = makeFingerprint("/a/b.zip", 1700000000, 2048);
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});
