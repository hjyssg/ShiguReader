const assert = require("assert");
const path = require("path");
const Module = require("module");

// 让 path-util 在 Linux 单测环境中也走 Windows 语义：仅在装载被测模块期间
// 将 Node.js 的 "path" 依赖替换为 win32 版本，避免污染全局。
const originalIsWindows = global.isWindows;
const win32Path = {
  ...path.win32,
  sep: "\\",
  delimiter: path.win32.delimiter,
  posix: path.posix,
  win32: path.win32,
};

function loadPathUtilWithWin32Path() {
  const originalLoad = Module._load;
  Module._load = function mockPath(request, parent, isMain) {
    if (request === "path") {
      return win32Path;
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    delete require.cache[require.resolve("../utils/path-util")];
    return require("../utils/path-util");
  } finally {
    Module._load = originalLoad;
  }
}

let pathUtil;

before(() => {
  global.isWindows = true;
  pathUtil = loadPathUtilWithWin32Path();
});

after(() => {
  if (originalIsWindows === undefined) {
    delete global.isWindows;
  } else {
    global.isWindows = originalIsWindows;
  }
  delete require.cache[require.resolve("../utils/path-util")];
});

describe("Path Util Test", function () {
  describe("isDirectParent()", function () {
    const cases = [
      {
        name: "父目录带结尾分隔符",
        parent: "C:\\Users\\",
        filePath: "C:\\Users\\file.txt",
        expected: true,
      },
      {
        name: "父目录不带结尾分隔符",
        parent: "C:\\Users",
        filePath: "C:\\Users\\file.txt",
        expected: true,
      },
      {
        name: "与文件不在同一层级",
        parent: "C:\\Users",
        filePath: "C:\\Users\\nested\\file.txt",
        expected: false,
      },
      {
        name: "大小写不同的同一路径",
        parent: "C:\\DATA",
        filePath: "c:\\data\\index.txt",
        expected: true,
      },
      {
        name: "不同盘符",
        parent: "D:\\Users",
        filePath: "C:\\Users\\file.txt",
        expected: false,
      },
    ];

    cases.forEach(({ name, parent, filePath, expected }) => {
      it(name, function () {
        assert.strictEqual(pathUtil.isDirectParent(parent, filePath), expected);
      });
    });
  });

  describe("removeLastPathSep()", function () {
    it("存在尾部分隔符时移除", function () {
      assert.strictEqual(pathUtil.removeLastPathSep("C:\\Users\\"), "C:\\Users");
    });

    it("没有尾部分隔符时返回原值", function () {
      assert.strictEqual(pathUtil.removeLastPathSep("C:\\Users"), "C:\\Users");
    });

    it("保留根目录的盘符形式", function () {
      assert.strictEqual(pathUtil.removeLastPathSep("C:\\"), "C:");
    });

    it("空字符串返回空字符串", function () {
      assert.strictEqual(pathUtil.removeLastPathSep(""), "");
    });
  });

  describe("isSub()", function () {
    const cases = [
      {
        name: "子目录与父目录同盘符",
        parent: "Y:\\_Downloads",
        child: "Y:\\_Downloads\\_pixiv",
        expected: true,
      },
      {
        name: "父目录保留尾部分隔符",
        parent: "Y:\\_Downloads\\",
        child: "Y:\\_Downloads\\_pixiv",
        expected: true,
      },
      {
        name: "多级子目录",
        parent: "Y:\\_Downloads",
        child: "Y:\\_Downloads\\_pixiv\\set01",
        expected: true,
      },
      {
        name: "仅大小写不同",
        parent: "D:\\Archive",
        child: "d:\\archive\\2024\\set",
        expected: true,
      },
      {
        name: "不同盘符直接判定为 false",
        parent: "C:\\Archive",
        child: "D:\\Archive\\2024",
        expected: false,
      },
      {
        name: "父子相同路径返回 false",
        parent: "Y:\\_Downloads",
        child: "Y:\\_Downloads",
        expected: false,
      },
      {
        name: "父目录少一级",
        parent: "D:\\_Happy_Lesson\\_Going_to_sort\\_not_good",
        child: "D:\\_Happy_Lesson\\_Going_to_sort\\_not_good\\not_good_2020",
        expected: true,
      },
    ];

    cases.forEach(({ name, parent, child, expected }) => {
      it(name, function () {
        assert.strictEqual(pathUtil.isSub(parent, child), expected);
      });
    });
  });

  describe("getExt()", function () {
    it("读取文件后缀", function () {
      assert.strictEqual(pathUtil.getExt("Y:\\_Downloads\\file.txt"), ".txt");
    });

    it("无后缀时返回空字符串", function () {
      assert.strictEqual(pathUtil.getExt("Y:\\_Downloads"), "");
      assert.strictEqual(pathUtil.getExt("Y:\\_Downloads\\alice [22P-362.71 MB]"), "");
    });

    it("统一转换为小写扩展名", function () {
      assert.strictEqual(pathUtil.getExt("Y:\\_Downloads\\cover.PNG"), ".png");
    });
  });

  describe("estimateIfFolder()", function () {
    it("路径没有扩展名时判断为文件夹", function () {
      assert.strictEqual(pathUtil.estimateIfFolder("Y:\\_Downloads"), true);
    });

    it("存在扩展名时判断为文件", function () {
      assert.strictEqual(pathUtil.estimateIfFolder("Y:\\_Downloads\\file.txt"), false);
    });
  });

  describe("filterHiddenFile()", function () {
    it("过滤掉以点开头的文件（类 Unix dotfile）", function () {
      const files = ["Y:\\_Downloads\\file.txt", "Y:\\_Downloads\\.hidden_file"];
      assert.deepStrictEqual(pathUtil.filterHiddenFile(files), ["Y:\\_Downloads\\file.txt"]);
    });

    it("全部为 dotfile 时返回空数组", function () {
      const files = [".hidden_file1", ".hidden_file2"];
      assert.deepStrictEqual(pathUtil.filterHiddenFile(files), []);
    });
  });

  describe("getDirName()", function () {
    it("返回文件所在目录名称", function () {
      assert.strictEqual(pathUtil.getDirName("Y:\\_Downloads\\file.txt"), "_Downloads");
    });

    it("目录路径自身时返回上一级目录名称", function () {
      assert.strictEqual(pathUtil.getDirName("Y:\\_Downloads\\sample"), "_Downloads");
    });
  });

  describe("isHiddenFile()", function () {
    it("以点开头视为隐藏文件（dotfile）", function () {
      assert.strictEqual(pathUtil.isHiddenFile(".hidden_file.txt"), true);
    });

    it("普通文件名返回 false", function () {
      assert.strictEqual(pathUtil.isHiddenFile("file.txt"), false);
    });
  });

  describe("isForbid()", function () {
    it("命中保留目录名称返回 true", function () {
      const str = "System Volume Information";
      assert.strictEqual(pathUtil.isForbid(str), true);
    });

    it("普通目录名称返回 false", function () {
      const str = "_Downloads";
      assert.strictEqual(pathUtil.isForbid(str), false);
    });
  });
});
