const config = require("./name-parser-config");
const same_tag_regs_table = config.same_tag_regs_table;
const not_author_but_tag = config.not_author_but_tag;
const char_names = require("./character-names");
//https://stackoverflow.com/questions/5582574/how-to-check-if-a-string-contains-text-from-an-array-of-substrings-in-javascript
const char_name_regex = new RegExp(char_names.join("|"));
const not_author_but_tag_regex = new RegExp(not_author_but_tag.join("$|") + "$", "i");
const util = require("./ParserUtil");
const { editDistance, getExtraTags, isHighlySimilar, matchAll } = util;

const useless_tag_regex = /DL版|同人誌|別スキャン|修正版|^エロ|^digital$|^JPG|^PNG|ページ補足|進行中|別版|Various/i;
function isUselessTag(str) {
    return !!str.match(useless_tag_regex)
}

const media_types = [
    "同人音声",
    "同人催眠音声",
    "同人ソフト",
    "同人CG集",
    "同人CG",
    "同人ゲーム",
    "同人GAME",
    "成年コミック",
    "一般コミック",
    "一般漫画",
    "ゲームCG",
    "イラスト集",
    "アンソロジー",
    "画集",
    "雑誌",
    "18禁ゲーム",
    "GAME",
    "CG",
    "同人誌",
    "DOUJINSHI"
];
const media_type_regex = new RegExp(media_types.map(e => `(${e})`).join("|"), "i");

function isMediaType(str) {
    return !!str.match(media_type_regex);
}

function getMediaType(str) {
    let res = str.match(media_type_regex) || [];
    return res[0];
}

const same_tag_matrix = [];
for (let tag in same_tag_regs_table) {
    if (same_tag_regs_table.hasOwnProperty(tag)) {
        const big_pre_join = same_tag_regs_table[tag].map(e => e.source)
        const r = new RegExp(big_pre_join.join("|"), 'i')
        const row = [r, tag];
        same_tag_matrix.push(row);
    }
}
same_tag_matrix.sort((r1, r2) => {
    return r2[1].length - r1[1].length
});

const localCache = {};

const comicket_reg = /^C\d{2}$/i;
const comicket_reg_2 = /^C1\d{2}$/i;
const air_comicket_reg = /^エアコミケ\d{1}$/i;
const comic_star_reg = /^COMIC1☆\d{1,2}$/i;
const love_live_event_reg = /^僕らのラブライブ!/i;
const comitea_reg = /^コミティア.*\d/;
const sankuri_reg = /^サンクリ.*\d+/;
const reitaisai_reg = /^例大祭.*\d+/;
const tora_reg = /^とら祭り.*\d+/;
const komitore_reg = /^こみトレ.*\d+/;
const reg_list = [comicket_reg_2, comicket_reg, air_comicket_reg, comic_star_reg, love_live_event_reg,
    comitea_reg, sankuri_reg, reitaisai_reg,
    tora_reg, komitore_reg, /みみけっと.*\d+/,
    /コミトレ.*\d+/, /FF\d+/, /iDOL SURVIVAL.*\d/i,
    /SC\d+/, /コミコミ.*\d/, /ふたけっと.*\d/,
    /ファータグランデ騎空祭/, /歌姫庭園/, /紅楼夢/,
    /CSP\d/, /CC大阪\d/, /COMITIA\d/];

const event_reg = new RegExp(reg_list.map(e => e.source).join("|"), "i");

function belongToEvent(str) {
    return !!str.match(event_reg);
}

const comiket_to_date_table = {};
function getDateFromParse(str) {
    const pp = parse(str);
    let result;
    if (pp) {
        if (pp.dateTag) {
            result = getDateFromStr(pp.dateTag);
        } else if (pp.comiket) {
            result = getDateFromComiket(pp.comiket)
        }
    }
    return result;
}

