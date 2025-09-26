const assert = require('assert');
const scoreUtil = require("../utils/score-util");
const { getScoreFromCount } = scoreUtil;

describe('Test getScoreFromCount function', () => {
  it('Should return 0 when both good_count and bad_count is 0', () => {
    // 第一个测试用例测试当good_count和bad_count均为0时返回值是否为0。
    const result = getScoreFromCount({ good_count: 0, bad_count: 0, total_count: 0 });
    assert.strictEqual(result, 0);
  });

  it('Should return a negative value when good_count is 0', () => {
    // 第二个测试用例测试当good_count为0，bad_count大于0时返回值是否为负数。
    const result = getScoreFromCount({ good_count: 0, bad_count: 10, total_count: 10 });
    assert.strictEqual(result < 0, true);
  });

  it('Should return a value within 0~4', () => {
    // 第三个测试用例循环N次，每次随机生成三个参数good_count、bad_count和total_count并调用函数getScoreFromCount，然后判断返回值是否在0~4的范围内。
    const loop_time = 5000;
   
    // 测试有good的情况
    let min = 0, max = 0;
    for(let i=0; i<loop_time; i++){
      const goodCount = Math.floor(Math.random() * 800)+1;
      const badCount = Math.floor(Math.random() * 800);
      const totalCount = goodCount + badCount + Math.floor(Math.random() * 800);
      const result = getScoreFromCount({good_count: goodCount, bad_count: badCount, total_count: totalCount});
        max=Math.max(result, max);
        min=Math.min(result, min);
    }

    // console.log(min, max)
    assert.strictEqual(min >= 0 && max <= 4, true);
  });


    it('two compare case', () => {
      const result1 = getScoreFromCount({ good_count: 60, bad_count: 20, total_count: 100 });
      const result2 = getScoreFromCount({ good_count: 200, bad_count: 100, total_count: 400 });
      assert.strictEqual(result2 > result1, true);
    });
  

});
