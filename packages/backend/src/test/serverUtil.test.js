const assert = require("assert");
const path = require("path");

const serverUtil = require("../utils/server-util");
const appState = require("../state/appState");

const {
  chooseThumbnailImage,
  filterObjectProperties,
  checkOneBookRes,
  convertFileRowsIntoFileInfo,
  joinThumbnailFolderPath,
} = serverUtil;

describe("server util", () => {
  describe("chooseThumbnailImage", () => {
    it("should ignore hidden files and pick the first image after sorting", () => {
      const files = [
        "folder/.hidden.jpg",
        "folder/cover.png",
        "folder/page-02.jpg",
        "folder/page-01.jpg",
        "folder/readme.txt",
      ];

      const result = chooseThumbnailImage(files);
      assert.strictEqual(result, "folder/cover.png");
    });

    it("should return null when no candidates available", () => {
      assert.strictEqual(chooseThumbnailImage([]), null);
    });
  });

  describe("filterObjectProperties", () => {
    it("should keep only provided keys and warn for unknown keys when requested", () => {
      const obj = { keep: 1, drop: 2 };
      const warnings = [];
      const originalWarn = console.warn;
      console.warn = (...args) => warnings.push(args.join(" "));

      try {
        const filtered = filterObjectProperties(obj, ["keep"], true);
        assert.deepStrictEqual(filtered, { keep: 1 });
        assert.strictEqual(warnings.length, 1);
        assert.ok(warnings[0].includes("drop"));
      } finally {
        console.warn = originalWarn;
      }
    });
  });

  describe("checkOneBookRes", () => {
    it("should drop unexpected keys while keeping the allowed ones", () => {
      const input = {
        zipInfo: {},
        path: "book.zip",
        stat: {},
        imageFiles: [],
        musicFiles: [],
        videoFiles: [],
        dirs: [],
        outputPath: "/tmp/out",
        extra: "should be removed",
      };

      const result = checkOneBookRes({ ...input });
      assert.deepStrictEqual(
        Object.keys(result).sort(),
        [
          "dirs",
          "imageFiles",
          "musicFiles",
          "outputPath",
          "path",
          "stat",
          "videoFiles",
          "zipInfo",
        ]
      );
      assert.strictEqual(result.extra, undefined);
    });
  });

  describe("convertFileRowsIntoFileInfo", () => {
    it("should map rows into an object keyed by filePath", () => {
      const rows = [
        { filePath: "a/b/c.txt", size: 10, mTime: 100 },
        { filePath: "x/y/z.txt", size: 5, mTime: 200 },
      ];

      const result = convertFileRowsIntoFileInfo(rows);
      assert.deepStrictEqual(result, {
        "a/b/c.txt": { size: 10, mtimeMs: 100 },
        "x/y/z.txt": { size: 5, mtimeMs: 200 },
      });
    });
  });

  describe("joinThumbnailFolderPath", () => {
    const originalPath = appState.getThumbnailFolderPath();

    afterEach(() => {
      appState.setPaths({ thumbnailFolderPath: originalPath });
    });

    it("should join the configured thumbnail folder with the provided file name", () => {
      appState.setPaths({ thumbnailFolderPath: path.join("/tmp", "thumbs") });
      const result = joinThumbnailFolderPath("cover.png");
      assert.strictEqual(
        result,
        path.join(path.join("/tmp", "thumbs"), "cover.png")
      );
    });

    it("should return empty string when file name is falsy", () => {
      appState.setPaths({ thumbnailFolderPath: path.join("/tmp", "thumbs") });
      assert.strictEqual(joinThumbnailFolderPath(""), "");
    });
  });
});