//for sort algo, not very accurate
function getDateFromComiket(comiket) {
    let result = null;
    let num;
    let year;
    let month;

    if (comiket_to_date_table[comiket]) {
        result = comiket_to_date_table[comiket];
    } else if (comiket.match(comicket_reg_2)) {
        comiket = comiket.replace("C", "");
        num = parseInt(comiket) - 100;
        result = new Date(2022, 8, 13); // C100

        year = Math.floor(num / 2) + 2022;
        const isSummer = num % 2 === 0;
        month = isSummer ? 8 : 11;
        const day = isSummer ? 10 : 28;
        result = new Date(year, month, day);
    } else if (comiket.match(comicket_reg)) {
        comiket = comiket.replace("C", "");
        num = parseInt(comiket);
        year = Math.floor(num / 2) + 1971;
        const isSummer = num % 2 === 0;
        month = isSummer ? 8 : 11;
        const day = isSummer ? 10 : 28;
        result = new Date(year, month, day);
    } else if (comiket.match(air_comicket_reg)) {
        comiket = comiket.replace("エアコミケ", "");
        num = parseInt(comiket);
        if (num === 1) {
            result = new Date(2020, 7, 30);
        } else {
            result = new Date(2020, 11, 30);
        }
    } else if (comiket.match(comic_star_reg)) {
        comiket = comiket.replace("COMIC1☆", "");
        num = parseInt(comiket);
        if (num <= 10) {
            //once per year
            result = new Date(2006 + num, 3, 30);
        } else {
            num = (num - 10)
            year = 2017 + Math.floor(num / 2);
            month = num % 2 === 0 ? 10 : 4;
            result = new Date(year, month, 30);
        }
    }

    if (result) {
        comiket_to_date_table[comiket] = result;
    }
    return result;
}

const currentYear = (new Date()).getFullYear();
function getDateFromStr(str) {
    const mresult = str.match(date_reg);
    if (mresult) {
        let [wholeMatch, y, m, d] = mresult.filter(e => !!e);
        y = convertYearString(y);
        m = parseInt(m) - 1;
        d = parseInt(d) || 1;

        if (m < 0 || m > 11) {
            return undefined;
        } else if (d < 1 || d > 31) {
            return undefined;
        }if (y > currentYear + 2 || y < 1970){
            return undefined;
        }

        return new Date(y, m, d);
    }
}

function convertYearString(y) {
    if (y.length === 2) {
        y = parseInt(y);
        if (y > 70) {
            y = 1900 + y;
        } else {
            y = 2000 + y;
        }
    } else {
        y = parseInt(y)
    }

    return y;
}


function isDateValid(date) {
    // An invalid date object returns NaN for getTime() and NaN is the only
    // object not strictly equal to itself.
    return date.getTime() === date.getTime();
};

const dreg0 = /(\d{4})(\d{1,2})(\d{2})/;
const dreg1 = /(\d{2})(\d{2})(\d{2})/;
const dreg2 = /(\d{2})-(\d{2})-(\d{2})/;
const dreg3 = /(\d{4})-(\d{1,2})-(\d{2})/;
const dreg4 = /(\d{4})年(\d{1,2})月号/;
const dreg5 = /(\d{4})年(\d{1,2})月(\d{1,2})日/;
const dreg6 = /(\d{4})\.(\d{1,2})\.(\d{1,2})/;
const date_reg = new RegExp([dreg0, dreg1, dreg2, dreg3, dreg4, dreg5, dreg6].map(e => e.source).join("|"), "i");
function isStrDate(str) {
    if (str.match(date_reg)) {
        const dd = getDateFromStr(str);
        return !!(dd && isDateValid(dd));
    }
}

const groupAndNameReg = /^(.*?)\s*\((.*?)\)$/;
function getGroupAndName(str) {
    var macthes = str.match(groupAndNameReg);
    if (macthes && macthes.length > 0) {
        return {
            group: macthes[1].trim(),
            name: macthes[2].trim(),
        };
    } else {
        return {
            name: str.trim(),
        };
    }
}


function isNotAuthor(str) {
    return str.match(not_author_but_tag_regex);
}

function findMaxStr(arr) {
    let res = arr[0];
    arr.forEach(e => {
        if (e.length > res.length) {
            res = e;
        }
    })
    return res;
}

const pReg = /\((.*?)\)/g;
const bReg = /\[(.*?)\]/g;
const seperator = /,|、|&|＆/;

function getLocalCache(){
    return localCache;
}

function setLocalCache(newLocache){
    for (var key in newLocache) {
        if (!newLocache.hasOwnProperty(key)) {
            continue;
        }
        var obj = newLocache[key];
        localCache[key] = obj;
    }
}

