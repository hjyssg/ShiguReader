const assert = require('assert');
const {
  IS_IN_PC,
  LIKELY_IN_PC,
  SAME_AUTHOR,
  TOTALLY_DIFFERENT,
  isTwoBookTheSame,
  extractMiddleChars,
  compareInternalDigit
} = require('../server/BookCompareUtil');

describe('isTwoBookTheSame', () => {
  it('should return TOTALLY_DIFFERENT for filenames with no parsed result', () => {
    const result = isTwoBookTheSame('(成年コミック) [雑誌] 異世快楽天 Vol.11', '(成年コミック) [あるぷ] インモラルーティーン [DL版]');
    assert.strictEqual(result, TOTALLY_DIFFERENT);
  });

  it('should return TOTALLY_DIFFERENT for filenames with different authors', () => {
    const result = isTwoBookTheSame('(成年コミック) [vanilla] アンドロイドのわたしに燃料補給してくださいっ [DL版]', 
                                    '(COMIC1☆22) [Lonely Church (鈴音れな)] 姫様がエロトラップに引っかかるワケがない (遊☆戯☆王OCG)');
    assert.strictEqual(result, TOTALLY_DIFFERENT);
  });

  it('should return SAME_AUTHOR for filenames with the same author', () => {
    const result = isTwoBookTheSame('(同人誌) [白玉湯 (くそガキ)] 俺の上京性生活9 (オリジナル)', '(同人誌) [白玉湯 (くそガキ)] 俺の上京性生活8 (オリジナル)');
    assert.strictEqual(result, SAME_AUTHOR);
  });

  it('should return SAME_AUTHOR for filenames with the same author', () => {
    const result = isTwoBookTheSame('[白玉湯 (くそガキ)] 俺の上京性生活9 ', '(同人誌) [白玉湯 (くそガキ)] 俺の上京性生活8');
    assert.strictEqual(result, SAME_AUTHOR);
  });

  it('should return IS_IN_PC for filenames with similar groups and titles', () => {
    const result = isTwoBookTheSame('(C101) [灯夜工房 (灯ひでかず)] 破魔のミズキは終われない (オリジナル) [DL版]', 
                                    '(C101) [灯夜工房 (灯ひでかず)] 破魔のミズキは終われない  ');
    assert.strictEqual(result, IS_IN_PC);
  });

  it('should return LIKELY_IN_PC for filenames with one title inside the other', () => {
    const result = isTwoBookTheSame('(C101) [灯夜工房 (灯ひでかず)] AAAAA ', '(C101) [灯夜工房 (灯ひでかず)] AAAAABBBB');
    assert.strictEqual(result, LIKELY_IN_PC);
  });

});


describe('extractMiddleChars', () => {
  it("4", () => {
    const result = extractMiddleChars('和泉、れいぜい', 4);
    assert.strictEqual(result, '泉、れい');
  });

  it("10", () => {
    const result = extractMiddleChars('破魔のミズキは終われない ', 10);
    assert.strictEqual(result, '魔のミズキは終われな');
  });


  it("20", () => {
    const result = extractMiddleChars('[Author]Title1', 20);
    assert.strictEqual(result, '[Author]Title1');
  });
});


