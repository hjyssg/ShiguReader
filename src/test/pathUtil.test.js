// 引入需要测试的函数
const pathUtil = require("../server/pathUtil");
const assert = require("assert");

describe("Path Util Test", function () {
  describe("isDirectParent()", function () {
    // 测试 isDirectParent() 函数
    it("should return true if parent is a direct parent of filePath", function () {
      const parent = "C:\\Users\\";
      const filePath = "C:\\Users\\file.txt";
      const result = pathUtil.isDirectParent(parent, filePath);
      assert.strictEqual(result, true);
    });

    it("should return true if parent is a direct parent of filePath 2", function () {
        const parent = "C:\\Users";
        const filePath = "C:\\Users\\file.txt";
        const result = pathUtil.isDirectParent(parent, filePath);
        assert.strictEqual(result, true);
    });

    it("should return false if parent is not a direct parent of filePath", function () {
      const parent = "C:\\Users\\";
      const filePath = "C:\\file.txt";
      const result = pathUtil.isDirectParent(parent, filePath);
      assert.strictEqual(result, false);
    });

    it("should return false if parent is not a direct parent of filePath 2", function () {
        const parent = "C:\\Users\\";
        const filePath = "C:\\file.txt";
        const result = pathUtil.isDirectParent(parent, filePath);
        assert.strictEqual(result, false);
      });




  });

  describe("removeLastPathSep()", function () {
    // 测试 removeLastPathSep() 函数
    it("should remove the last path separator if exists", function () {
      const fp = "C:\\Users\\";
      const result = pathUtil.removeLastPathSep(fp);
      assert.strictEqual(result, "C:\\Users");
    });

    it("should return the original string if there is no last path separator", function () {
      const fp = "C:\\Users";
      const result = pathUtil.removeLastPathSep(fp);
      assert.strictEqual(result, "C:\\Users");
    });
  });

  describe("isSub()", function () {
    // 测试 isSub() 函数
    it("should return true if child is a subdirectory of parent 1", function () {
      const parent = "Y:\\_Downloads";
      const child = "Y:\\_Downloads\\_pixiv";
      const result = pathUtil.isSub(parent, child);
      assert.strictEqual(result, true);
    });

    it("should return true if child is a subdirectory of parent 2", function () {
        const parent = "Y:\\_Downloads\\";
        const child = "Y:\\_Downloads\\_pixiv";
        const result = pathUtil.isSub(parent, child);
        assert.strictEqual(result, true);
      });

    it("should return true if child is a subdirectory of parent  3", function () {
        const parent = "Y:\\_Downloads";
        const child = "Y:\\_Downloads\\_pixiv\\asdsda";
        const result = pathUtil.isSub(parent, child);
        assert.strictEqual(result, true);
    });

    it("should return true if child is a subdirectory of parent  4", function () {
        const parent = "Y:\\_Downloads\\";
        const child = "Y:\\_Downloads\\_pixiv\\asdsda";
        const result = pathUtil.isSub(parent, child);
        assert.strictEqual(result, true);
    });

    it("should return false if child is not a subdirectory of parent 5", function () {
      const parent = "Y:\\_Downloads";
      const child = "Y:\\_Downloads";
      const result = pathUtil.isSub(parent, child);
      assert.strictEqual(result, false);
    });

    it("should return false if child is not a subdirectory of parent 6", function () {
        const parent = "Y:\\_Downloads\\";
        const child = "Y:\\_Downloads";
        const result = pathUtil.isSub(parent, child);
        assert.strictEqual(result, false);
      });

    it(" 7 ", function () {
        assert.strictEqual(pathUtil.isSub("D:\\_Happy_Lesson\\_Going_to_sort\\_not_good\\", "D:\\_Happy_Lesson\\_Going_to_sort\\_not_good\\not_good_2020"), true);
        assert.strictEqual(pathUtil.isSub("D:\\_Happy_Lesson\\_Going_to_sort\\_not_good", "D:\\_Happy_Lesson\\_Going_to_sort\\_not_good\\not_good_2020"), true);
    });

  });

  describe("getExt()", function () {
    // 测试 getExt() 函数
    it("should return the extension of the file path", function () {
      const p = "Y:\\_Downloads\\file.txt";
      const result = pathUtil.getExt(p);
      assert.strictEqual(result, ".txt");
    });

    it("should return an empty string if the file path has no extension", function () {
      const p = "Y:\\_Downloads";
      const result = pathUtil.getExt(p);
      assert.strictEqual(result, "");
    });
  });

  describe("estimateIfFolder()", function () {
    // 测试 estimateIfFolder() 函数
    it("should return true if the file path is a folder", function () {
      const filePath = "Y:\\_Downloads";
      const result = pathUtil.estimateIfFolder(filePath);
      assert.strictEqual(result, true);
    });

    it("should return false if the file path is not a folder", function () {
      const filePath = "Y:\\_Downloads\\file.txt";
      const result = pathUtil.estimateIfFolder(filePath);
      assert.strictEqual(result, false);
    });
  });

  describe("filterHiddenFile()", function () {
    // 测试 filterHiddenFile() 函数
    it("should return files with non-hidden names", function () {
      const files = ["Y:\\_Downloads\\file.txt", "Y:\\_Downloads\\.hidden_file"];
      const result = pathUtil.filterHiddenFile(files);
      assert.deepStrictEqual(result, ["Y:\\_Downloads\\file.txt"]);
    });

    it("should return empty array if all files have hidden names", function () {
      const files = [".hidden_file1", ".hidden_file2"];
      const result = pathUtil.filterHiddenFile(files);
      assert.deepStrictEqual(result, []);
    });
  });

  describe("getDirName()", function () {
    // 测试 getDirName() 函数
    it("should return the name of the directory containing the file path", function () {
      const p = "Y:\\_Downloads\\file.txt";
      const result = pathUtil.getDirName(p);
      assert.strictEqual(result, "_Downloads");
    });
  });

  describe("isHiddenFile()", function () {
    // 测试 isHiddenFile() 函数
    it("should return true if the file name starts with a dot (.)", function () {
      const f = ".hidden_file.txt";
      const result = pathUtil.isHiddenFile(f);
      assert.strictEqual(result, true);
    });

    it("should return false if the file name does not start with a dot (.)", function () {
      const f = "file.txt";
      const result = pathUtil.isHiddenFile(f);
      assert.strictEqual(result, false);
    });
  });

  describe("isForbid()", function () {
    // 测试 isForbid() 函数
    it("should return true if the string matches any forbidden folder names", function () {
      const str = "System Volume Information";
      const result = pathUtil.isForbid(str);
      assert.strictEqual(result, true);
    });

    it("should return false if the string does not match any forbidden folder names", function () {
      const str = "_Downloads";
      const result = pathUtil.isForbid(str);
      assert.strictEqual(result, false);
    });
  });
});