function parse(str) {
    if (!str || localCache[str] === "NO_EXIST") {
        return null;
    }

    if (localCache[str]) {
        return localCache[str];
    }

    const bMacthes = matchAll(bReg, str); //[]
    const pMacthes = matchAll(pReg, str);  //()

    const hasB = (bMacthes && bMacthes.length > 0);
    const hasP = (pMacthes && pMacthes.length > 0);

    if (!hasB && !hasP) {
        localCache[str] = "NO_EXIST";
        return;
    }

    let author;
    let authors = [];
    let group;
    let dateTag;
    let comiket;
    let type;
    let tags = [];

    function isOtherInfo(token) {
        let result = false;
        if (isMediaType(token)) {
            type = getMediaType(token);
            result = true;
        } else if (belongToEvent(token)) {
            comiket = token;
            result = true;
        } else if (isStrDate(token)) {
            dateTag = token;  //e.g 190214
            result = true;
        } else if (isUselessTag(token)) {
            //nothing
            result = true;
        }
        return result;
    }

    // looking for author, avoid 6 year digit
    if (bMacthes && bMacthes.length > 0) {
        for (let ii = 0; ii < bMacthes.length; ii++) {
            let token = bMacthes[ii].trim();
            const tt = token.toLowerCase();
            const nextCharIndex = str.indexOf(bMacthes[ii]) + bMacthes[ii].length + 1;
            const nextChar = str[nextCharIndex];

            if (isOtherInfo(token)) {
                continue;
            } if (isNotAuthor(tt)) {
                //e.g pixiv is not author
                tags.push(token);
            } else if (nextChar === "." || nextCharIndex >= str.length) {
                //e.g KI-RecenT SP02 NATURALCORDE [DL版].zip
                // [DL版] is not auhor name
                tags.push(token);
            } else if (!author) {
                //  [真珠貝(武田弘光)]
                const temp = getGroupAndName(token);
                if (temp.name && !isNotAuthor(temp.name)) {
                    //e.g よろず is not author
                    author = temp.name;
                    authors = author.split(seperator).map(e => e.trim());
                }
                group = temp.group;
            } else {
                tags.push(token);
            }
        }
    }

    //---------------handle tags
    if (pMacthes && pMacthes.length > 0) {
        tags.push(...pMacthes);
    }

    //seperate
    const tseperator = /,|、/;
    const tempTags = [];
    tags.forEach(t => {
        tempTags.push(...(t.split(tseperator)));
    })
    tags = tempTags;


    tags = tags.map(e => e.trim());

    tags = tags.filter(e => {
        return e.length > 1 && !isOtherInfo(e) && authors.indexOf(e) === -1 && e !== author;
    });

    tags = tags.filter(e => {
        return  !isUselessTag(e) && !isMediaType(e);
    })

    const rawTags = tags.slice();

    tags = tags.map(e => {
        e = e.replace(/ {2,}/g, " ").replace(/。/g, "").replace(/！/g, "!").replace(/？/g, "?");

        //tag reducing
        const converts = [];
        for (let ii = 0; ii < same_tag_matrix.length; ii++) {
            const row = same_tag_matrix[ii];
            const r = row[0];
            if (e.match(r)) {
                converts.push(row[1]);
            }
        }

        if (converts.length > 0) {
            return findMaxStr(converts);
        } else {
            return e;
        }
    })

    if (!type) {
        if (comiket || group) {
            type = "同人誌";
        } else {
            type = "UNKOWN";
        }
    }

    if (!author && !group && tags.length === 0) {
        localCache[str] = "NO_EXIST";
        return;
    }

    //get title
    let title = str;
    (bMacthes || []).concat(pMacthes || [], rawTags || [], [/\[/g, /\]/g, /\(/g, /\)/g]).forEach(e => {
        title = title.replace(e, "");
    })
    if(title.includes(".")){
        title = title.split(".")[0];
    }
    title = title.trim();

    //get character names
    let charNames = [];
    if(char_name_regex ){
        const names = title.match(char_name_regex);
        if(names){
            charNames.push(...names);
        }
    } 

    const extraTags = getExtraTags(title);
    const result = {
        // 日期tag：比如 20220312
        dateTag, 
        // 同人的group
        group, 
        // 作者。其实有点不对，因为有的是有多作者的
        author, 
        // 作者list
        authors, 
        // tags 已过变形处理
        tags, 
        // 用regex从string找到的角色名字
        charNames,
        // extrac tags
        extraTags,
        // 未经转换的tags
        rawTags,
        // 比如 c101
        comiket, 
        // 类型
        type, 
        // 标题
        title
    };

    localCache[str] = result;
    return result;
}


module.exports = {
    isUselessTag,
    isMediaType,
    getMediaType,
    belongToEvent,
    convertYearString,
    editDistance,
    getDateFromStr,

    parse,
    getDateFromComiket,
    getDateFromParse,
    getLocalCache,
    setLocalCache,
    isHighlySimilar,
}



