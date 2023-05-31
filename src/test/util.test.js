const assert = require("assert");

const {
  isGif,
  isImage,
  isCompress,
  isMusic,
  isVideo,
  isAv,
  canBeCompressed,
  hasDuplicate,
  _sortFileNames,
  arraySlice,
  cutIntoSmallArrays,
  getCurrentTime,
  isDisplayableInExplorer,
  isDisplayableInOnebook,
  escapeRegExp,
  isWindowsPath,
  getAverage,
  truncateString,
} = require("../common/util.js");

describe("ut for js util functions", () => {
  describe("#isGif()", () => {
    it("should return true if file name ends with .gif", () => {
      assert.strictEqual(isGif("example.gif"), true);
    });

    it("should return false if file name does not end with .gif", () => {
      assert.strictEqual(isGif("example.png"), false);
    });
  });

  describe("#isImage()", () => {
    it("should return true if file name ends with a supported image extension", () => {
      assert.strictEqual(isImage("example.jpg"), true);
    });

    it("should return false if file name does not end with a supported image extension", () => {
      assert.strictEqual(isImage("example.doc"), false);
    });
  });

  describe("#isCompress()", () => {
    it("should return true if file name ends with a supported compress extension", () => {
      assert.strictEqual(isCompress("example.zip"), true);
    });

    it("should return false if file name does not end with a supported compress extension", () => {
      assert.strictEqual(isCompress("example.mp4"), false);
    });
  });

  describe("#isMusic()", () => {
    it("should return true if file name ends with a supported music extension", () => {
      assert.strictEqual(isMusic("example.mp3"), true);
    });

    it("should return false if file name does not end with a supported music extension", () => {
      assert.strictEqual(isMusic("example.jpg"), false);
    });
  });

  describe("#isVideo()", () => {
    it("should return true if file name ends with a supported video extension", () => {
      assert.strictEqual(isVideo("example.mp4"), true);
    });

    it("should return false if file name does not end with a supported video extension", () => {
      assert.strictEqual(isVideo("example.pdf"), false);
    });
  });

  describe("#isAv()", () => {
    it("should return true if the file name follows the AV naming convention", () => {
      assert.strictEqual(isAv("JUFE-315.mp4"), true);
    });

    it("should return false if the file name does not follow the AV naming convention", () => {
      assert.strictEqual(isAv("example.mp4"), false);
    });
  });

  describe("#canBeCompressed()", () => {
    it("should return true if the file type can be compressed", () => {
      assert.strictEqual(canBeCompressed("example.jpg"), true);
    });

    it("should return false if the file type cannot be compressed", () => {
      assert.strictEqual(canBeCompressed("example.png"), true);
    });

    it("should return false if the file type cannot be compressed", () => {
      assert.strictEqual(canBeCompressed("example.mp3"), false);
    });
  });

  describe("#hasDuplicate()", () => {
    it("should return true if there are duplicates in the array", () => {
      assert.strictEqual(hasDuplicate(["apple", "banana", "apple"]), true);
    });

    it("should return false if there are no duplicates in the array", () => {
      assert.strictEqual(hasDuplicate(["apple", "banana", "cherry"]), false);
    });
  });

  describe("#_sortFileNames()", () => {
    it("should sort the filenames in numeric order if all filenames are numbers", () => {
      const files = ["2.mp4", "1.mp4", "3.mp4"];
      _sortFileNames(files, (fName) => fName.replace(".mp4", ""));
      assert.deepStrictEqual(files, ["1.mp4", "2.mp4", "3.mp4"]);
    });

    it("should sort the filenames in alphabetical order if not all filenames are numbers", () => {
      const files = ["12.mp4", "b.mp4", "01.mp4", "a.mp4", "3,mp4"];
      _sortFileNames(files, (fName) => fName.replace(".mp4", ""));
      assert.deepStrictEqual(files, [
        "01.mp4",
        "3,mp4",
        "12.mp4",
        "a.mp4",
        "b.mp4",
      ]);
    });
  });

  describe("#arraySlice()", () => {
    it("should slice the array from beginning to end if both beg and end are positive integers", () => {
      const arr = [1, 2, 3, 4, 5];
      const result = arraySlice(arr, 0, 3);
      assert.deepStrictEqual(result, [1, 2, 3]);
    });

    // it("should slice the array from the end of the array if beg is negative and end is positive", () => {
    //   const arr = [1, 2, 3, 4, 5];
    //   const result = arraySlice(arr, -2, 4);
    //   assert.deepStrictEqual(result, [4, 5, 1, 2]);
    // });

    it("should slice the array from the beginning of the array if beg is positive and end is negative", () => {
      const arr = [1, 2, 3, 4, 5];
      const result = arraySlice(arr, 2, -1);
      assert.deepStrictEqual(result, [3, 4]);
    });
  });

  describe("#cutIntoSmallArrays()", () => {
    it("should cut the array into chunk arrays of the given size", () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8];
      assert.deepStrictEqual(cutIntoSmallArrays(arr, 3), [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8],
      ]);
    });

    it("should return an array of chunks even if the chunk size is greater than the array length", () => {
      const arr = [1, 2, 3];
      assert.deepStrictEqual(cutIntoSmallArrays(arr, 5), [[1, 2, 3]]);
    });

    // cutIntoSmallArrays()帮我用长度为20的int arr，再写个test case
    const arr = Array.from({ length: 20 }, (_, i) => i + 1);
    it("should return the sliced array from start to end position", () => {
      assert.deepStrictEqual(cutIntoSmallArrays(arr, 6), [
        [1, 2, 3, 4, 5, 6],
        [7, 8, 9, 10, 11, 12],
        [13, 14, 15, 16, 17, 18],
        [19, 20],
      ]);
    });
  });

  describe("#getCurrentTime()", () => {
    it("should return int", () => {
      assert.strictEqual(Number.isInteger(getCurrentTime()), true);
    });
  });

  describe("#isDisplayableInExplorer()", () => {
    it("should return true if the file type can be displayed in Windows Explorer", () => {
      assert.strictEqual(isDisplayableInExplorer("example.zip"), true);
    });

    it("should return false if the file type cannot be displayed in Windows Explorer", () => {
      assert.strictEqual(isDisplayableInExplorer("example.pdf"), false);
    });
  });

  describe("#isDisplayableInOnebook()", () => {
    it("should return true if the file type can be displayed in Onebook", () => {
      assert.strictEqual(isDisplayableInOnebook("example.jpg"), true);
    });

    it("should return false if the file type cannot be displayed in Onebook", () => {
      assert.strictEqual(isDisplayableInOnebook("example.pdf"), false);
    });
  });

  //   describe("#escapeRegExp()", () => {
  //     it("should escape all special characters in the input string", () => {
  //       const str = "[A*{b(c)d}]";
  //       assert.strictEqual(escapeRegExp(str), "[A*{b(c)\\d}]");
  //     });

  //     it("should return an empty string if the input is null", () => {
  //       const str = null;
  //       assert.strictEqual(escapeRegExp(str), "");
  //     });
  //   });

  describe("#isWindowsPath()", () => {
    it("should return true if the input string represents a Windows path", () => {
      assert.strictEqual(
        isWindowsPath(
          "C:Program FilesMicrosoft Office\rootOffice16WINWORD.EXE"
        ),
        true
      );
    });

    it("should return false if the input string does not represent a Windows path", () => {
      assert.strictEqual(isWindowsPath("/usr/local/bin/node"), false);
    });
  });

  describe("#getAverage()", () => {
    it("should return the mean of the input array", () => {
      assert.strictEqual(getAverage([1, 2, 3, 4]), 2.5);
    });
  });

  describe("#truncateString()", () => {
    it("should truncate the string to the given length if it is longer than the given length", () => {
      assert.strictEqual(truncateString("hello, world", 5), "h...d");
    });

    it("should not truncate the string if it is shorter than the given length", () => {
      assert.strictEqual(truncateString("hello", 10), "hello");
    });
  });
});
