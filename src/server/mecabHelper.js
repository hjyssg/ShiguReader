const path = require('path');
const serverUtil = require("./serverUtil");

let parseAsync;
module.exports.init =  async function () {
    try {
        const MeCab = require('mecab-async');
        const mecab = new MeCab();
        const _util = require('util');
        parseAsync = _util.promisify(mecab.parse).bind(mecab);
        const testTokens = await parseAsync("うちの娘の為ならば、俺はもしかしたら魔王も倒せるかもしれない");
    } catch (e) {
        parseAsync = null;
    }
}

global.mecab_getTokens = async (str) => {
    let result = [];
    try {
        if (parseAsync) {
            //pre-processing of the str
            str = path.basename(str, path.extname(str));
            let pObj = serverUtil.parse(str);
            if (pObj && pObj.title) {
                str = pObj.title;
            }

            //do the Mecab
            let tokens = await parseAsync(str);
            // console.log(tokens);

            //handle the tokens
            tokens = tokens
                .filter(row => {
                    return ["名詞", "動詞"].includes(row[1]);
                })
                .map(row => row[0]);

            //[apple, c, b, k, llll, p, p, p] 
            // => 
            // [apple, cbk, llll, ppp] 
            let acToken = "";
            const len = tokens.length;
            let ii = 0;
            while (ii < len) {
                let tempToken = tokens[ii];
                if (tempToken.length > 1) {
                    if (acToken.length > 1) {
                        result.push(acToken);
                    }
                    result.push(tempToken)
                    acToken = "";
                } else if (tempToken.length === 1) {
                    acToken += tempToken;
                }
                ii++;
            }
            //the last token
            if (acToken.length > 1) {
                result.push(acToken);
            }
        }
    } catch (e) {
        console.warn(e);
    } finally {
        return result;
    }
}