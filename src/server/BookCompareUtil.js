const nameParser = require('../name-parser');

function oneInsideOne(s1, s2) {
    return s1 && s2 && (s1.includes(s2) || s2.includes(s1));
}

const puReg = /[ \.,\/#!$%\^&＆\*;:{}=\-_`~()\[\]\–-、｀～？！＠@、。／『』「」；’：・｜＝＋￥：？]/g
function _clean(str) {
    return str && str.replaceAll(puReg, "");
}

const __isHighlySimilar  = (t1, t2) => {
    return nameParser.isHighlySimilar(t1, t2);
}

const IS_IN_PC = 100;
const LIKELY_IN_PC = 70;
const SAME_AUTHOR = 20;
const TOTALLY_DIFFERENT = 0;
function isTwoBookTheSame(fn1, fn2) {
    fn1 = fn1.toLowerCase();
    fn2 = fn2.toLowerCase();

    const r1 = nameParser.parse(fn1);
    const r2 = nameParser.parse(fn2);

    if(!r1 || !r2){
        if(__isHighlySimilar(fn1, fn2)){
            return LIKELY_IN_PC;
        }else{
            return TOTALLY_DIFFERENT;
        }
    }

    if (_clean(r1.author) !== _clean(r2.author)) {
        return TOTALLY_DIFFERENT;
    }

    let result = SAME_AUTHOR;
    //e.g one is c97, the other is c96. cannot be the same
    if (r1.comiket && r2.comiket && r1.comiket !== r2.comiket) {
        return result;
    }

    let isSimilarGroup;
    let group1 = _clean(r1.group);
    let group2 = _clean(r2.group);
    if ((group1 && !group2) || (!group1 && group2)) {
        isSimilarGroup = true;
    } else {
        isSimilarGroup = __isHighlySimilar(group1, group2);
    }

    if (isSimilarGroup) {
        let title1 = _clean(r1.title);
        let title2 = _clean(r2.title);
        if (title1 === title2 || __isHighlySimilar(title1, title2)) {
            result = IS_IN_PC;
        } else if (oneInsideOne(title1, title2)) {
            result = LIKELY_IN_PC;
        }
    }

    return result;
}


// 写一个js函数抽取任意str中间的char。
function extractMiddleChars(str, wantedSize = 10) {
    if (wantedSize >= str.length) {
      return str;
    } else {
      const startIndex = Math.floor((str.length - wantedSize) / 2);
      const endIndex = startIndex + wantedSize;
      return str.substring(startIndex, endIndex);
    }
}
  

module.exports = {
    IS_IN_PC,
    LIKELY_IN_PC,
    SAME_AUTHOR,
    TOTALLY_DIFFERENT,
    isTwoBookTheSame,
    extractMiddleChars
};