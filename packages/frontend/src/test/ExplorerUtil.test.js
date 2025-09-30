const assert = require("assert");

const { sortFiles } = require("../utils/ExplorerUtil");
const ClientConstant = require("../utils/ClientConstant");

const createInfo = (overrides = {}) => ({
  context: {},
  getMtime: () => 1,
  getTTime: () => 1,
  getScore: () => 0,
  getLastReadTime: () => 0,
  getReadCount: () => 0,
  getFileSize: () => 0,
  getPageAvgSize: () => 0,
  getPageNum: () => 0,
  ...overrides,
});

describe("ExplorerUtil sortFiles", () => {
  it("should sort files alphabetically when using BY_FILENAME", () => {
    const files = ["folder/b.mp4", "folder/a.mp4", "folder/c.mp4"];
    const info = createInfo();

    const result = sortFiles(info, [...files], ClientConstant.BY_FILENAME, true);

    assert.deepStrictEqual(result, [
      "folder/a.mp4",
      "folder/b.mp4",
      "folder/c.mp4",
    ]);
  });

  it("should honor good and not-good folders when sorting by score", () => {
    const files = [
      "/data/notGood/book-c.zip",
      "/data/misc/book-b.zip",
      "/data/good/book-a.zip",
    ];

    const baseScore = {
      "/data/notGood/book-c.zip": 10,
      "/data/misc/book-b.zip": 10,
      "/data/good/book-a.zip": 10,
    };

    const info = createInfo({
      context: {
        good_folder_root: "/data/good",
        not_good_folder_root: "/data/notGood",
      },
      getScore: (fp) => baseScore[fp],
    });

    const ascResult = sortFiles(
      info,
      [...files],
      ClientConstant.BY_GOOD_SCORE,
      true
    );

    assert.deepStrictEqual(ascResult, [
      "/data/notGood/book-c.zip",
      "/data/misc/book-b.zip",
      "/data/good/book-a.zip",
    ]);

    const descResult = sortFiles(
      info,
      [...files],
      ClientConstant.BY_GOOD_SCORE,
      false
    );

    assert.deepStrictEqual(descResult, [
      "/data/good/book-a.zip",
      "/data/misc/book-b.zip",
      "/data/notGood/book-c.zip",
    ]);
  });

  it("should group files by directory when sorting by folder", () => {
    const files = [
      "folderB/item-2.png",
      "folderA/sub/item-3.png",
      "folderA/item-1.png",
    ];

    const info = createInfo();

    const result = sortFiles(
      info,
      [...files],
      ClientConstant.BY_FOLDER,
      true
    );

    assert.deepStrictEqual(result, [
      "folderA/item-1.png",
      "folderA/sub/item-3.png",
      "folderB/item-2.png",
    ]);
  });
});
