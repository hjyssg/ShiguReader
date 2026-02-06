const parser = require("../index");
const assert = require("assert");

describe("Performance testing", function () {
    this.timeout(10000); // 增加超时时间

    it("should parse 50,000 times within reasonable time", () => {
        const testCase = "(C101) [万能つまようじ入れ (微糖)] 甘雨残業中 (原神) [DL版].zip";

        console.time("parse_50000_times");
        for (let i = 0; i < 50000; i++) {
            // 我们清空缓存以模拟真实冷启动性能，或者保持缓存测试热启动
            // 默认情况下 parser 有内部 cache
            parser.parse(testCase);
        }
        console.timeEnd("parse_50000_times");
    });

    it("should parse 50,000 times without cache within reasonable time", () => {
        const testCase = "(C101) [万能つまようじ入れ (微糖)] 甘雨残業中 (原神) [DL版].zip";

        console.time("parse_50000_times_no_cache");
        for (let i = 0; i < 50000; i++) {
            // 构造不同的字符串以绕过缓存
            const str = testCase + i;
            parser.parse(str);
        }
        console.timeEnd("parse_50000_times_no_cache");
    });
});
