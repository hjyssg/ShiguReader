const nameParser = require('../name-parser');

function oneInsideOne(s1, s2) {
    return s1 && s2 && (s1.includes(s2) || s2.includes(s1));
}

const puReg = /[ \.,\/#!$%\^&＆\*;:{}=\-_`~()\[\]\–-、｀～？！＠@、。／『』「」；’：・｜＝＋￥：？]/g
function _clean(str) {
    return str && str.replaceAll(puReg, "");
}

console.assert(_clean("和泉、れいぜい") === _clean("和泉, れいぜい"))

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
        if(nameParser.isHighlySimilar(fn1, fn2)){
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
        isSimilarGroup = nameParser.isHighlySimilar(group1, group2);
    }

    if (isSimilarGroup) {
        let title1 = _clean(r1.title);
        let title2 = _clean(r2.title);
        if (title1 === title2 || nameParser.isHighlySimilar(title1, title2)) {
            result = IS_IN_PC;
        } else if (oneInsideOne(title1, title2)) {
            result = LIKELY_IN_PC;
        }
    }

    if (!compareInternalDigit(r1.title, r2.title)) {
        result = LIKELY_IN_PC;
    }

    return result;
}

//------------------------------------------------------
function compareInternalDigit(s1, s2) {
    const digitTokens1 = s1.match(/\d+/g);
    const digitTokens2 = s2.match(/\d+/g);
    if (digitTokens1 && digitTokens2) {
        if (digitTokens1.length !== digitTokens2.length ||
            digitTokens1.join() !== digitTokens2.join()) {
            return false;
        }
    } else if (digitTokens1 && !digitTokens2) {
        return false;
    } else if (!digitTokens1 && digitTokens2) {
        return false;
    }
    return true;
}

//------

function checkIfDownload(text, pageNum) {
    var status = 0;
    let similarTitles = [];
    let r1 = parse(text);



    if (r1 && r1.author) {
        //use author as index to find
        let books = getByAuthor(r1.author);

        if (books && books.length > 0) {
            status = SAME_AUTHOR;
            for (let ii = 0; ii < books.length; ii++) {
                const book = books[ii];

                let fn2 = book.fileName;
                const r2 = parse(fn2)

                if (!compareInternalDigit(r1.title, r2.title)) {
                    continue;
                }

                status = Math.max(status, isTwoBookTheSame(text, fn2));
                if (status === LIKELY_IN_PC) {
                    similarTitles.push(fn2);
                    //todo pick the most similar
                    //or show all
                }

                if (status === IS_IN_PC) {
                    break;
                }
            }
        }
    } else {
        const _text = _clean(text);
        let reg = escapeRegExp(_text);
        let books = file_collection.chain()
            .find({ '_filename_': { '$regex': reg } })
            .data();

        books.forEach(e => {
            if (e._filename_ === _text) {
                status = IS_IN_PC;
            }

            if (status < LIKELY_IN_PC && nameParser.isHighlySimilar(e._filename_, _text)) {
                status = Math.max(status, LIKELY_IN_PC);
                similarTitles.push(e);
            }
        })
    }

    return {
        status,
        similarTitles
    }
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

function isOnlyDigit(str) {
    return str.match(/^[0-9]+$/) != null
}

module.exports = {
    IS_IN_PC,
    LIKELY_IN_PC,
    SAME_AUTHOR,
    TOTALLY_DIFFERENT,
    isTwoBookTheSame,
    extractMiddleChars
}